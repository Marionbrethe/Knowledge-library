import json
import logging
from typing import Optional

import anthropic
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)

DEFAULT_TOPIC_CATEGORIES = [
    "Evals & measurement",
    "AI adoption & org change",
    "Mapping problem & discovery",
    "Tacit knowledge & work capture",
    "Playbook & methodology",
    "Co-design & worker voice",
    "Data flywheel & moat",
    "RAG & retrieval",
    "LLM tooling & infrastructure",
    "Research & evidence base",
]

DEFAULT_USE_CASE_TAGS = [
    "Consultant pitch",
    "Investor narrative",
    "Evals evidence",
    "Onboarding",
    "Competitive intelligence",
    "Product decision",
]

_client: anthropic.AsyncAnthropic | None = None

# Leave ~3k tokens headroom for the response and system prompt
_MAX_CONTENT_CHARS = 50_000


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


class ClassificationResult(BaseModel):
    title: str
    summary: str
    tension: str
    relevance_score: int
    relevance_reason: str
    next_steps: list[str]
    auto_questions: list[str]
    suggested_topic_categories: list[str]
    suggested_use_case_tags: list[str]


def _build_system_prompt(topic_categories: list[str], use_case_tags: list[str]) -> str:
    return (
        "You are a research classifier for LichenAI, a company building AI-powered "
        "discovery interview tools for AI consultants. Return ONLY valid JSON with "
        "no markdown fencing:\n"
        "{\n"
        '  "title": "string — extracted or inferred from content",\n'
        '  "summary": "string — 2-3 sentences, plain language",\n'
        '  "tension": "string — what this complicates or argues against, 1-2 sentences",\n'
        '  "relevance_score": integer 1-10 rated against these focus areas: evals framework '
        "for interview quality, consultant GTM, the mapping problem in enterprise AI adoption, "
        "tacit knowledge capture, RAG/retrieval architecture,\n"
        '  "relevance_reason": "string — one sentence explaining the score",\n'
        '  "next_steps": ["string"] — 1-3 specific actions for the LichenAI team '
        "(e.g. relevant to current evals rubric, useful for consultant pitch, "
        "worth discussing before architecture decision),\n"
        '  "auto_questions": ["string"] — 2-3 questions this raises for an AI product '
        "company doing discovery interviews,\n"
        f'  "suggested_topic_categories": ["string"] — choose from: {json.dumps(topic_categories)},\n'
        f'  "suggested_use_case_tags": ["string"] — choose from: {json.dumps(use_case_tags)}\n'
        "}"
    )


async def classify_document(
    content: str,
    existing_topic_categories: Optional[list[str]] = None,
    existing_use_case_tags: Optional[list[str]] = None,
) -> ClassificationResult:
    topic_cats = existing_topic_categories or DEFAULT_TOPIC_CATEGORIES
    use_case_tags = existing_use_case_tags or DEFAULT_USE_CASE_TAGS

    message = await _get_client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=_build_system_prompt(topic_cats, use_case_tags),
        messages=[
            {
                "role": "user",
                "content": f"Classify this document:\n\n{content[:_MAX_CONTENT_CHARS]}",
            }
        ],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if the model adds them despite being told not to
    if raw.startswith("```"):
        lines = raw.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        raw = "\n".join(lines[1:end])

    return ClassificationResult(**json.loads(raw))
