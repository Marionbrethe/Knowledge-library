import logging

from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None

# text-embedding-3-small supports up to 8191 tokens; 32k chars is a safe char limit
_MAX_CHARS = 32_000


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_embedding(text: str) -> list[float]:
    response = await _get_client().embeddings.create(
        model="text-embedding-3-small",
        input=text[:_MAX_CHARS],
    )
    return response.data[0].embedding
