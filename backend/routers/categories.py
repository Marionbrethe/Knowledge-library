import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database import get_db
from models.schemas import CategoryCreate, CategoryResponse, CategoryUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse], summary="List all categories")
async def list_categories(
    type: Optional[str] = Query(
        None,
        pattern="^(topic|use_case)$",
        description="Filter by type: topic or use_case",
    ),
):
    db = get_db()
    query = db.table("categories").select("*").order("name")
    if type:
        query = query.eq("type", type)
    result = query.execute()
    return [CategoryResponse(**row) for row in result.data]


@router.post("/", response_model=CategoryResponse, status_code=201, summary="Create a category or use-case tag")
async def create_category(payload: CategoryCreate):
    if payload.type not in ("topic", "use_case"):
        raise HTTPException(status_code=422, detail="type must be 'topic' or 'use_case'")

    db = get_db()

    existing = (
        db.table("categories")
        .select("id")
        .eq("name", payload.name)
        .eq("type", payload.type)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="A category with this name and type already exists",
        )

    row = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "type": payload.type,
        "created_by": payload.created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "description": payload.description,
    }
    result = db.table("categories").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create category")

    return CategoryResponse(**result.data[0])


@router.patch("/{category_id}", response_model=CategoryResponse, summary="Update a category's name or description")
async def update_category(category_id: str, payload: CategoryUpdate):
    db = get_db()

    existing = db.table("categories").select("*").eq("id", category_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return CategoryResponse(**existing.data[0])

    result = db.table("categories").update(updates).eq("id", category_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update category")

    return CategoryResponse(**result.data[0])
