import logging

from supabase import Client, create_client

from config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        logger.info("Initialising Supabase client")
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client
