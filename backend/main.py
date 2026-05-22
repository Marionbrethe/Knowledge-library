import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import categories, documents, explore, monitoring, notes, query

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LichenAI Knowledge Library API",
    description="Backend for the LichenAI team knowledge base",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(explore.router)
app.include_router(categories.router)
app.include_router(notes.router)
app.include_router(query.router)
app.include_router(monitoring.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
