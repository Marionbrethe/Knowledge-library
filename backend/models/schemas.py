from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    type: str  # 'topic' | 'use_case'
    created_by: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    type: str
    created_by: str
    created_at: datetime
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    url: Optional[str] = None
    file_path: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    tension: Optional[str] = None
    relevance_score: Optional[int] = None
    relevance_reason: Optional[str] = None
    next_steps: Optional[list] = None
    auto_questions: Optional[list] = None
    status: str
    source_document_id: Optional[UUID] = None
    uploaded_by: str
    uploaded_at: datetime
    categories: list[CategoryResponse] = []

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    content: str
    added_by: str
    is_question: bool = False


class NoteResponse(BaseModel):
    id: UUID
    document_id: UUID
    content: str
    added_by: str
    added_at: datetime
    is_question: bool

    model_config = {"from_attributes": True}


class BulkImportRequest(BaseModel):
    raw_text: str
    uploaded_by: str


class BulkImportResponse(BaseModel):
    added_count: int
    duplicate_urls: list[str]
    added_documents: list[DocumentResponse]
