import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile

from database import get_db
from models.schemas import BulkImportRequest, BulkImportResponse, CategoryResponse, DocumentResponse
from services.classifier import classify_document
from services.embedder import generate_embedding
from services.fetcher import extract_urls_from_text, fetch_url_content, parse_pdf_content

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

# Columns returned for list/detail views — excludes the large embedding vector
_SELECT_COLS = (
    "id, url, file_path, title, summary, tension, relevance_score, relevance_reason, "
    "next_steps, auto_questions, status, source_document_id, uploaded_by, uploaded_at, "
    "document_categories(categories(id, name, type, created_by, created_at))"
)


def _to_response(row: dict) -> DocumentResponse:
    categories: list[CategoryResponse] = []
    for dc in row.get("document_categories") or []:
        cat = dc.get("categories") if isinstance(dc, dict) else None
        if isinstance(cat, dict):
            categories.append(CategoryResponse(**cat))

    clean = {k: v for k, v in row.items() if k not in ("document_categories", "embedding", "raw_content")}
    return DocumentResponse(**clean, categories=categories)


# ---------------------------------------------------------------------------
# Background classification pipeline
# ---------------------------------------------------------------------------

async def _run_classification(
    document_id: str,
    url: Optional[str],
    file_bytes: Optional[bytes],
    file_name: Optional[str],
) -> None:
    db = get_db()
    try:
        db.table("documents").update({"status": "processing"}).eq("id", document_id).execute()

        # 1. Fetch content
        if url:
            content = await fetch_url_content(url)
        elif file_bytes:
            if file_name and file_name.lower().endswith(".pdf"):
                content = parse_pdf_content(file_bytes)
            else:
                content = file_bytes.decode("utf-8", errors="replace")
        else:
            raise ValueError("No content source")

        # 2. Get live category lists to inject into the classifier prompt
        cat_rows = db.table("categories").select("id, name, type").execute().data
        topic_names = [c["name"] for c in cat_rows if c["type"] == "topic"]
        use_case_names = [c["name"] for c in cat_rows if c["type"] == "use_case"]

        # 3. Classify with Claude
        result = await classify_document(
            content,
            existing_topic_categories=topic_names or None,
            existing_use_case_tags=use_case_names or None,
        )

        update: dict = {
            "title": result.title,
            "summary": result.summary,
            "tension": result.tension,
            "relevance_score": result.relevance_score,
            "relevance_reason": result.relevance_reason,
            "next_steps": result.next_steps,
            "auto_questions": result.auto_questions,
            "raw_content": content,
            "status": "done",
        }

        # 4. Generate and store embedding (non-fatal if it fails)
        try:
            embedding = await generate_embedding(content)
            # pgvector requires a cast from text; we use an RPC helper defined in schema.sql
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            db.rpc(
                "update_document_embedding",
                {"p_doc_id": document_id, "p_embedding": embedding_str},
            ).execute()
        except Exception as emb_err:
            logger.warning("Embedding failed for %s: %s", document_id, emb_err)

        # 5. Persist classification fields
        db.table("documents").update(update).eq("id", document_id).execute()

        # 6. Link suggested categories (creates new ones if not yet in the DB)
        await _link_categories(document_id, result.suggested_topic_categories, "topic", cat_rows)
        await _link_categories(document_id, result.suggested_use_case_tags, "use_case", cat_rows)

        logger.info("Classification done for document %s (score=%s)", document_id, result.relevance_score)

    except Exception as exc:
        logger.error("Classification failed for %s: %s", document_id, exc, exc_info=True)
        try:
            db.table("documents").update({"status": "error"}).eq("id", document_id).execute()
        except Exception:
            pass


async def _link_categories(
    document_id: str,
    names: list[str],
    cat_type: str,
    existing: list[dict],
) -> None:
    db = get_db()
    by_name = {c["name"].lower(): c for c in existing if c["type"] == cat_type}

    for name in names:
        name = name.strip()
        if not name:
            continue

        hit = by_name.get(name.lower())
        if hit:
            cat_id = hit["id"]
        else:
            # Auto-create categories suggested by Claude that aren't in the DB yet
            try:
                ins = db.table("categories").insert({
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "type": cat_type,
                    "created_by": "system",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
                if not ins.data:
                    continue
                cat_id = ins.data[0]["id"]
            except Exception as e:
                logger.warning("Could not create category '%s': %s", name, e)
                continue

        try:
            db.table("document_categories").insert({
                "document_id": document_id,
                "category_id": cat_id,
            }).execute()
        except Exception:
            pass  # duplicate link — harmless


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/bulk",
    response_model=BulkImportResponse,
    summary="Extract all URLs from a block of text and queue them for ingestion",
)
async def bulk_import(request: BulkImportRequest, background_tasks: BackgroundTasks):
    db = get_db()
    urls = extract_urls_from_text(request.raw_text)

    duplicate_urls: list[str] = []
    added_documents: list[DocumentResponse] = []

    for url in urls:
        if db.table("documents").select("id").eq("url", url).execute().data:
            duplicate_urls.append(url)
            continue

        doc_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        ins = db.table("documents").insert({
            "id": doc_id,
            "url": url,
            "status": "pending",
            "uploaded_by": request.uploaded_by,
            "uploaded_at": now,
        }).execute()

        if ins.data:
            added_documents.append(_to_response(ins.data[0]))
            background_tasks.add_task(_run_classification, doc_id, url, None, None)

    return BulkImportResponse(
        added_count=len(added_documents),
        duplicate_urls=duplicate_urls,
        added_documents=added_documents,
    )


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=201,
    summary="Add a single document by URL or file upload",
)
async def create_document(
    background_tasks: BackgroundTasks,
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    uploaded_by: str = Form(...),
    # JSON-encoded list of existing category UUIDs to link immediately
    category_ids: str = Form(default="[]"),
):
    if not url and not file:
        raise HTTPException(status_code=400, detail="Provide either a url or a file")

    db = get_db()

    # Duplicate URL check — return 409 with existing document id
    if url:
        dup = db.table("documents").select("id").eq("url", url).execute()
        if dup.data:
            raise HTTPException(
                status_code=409,
                detail={"message": "Document already exists", "document_id": dup.data[0]["id"]},
            )

    try:
        cat_ids: list[str] = json.loads(category_ids)
    except json.JSONDecodeError:
        cat_ids = []

    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    file_bytes: Optional[bytes] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None

    if file:
        file_bytes = await file.read()
        file_name = file.filename
        file_path = f"uploads/{doc_id}/{file.filename}"

    ins = db.table("documents").insert({
        "id": doc_id,
        "url": url,
        "file_path": file_path,
        "status": "pending",
        "uploaded_by": uploaded_by,
        "uploaded_at": now,
    }).execute()

    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    # Link any manually chosen categories immediately
    for cat_id in cat_ids:
        try:
            db.table("document_categories").insert({
                "document_id": doc_id,
                "category_id": cat_id,
            }).execute()
        except Exception as e:
            logger.warning("Failed to link category %s: %s", cat_id, e)

    background_tasks.add_task(_run_classification, doc_id, url, file_bytes, file_name)

    return _to_response(ins.data[0])


@router.get(
    "/",
    response_model=list[DocumentResponse],
    summary="List documents with optional filters",
)
async def list_documents(
    category_id: Optional[str] = Query(None, description="Filter by topic category UUID"),
    tag_id: Optional[str] = Query(None, description="Filter by use-case tag UUID"),
    status: Optional[str] = Query(None, description="pending | processing | done | error"),
    sort: Optional[str] = Query(None, pattern="^(score|date)$", description="score or date"),
    q: Optional[str] = Query(None, description="Keyword search in title and summary"),
):
    db = get_db()

    # Resolve category filter (category_id and tag_id both reference the categories table)
    filter_cat = category_id or tag_id
    filter_doc_ids: Optional[list[str]] = None
    if filter_cat:
        dc = db.table("document_categories").select("document_id").eq("category_id", filter_cat).execute()
        filter_doc_ids = [r["document_id"] for r in dc.data]
        if not filter_doc_ids:
            return []

    query = db.table("documents").select(_SELECT_COLS)

    if filter_doc_ids is not None:
        query = query.in_("id", filter_doc_ids)
    if status:
        query = query.eq("status", status)

    if sort == "score":
        query = query.order("relevance_score", desc=True, nullsfirst=False)
    else:
        query = query.order("uploaded_at", desc=True)

    rows = query.execute().data
    docs = [_to_response(row) for row in rows]

    if q:
        q_low = q.lower()
        docs = [
            d for d in docs
            if (d.title and q_low in d.title.lower())
            or (d.summary and q_low in d.summary.lower())
        ]

    return docs
