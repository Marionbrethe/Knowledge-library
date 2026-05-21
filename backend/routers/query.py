from fastapi import APIRouter

router = APIRouter(prefix="/query", tags=["query"])


@router.post("/", summary="Conversational query across the knowledge base (Phase 4)")
async def query_library():
    """Vector search + Claude synthesis. Implemented in Phase 4."""
    return {"detail": "Coming in Phase 4"}
