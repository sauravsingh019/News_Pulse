"""
Part 1a -- pull from multiple RSS sources, normalize into one schema, fetch
full article body, and store new articles (dedup by URL hash, so re-running
this script is safe and only adds what's new).
"""
import logging
import re
import feedparser
import trafilatura
import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from datetime import timezone

from db import get_conn, init_db, article_id_for_url, article_exists, insert_article, now_iso
from feeds import FEEDS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ingest")

REQUEST_HEADERS = {"User-Agent": "NewsPulseBot/1.0 (+internship-assessment)"}
REQUEST_TIMEOUT = 10

POSITIVE_WORDS = {
    "progress", "boost", "growth", "grow", "success", "succeed", "win", "winner", "won", "improve",
    "improvement", "advance", "advancement", "positive", "optimistic", "recovery", "recover",
    "achievement", "achieve", "gain", "increase", "breakthrough", "hope", "hopeful", "peace",
    "agreement", "support", "save", "safe", "secured", "benefit", "good", "great", "excellent"
}
NEGATIVE_WORDS = {
    "warn", "warning", "risk", "danger", "dangerous", "threat", "threaten", "crisis", "fail",
    "failure", "drop", "decline", "fall", "loss", "lost", "damage", "hurt", "kill", "die", "death",
    "dead", "clash", "protest", "strike", "attack", "bomb", "explosion", "explode", "wound",
    "injured", "injury", "crash", "collapse", "arrest", "charge", "suspect", "fear", "scare",
    "worry", "concern", "concerned", "disease", "outbreak", "virus", "infection", "illness",
    "disaster", "flood", "earthquake", "storm", "wildfire", "fire", "destroy", "destruction",
    "accuse", "allegation", "allege", "investigate", "investigation", "trial", "guilty", "sentence",
    "ban", "block", "reject", "deny", "prohibit", "dispute", "conflict", "war", "battle",
    "fight", "tension", "inflation", "recession", "unemployment", "poverty", "bad", "worst"
}

def analyze_sentiment(text: str) -> str:
    words = re.findall(r"[a-zA-Z']+", text.lower())
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)
    if pos > neg:
        return "positive"
    elif neg > pos:
        return "negative"
    return "neutral"


def normalize_date(entry) -> str | None:
    """Feeds disagree on where the date lives and how it's formatted.
    Try the structured fields feedparser gives us first, then fall back to
    parsing whatever raw string is present. Missing/unparseable -> None
    rather than crashing the run."""
    for field in ("published", "updated", "pubDate"):
        raw = entry.get(field)
        if raw:
            try:
                dt = dateparser.parse(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
            except (ValueError, TypeError, OverflowError):
                continue
    return None


def normalize_summary(entry) -> str:
    # Different feeds put the summary in different fields:
    # <description> (BBC/Al Jazeera) vs <content:encoded> (Guardian) vs .summary (feedparser's own guess)
    if entry.get("content"):
        try:
            html = entry["content"][0].get("value", "")
            return BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
        except Exception:
            pass
    for field in ("summary", "description"):
        raw = entry.get(field)
        if raw:
            return BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)
    return ""


def extract_full_body(url: str) -> tuple[str | None, bool]:
    """Fetch the article page and pull the main body text. trafilatura first
    (handles boilerplate removal well), plain BeautifulSoup paragraph-join as
    a fallback. Any failure here is non-fatal -- we keep the summary and move on."""
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
            if text and len(text) > 200:
                return text, True
    except Exception as e:
        log.warning("trafilatura failed for %s: %s", url, e)

    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        text = "\n".join(p for p in paragraphs if len(p) > 40)
        if text:
            return text, True
    except Exception as e:
        log.warning("fallback bs4 extraction failed for %s: %s", url, e)

    return None, False


def run_ingest(fetch_full_body: bool = True, limit_per_feed: int = 30) -> int:
    """Returns the number of NEW articles inserted this run."""
    init_db()
    conn = get_conn()
    added = 0

    for feed in FEEDS:
        source, url = feed["source"], feed["url"]
        log.info("Fetching feed: %s", source)
        try:
            parsed = feedparser.parse(url)
        except Exception as e:
            log.error("Could not fetch feed %s (%s): %s", source, url, e)
            continue

        if parsed.bozo and not parsed.entries:
            log.warning("Feed %s appears malformed and returned no entries", source)
            continue

        for entry in parsed.entries[:limit_per_feed]:
            article_url = entry.get("link")
            headline = entry.get("title", "").strip()
            if not article_url or not headline:
                continue

            aid = article_id_for_url(article_url)
            if article_exists(conn, aid):
                continue  # already have it -- re-runnable without duplicates

            summary = normalize_summary(entry)
            published_at = normalize_date(entry)

            body, body_ok = (None, False)
            if fetch_full_body:
                body, body_ok = extract_full_body(article_url)

            sentiment = analyze_sentiment(f"{headline} {summary}")

            insert_article(
                conn,
                {
                    "id": aid,
                    "source": source,
                    "headline": headline,
                    "summary": summary,
                    "body": body,
                    "body_extraction_ok": 1 if body_ok else 0,
                    "url": article_url,
                    "published_at": published_at,
                    "fetched_at": now_iso(),
                    "sentiment": sentiment,
                },
            )
            added += 1

        conn.commit()
        log.info("%s: %d new articles this run", source, added)

    conn.close()
    log.info("Ingest complete. %d new articles added.", added)
    return added


if __name__ == "__main__":
    run_ingest()
