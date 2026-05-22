import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from database import get_db
from models.schemas import DocumentResponse
from routers.documents import _run_classification, _to_response
from services.feed_checker import fetch_articles_from_source

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MonitoredSourceCreate(BaseModel):
    name: str
    url: str
    added_by: str = "team"


class MonitoredSourceResponse(BaseModel):
    id: str
    name: str
    url: str
    added_by: str
    added_at: datetime
    last_checked_at: Optional[datetime] = None
    new_count: int = 0


class SourceArticleResponse(BaseModel):
    id: str
    source_id: str
    source_name: str
    title: Optional[str] = None
    url: str
    published_at: Optional[datetime] = None
    found_at: datetime
    is_dismissed: bool
    document_id: Optional[str] = None


class CheckResponse(BaseModel):
    checked: int
    new_articles_found: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/sources", response_model=list[MonitoredSourceResponse])
async def list_sources():
    db = get_db()
    sources = db.table("monitored_sources").select("*").order("added_at", desc=False).execute().data

    # Get unread article counts per source
    unread = (
        db.table("source_articles")
        .select("source_id")
        .eq("is_dismissed", False)
        .is_("document_id", "null")
        .execute()
        .data
    )
    counts: dict[str, int] = {}
    for row in unread:
        sid = row["source_id"]
        counts[sid] = counts.get(sid, 0) + 1

    return [
        MonitoredSourceResponse(**s, new_count=counts.get(s["id"], 0))
        for s in sources
    ]


@router.post("/sources", response_model=MonitoredSourceResponse, status_code=201)
async def add_source(body: MonitoredSourceCreate):
    db = get_db()

    # Check for duplicate URL
    existing = db.table("monitored_sources").select("id").eq("url", body.url).execute()
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail={"message": "Source with this URL already exists", "source_id": existing.data[0]["id"]},
        )

    now = datetime.now(timezone.utc).isoformat()
    ins = db.table("monitored_sources").insert({
        "id": str(uuid.uuid4()),
        "name": body.name,
        "url": body.url,
        "added_by": body.added_by,
        "added_at": now,
    }).execute()

    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create source record")

    return MonitoredSourceResponse(**ins.data[0], new_count=0)


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(source_id: str):
    db = get_db()
    db.table("monitored_sources").delete().eq("id", source_id).execute()


@router.post("/sources/check", response_model=CheckResponse)
async def check_sources():
    db = get_db()

    sources = db.table("monitored_sources").select("*").execute().data
    if not sources:
        return CheckResponse(checked=0, new_articles_found=0)

    # Seed known URLs from existing source_articles and documents
    existing_articles = db.table("source_articles").select("url").execute().data
    known_urls: set[str] = {row["url"] for row in existing_articles}

    existing_docs = db.table("documents").select("url").execute().data
    for row in existing_docs:
        if row.get("url"):
            known_urls.add(row["url"])

    new_count_total = 0
    lock = asyncio.Lock()

    async def check_one_source(source: dict) -> int:
        nonlocal new_count_total
        source_id = source["id"]
        source_url = source["url"]
        new_for_source = 0

        try:
            articles = await fetch_articles_from_source(source_url)
        except Exception as exc:
            logger.warning("Failed to check source %s: %s", source_url, exc)
            articles = []

        now = datetime.now(timezone.utc).isoformat()

        for article in articles:
            art_url = article.get("url")
            if not art_url:
                continue

            async with lock:
                if art_url in known_urls:
                    continue
                known_urls.add(art_url)

            published = article.get("published_at")
            published_iso = published.isoformat() if published else None

            try:
                ins = db.table("source_articles").insert({
                    "id": str(uuid.uuid4()),
                    "source_id": source_id,
                    "title": article.get("title"),
                    "url": art_url,
                    "published_at": published_iso,
                    "found_at": now,
                }).execute()
                if ins.data:
                    new_for_source += 1
            except Exception as exc:
                logger.debug("Could not insert article %s: %s", art_url, exc)

        # Update last_checked_at
        try:
            db.table("monitored_sources").update({"last_checked_at": now}).eq("id", source_id).execute()
        except Exception as exc:
            logger.warning("Failed to update last_checked_at for source %s: %s", source_id, exc)

        return new_for_source

    results = await asyncio.gather(*[check_one_source(s) for s in sources], return_exceptions=True)
    for r in results:
        if isinstance(r, int):
            new_count_total += r

    return CheckResponse(checked=len(sources), new_articles_found=new_count_total)


@router.get("/articles", response_model=list[SourceArticleResponse])
async def list_articles():
    db = get_db()
    articles = (
        db.table("source_articles")
        .select("*, monitored_sources(name)")
        .eq("is_dismissed", False)
        .is_("document_id", "null")
        .order("found_at", desc=True)
        .execute()
        .data
    )

    result = []
    for a in articles:
        source_name = ""
        src = a.get("monitored_sources")
        if isinstance(src, dict):
            source_name = src.get("name", "")
        clean = {k: v for k, v in a.items() if k != "monitored_sources"}
        result.append(SourceArticleResponse(**clean, source_name=source_name))
    return result


@router.get("/articles/count")
async def get_article_count():
    db = get_db()
    rows = (
        db.table("source_articles")
        .select("id")
        .eq("is_dismissed", False)
        .is_("document_id", "null")
        .execute()
        .data
    )
    return {"count": len(rows)}


@router.patch("/articles/{article_id}/dismiss", status_code=204)
async def dismiss_article(article_id: str):
    db = get_db()
    db.table("source_articles").update({"is_dismissed": True}).eq("id", article_id).execute()


@router.post("/articles/{article_id}/add-to-library", response_model=DocumentResponse, status_code=201)
async def add_article_to_library(article_id: str, background_tasks: BackgroundTasks):
    db = get_db()

    article_rows = db.table("source_articles").select("*").eq("id", article_id).execute().data
    if not article_rows:
        raise HTTPException(status_code=404, detail="Article not found")
    article = article_rows[0]

    article_url = article["url"]

    # Check if document already exists for this URL
    existing = db.table("documents").select("id").eq("url", article_url).execute()
    if existing.data:
        existing_doc_id = existing.data[0]["id"]
        # Mark article with the existing document_id
        db.table("source_articles").update({"document_id": existing_doc_id}).eq("id", article_id).execute()
        doc_rows = (
            db.table("documents")
            .select(
                "id, url, file_path, title, summary, tension, relevance_score, relevance_reason, "
                "next_steps, auto_questions, status, source_document_id, uploaded_by, uploaded_at, "
                "document_categories(categories(id, name, type, description, created_by, created_at))"
            )
            .eq("id", existing_doc_id)
            .execute()
            .data
        )
        if doc_rows:
            return _to_response(doc_rows[0])
        raise HTTPException(status_code=500, detail="Document found but could not be retrieved")

    # Create new pending document
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    ins = db.table("documents").insert({
        "id": doc_id,
        "url": article_url,
        "status": "pending",
        "uploaded_by": "monitoring",
        "uploaded_at": now,
    }).execute()

    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    # Mark article with the new document_id
    db.table("source_articles").update({"document_id": doc_id}).eq("id", article_id).execute()

    background_tasks.add_task(_run_classification, doc_id, article_url, None, None)

    return _to_response(ins.data[0])
