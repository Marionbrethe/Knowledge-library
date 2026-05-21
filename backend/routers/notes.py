import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from database import get_db
from models.schemas import NoteCreate, NoteResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notes"])


@router.post(
    "/documents/{document_id}/notes",
    response_model=NoteResponse,
    status_code=201,
    summary="Add a note or question to a document",
)
async def create_note(document_id: str, payload: NoteCreate):
    db = get_db()

    if not db.table("documents").select("id").eq("id", document_id).execute().data:
        raise HTTPException(status_code=404, detail="Document not found")

    row = {
        "id": str(uuid.uuid4()),
        "document_id": document_id,
        "content": payload.content,
        "added_by": payload.added_by,
        "added_at": datetime.now(timezone.utc).isoformat(),
        "is_question": payload.is_question,
    }
    result = db.table("notes").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create note")

    return NoteResponse(**result.data[0])


@router.get(
    "/documents/{document_id}/notes",
    summary="Get notes and questions for a document",
)
async def list_notes(document_id: str):
    db = get_db()

    if not db.table("documents").select("id").eq("id", document_id).execute().data:
        raise HTTPException(status_code=404, detail="Document not found")

    result = (
        db.table("notes")
        .select("*")
        .eq("document_id", document_id)
        .order("added_at")
        .execute()
    )

    notes = [NoteResponse(**r) for r in result.data if not r["is_question"]]
    questions = [NoteResponse(**r) for r in result.data if r["is_question"]]

    return {"notes": notes, "questions": questions}
