import logging
import re
from io import BytesIO

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r"https?://[^\s<>\"'{}|\\^\[\]`]+", re.IGNORECASE)

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LichenAI-Bot/1.0)"}


async def fetch_url_content(url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url, headers=_HEADERS)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "application/pdf" in content_type:
            return parse_pdf_content(response.content)

        soup = BeautifulSoup(response.text, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        lines = [line.strip() for line in soup.get_text(separator="\n").splitlines() if line.strip()]
        return "\n".join(lines)


def parse_pdf_content(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def extract_urls_from_text(text: str) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for url in _URL_RE.findall(text):
        url = url.rstrip(".,;:!?)")
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result
