import json
import logging
from typing import Optional

import anthropic
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)

DEFAULT_TOPIC_CATEGORIES = [
    {"name": "Evals & measurement", "description": "Frameworks, rubrics, and metrics for evaluating AI outputs, interview quality, and recommendation accuracy."},
    {"name": "AI adoption & org change", "description": "How enterprises adopt AI tools, manage cultural resistance, and navigate organisational transformation."},
    {"name": "Mapping problem & discovery", "description": "The core challenge of surfacing what an organisation actually does versus what it says it does, and bridging that gap."},
    {"name": "Tacit knowledge & work capture", "description": "How expertise and intuition that cannot easily be written down gets elicited, structured, and made machine-readable."},
    {"name": "Playbook & methodology", "description": "Structured methodologies, repeatable processes, and best-practice templates for AI consulting engagements."},
    {"name": "Co-design & worker voice", "description": "Approaches that actively involve workers and domain experts in designing AI systems that affect their roles."},
    {"name": "Data flywheel & moat", "description": "How proprietary data accumulates to create defensible competitive advantages through model improvement loops."},
    {"name": "RAG & retrieval", "description": "Retrieval-augmented generation architectures, vector search, chunking strategies, re-ranking, and hybrid search."},
    {"name": "LLM tooling & infrastructure", "description": "Practical tools, APIs, frameworks, and infrastructure for building and deploying LLM-powered applications."},
    {"name": "Research & evidence base", "description": "Academic papers, industry studies, and empirical evidence that underpin LichenAI's product claims and consulting thesis."},
]

DEFAULT_USE_CASE_TAGS = [
    {"name": "Consultant pitch", "description": "Content useful for pitching LichenAI to potential consulting clients — case studies, ROI frameworks, and positioning narratives."},
    {"name": "Investor narrative", "description": "Material that supports the investor story: market size, differentiation, traction evidence, and long-term vision."},
    {"name": "Evals evidence", "description": "Evidence and benchmarks that validate the quality of LichenAI's interview outputs and recommendations."},
    {"name": "Onboarding", "description": "Resources for getting new team members or client stakeholders up to speed on LichenAI's approach and tools."},
    {"name": "Competitive intelligence", "description": "Analysis of competing products, alternative approaches, or adjacent markets for positioning and feature decisions."},
    {"name": "Product decision", "description": "Research that directly informs a specific feature, architectural choice, or strategic direction currently under discussion."},
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


def _format_category_list(categories: list[dict]) -> str:
    lines = []
    for cat in categories:
        name = cat.get("name", "")
        desc = cat.get("description", "")
        lines.append(f'  - "{name}": {desc}' if desc else f'  - "{name}"')
    return "\n".join(lines)


def _build_system_prompt(topic_categories: list[dict], use_case_tags: list[dict]) -> str:
    topic_names = json.dumps([c.get("name") for c in topic_categories])
    tag_names = json.dumps([c.get("name") for c in use_case_tags])
    topic_formatted = _format_category_list(topic_categories)
    tag_formatted = _format_category_list(use_case_tags)

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
        f'  "suggested_topic_categories": ["string"] — choose from: {topic_names},\n'
        f'  "suggested_use_case_tags": ["string"] — choose from: {tag_names}\n'
        "}\n\n"
        "Category definitions (use these to decide which categories fit the document):\n\n"
        f"Topic categories:\n{topic_formatted}\n\n"
        f"Use-case tags:\n{tag_formatted}"
    )


async def classify_document(
    content: str,
    existing_topic_categories: Optional[list[dict]] = None,
    existing_use_case_tags: Optional[list[dict]] = None,
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
