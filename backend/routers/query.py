import logging
from typing import Optional

import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings
from database import get_db
from services.embedder import generate_embedding

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])

_claude: anthropic.AsyncAnthropic | None = None


def _get_claude() -> anthropic.AsyncAnthropic:
    global _claude
    if _claude is None:
        _claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _claude


SYSTEM_PROMPT = (
    "You are a research assistant for LichenAI. Answer questions "
    "using only the provided source documents. Always cite which "
    "document(s) your answer draws from by title. If the answer "
    "cannot be found in the sources, say so clearly."
)


class ConversationMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class QueryRequest(BaseModel):
    question: str
    conversation_history: list[ConversationMessage] = []


class SourceDocument(BaseModel):
    id: str
    title: Optional[str] = None
    url: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceDocument]


@router.post("/", response_model=QueryResponse, summary="Conversational query across the knowledge base")
async def query_library(request: QueryRequest):
    db = get_db()

    # 1. Embed the question
    embedding = await generate_embedding(request.question)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    # 2. Vector search via pgvector RPC (requires match_documents_by_text from phase4_patch.sql)
    try:
        rpc_result = db.rpc(
            "match_documents_by_text",
            {"query_embedding": embedding_str, "match_count": 5},
        ).execute()
        matched = rpc_result.data or []
    except Exception as exc:
        logger.warning("pgvector search failed: %s", exc)
        matched = []

    if not matched:
        return QueryResponse(
            answer=(
                "I couldn't find any relevant documents in the library for that question. "
                "Try adding more documents first, or rephrase your question."
            ),
            sources=[],
        )

    # 3. Build context from matched documents (title + summary + first 1000 chars of raw content)
    context_blocks = []
    for doc in matched:
        title = doc.get("title") or "Untitled"
        summary = doc.get("summary") or ""
        raw = (doc.get("raw_content") or "")[:1000]
        context_blocks.append(f"## {title}\n{summary}\n\n{raw}")

    context = "\n\n---\n\n".join(context_blocks)
    user_content = f"{request.question}\n\n<sources>\n{context}\n</sources>"

    # 4. Build full message list: history + new question with context
    messages = [{"role": m.role, "content": m.content} for m in request.conversation_history]
    messages.append({"role": "user", "content": user_content})

    # 5. Call Claude
    response = await _get_claude().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    answer = response.content[0].text
    sources = [
        SourceDocument(id=str(doc["id"]), title=doc.get("title"), url=doc.get("url"))
        for doc in matched
    ]

    logger.info("Query answered using %d source(s)", len(sources))
    return QueryResponse(answer=answer, sources=sources)
