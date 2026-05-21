import json
import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

import anthropic
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from config import settings
from database import get_db
from models.schemas import DocumentResponse
from routers.documents import _run_classification, _to_response

logger = logging.getLogger(__name__)
router = APIRouter(tags=["explore"])

_claude: anthropic.AsyncAnthropic | None = None


def _get_claude() -> anthropic.AsyncAnthropic:
    global _claude
    if _claude is None:
        _claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _claude


EXPLORE_SYSTEM = (
    "You are a research discovery assistant for LichenAI, a company building AI discovery "
    "tools for consultants. Given a document, suggest 7 related articles, papers, or posts "
    "that would be valuable to the team. Return ONLY valid JSON:\n"
    "{\n"
    '  "suggestions": [\n'
    "    {\n"
    '      "title": "string",\n'
    '      "source": "string (publication or domain)",\n'
    '      "author": "string",\n'
    '      "url": "string",\n'
    '      "rationale": "string (one sentence — why this is relevant to LichenAI)",\n'
    '      "type": "same-topic" | "foundational" | "adjacent" | "same-author"\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
    "Recommend only from: academic papers (arxiv, NeurIPS, ICML), major AI lab blogs "
    "(Anthropic, OpenAI, DeepMind, Google Research), established practitioners with large "
    "followings, top newsletters (Import AI, The Batch, Ahead of AI), major publications. "
    "No unknown personal blogs."
)


class Suggestion(BaseModel):
    title: str
    source: str
    author: str
    url: str
    rationale: str
    type: str  # 'same-topic' | 'foundational' | 'adjacent' | 'same-author'


class ExploreResponse(BaseModel):
    suggestions: list[Suggestion]


class FromSuggestionRequest(BaseModel):
    url: str
    title: str
    uploaded_by: str
    source_document_id: Optional[str] = None


@router.post(
    "/documents/{document_id}/explore",
    response_model=ExploreResponse,
    summary="Get 7 related article suggestions for a document",
)
async def explore_document(document_id: str):
    db = get_db()

    row = (
        db.table("documents")
        .select("id, title, summary, url, document_categories(categories(name, type))")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = row.data
    title = doc.get("title") or "Untitled"
    summary = doc.get("summary") or ""
    url = doc.get("url") or ""

    # Collect category names
    cats = []
    for dc in doc.get("document_categories") or []:
        cat = dc.get("categories") if isinstance(dc, dict) else None
        if isinstance(cat, dict) and cat.get("name"):
            cats.append(cat["name"])

    user_message = (
        f"Document title: {title}\n"
        f"URL: {url}\n"
        f"Summary: {summary}\n"
        f"Categories: {', '.join(cats) if cats else 'none'}\n\n"
        "Suggest 7 related articles the LichenAI team should read next."
    )

    response = await _get_claude().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=EXPLORE_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        raw = "\n".join(lines[1:end])

    parsed = json.loads(raw)
    suggestions = [Suggestion(**s) for s in parsed.get("suggestions", [])]
    return ExploreResponse(suggestions=suggestions)


@router.post(
    "/documents/from-suggestion",
    response_model=DocumentResponse,
    status_code=201,
    summary="Add a document discovered via Explore More",
)
async def add_from_suggestion(request: FromSuggestionRequest, background_tasks: BackgroundTasks):
    db = get_db()

    # Duplicate URL check
    dup = db.table("documents").select("id").eq("url", request.url).execute()
    if dup.data:
        raise HTTPException(
            status_code=409,
            detail={"message": "Document already exists", "document_id": dup.data[0]["id"]},
        )

    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    ins = db.table("documents").insert({
        "id": doc_id,
        "url": request.url,
        "title": request.title,
        "status": "pending",
        "uploaded_by": request.uploaded_by,
        "uploaded_at": now,
        "source_document_id": request.source_document_id,
    }).execute()

    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    background_tasks.add_task(_run_classification, doc_id, request.url, None, None)
    return _to_response(ins.data[0])
