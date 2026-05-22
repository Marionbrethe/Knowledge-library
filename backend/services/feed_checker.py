import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_RSS_SUFFIXES = ["", "/feed", "/rss", "/feed.xml", "/atom.xml", "/rss.xml", "/feed/", "/index.xml", "?format=rss"]
_HEADERS = {"User-Agent": "LichenAI-Monitor/1.0"}


async def _fetch(url: str, timeout: int = 10) -> Optional[str]:
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
        try:
            r = await client.get(url, headers=_HEADERS)
            r.raise_for_status()
            return r.text
        except Exception as exc:
            logger.debug("Fetch failed %s: %s", url, exc)
            return None


def _parse_feed_content(content: str) -> list[dict]:
    feed = feedparser.parse(content)
    if not feed.entries:
        return []
    results = []
    for entry in feed.entries[:30]:
        url = entry.get("link")
        if not url:
            continue
        published = None
        for attr in ("published_parsed", "updated_parsed"):
            t = entry.get(attr)
            if t:
                try:
                    published = datetime(*t[:6], tzinfo=timezone.utc)
                except Exception:
                    pass
                break
        results.append({"title": (entry.get("title") or "")[:300], "url": url, "published_at": published})
    return results


def _scrape_from_html(base_url: str, html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc
    seen: set[str] = set()
    articles = []
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "javascript:")):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        if parsed.netloc != base_domain or full_url in seen:
            continue
        path = parsed.path
        parts = [p for p in path.split("/") if p]
        if not parts:
            continue
        last = parts[-1]
        if len(last) < 10:
            continue
        ext = last.rsplit(".", 1)[-1] if "." in last else ""
        if ext and ext not in ("html", "htm", "php"):
            continue
        title = a.get_text(strip=True)
        if not title or len(title) < 10:
            continue
        seen.add(full_url)
        articles.append({"title": title[:300], "url": full_url, "published_at": None})
        if len(articles) >= 25:
            break
    return articles


async def fetch_articles_from_source(url: str) -> list[dict]:
    """Try RSS/Atom variants concurrently; fall back to HTML scraping."""
    base = url.rstrip("/")

    async def try_rss(suffix: str) -> list[dict]:
        content = await _fetch(base + suffix)
        return _parse_feed_content(content) if content else []

    results = await asyncio.gather(*[try_rss(s) for s in _RSS_SUFFIXES], return_exceptions=True)
    for r in results:
        if isinstance(r, list) and r:
            return r

    html = await _fetch(base)
    return _scrape_from_html(base, html) if html else []
