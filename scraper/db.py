"""
SQLite schema + helper functions shared by the scraper and (read-only) by the
Node backend. SQLite was chosen over Postgres/Mongo per the assessment's
"any of these are fine" note -- it keeps local setup to zero extra services
while still being a real relational store the Node API queries directly.
"""
import sqlite3
import os
import hashlib
import json
from datetime import datetime, timezone

DB_PATH = os.environ.get("NEWS_PULSE_DB", os.path.join(os.path.dirname(__file__), "..", "data", "news_pulse.db"))
DB_PATH = os.path.abspath(DB_PATH)


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")  # so Node can read while Python writes
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,           -- sha256(url) -- dedupe key across runs
            source TEXT NOT NULL,
            headline TEXT NOT NULL,
            summary TEXT,
            body TEXT,
            body_extraction_ok INTEGER DEFAULT 0,
            url TEXT NOT NULL,
            published_at TEXT,             -- ISO 8601 UTC, normalized from feed
            fetched_at TEXT NOT NULL,
            cluster_id TEXT,
            sentiment TEXT                 -- positive | negative | neutral
        );

        CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            keywords TEXT,                 -- JSON list of top shared keywords
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ingest_jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,          -- queued | running | completed | failed
            started_at TEXT,
            finished_at TEXT,
            message TEXT,
            articles_added INTEGER DEFAULT 0,
            clusters_total INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(cluster_id);
        CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
        """
    )
    conn.commit()
    conn.close()


def article_id_for_url(url: str) -> str:
    return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()[:24]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def article_exists(conn, article_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM articles WHERE id = ?", (article_id,)).fetchone()
    return row is not None


def insert_article(conn, article: dict):
    conn.execute(
        """
        INSERT OR IGNORE INTO articles
            (id, source, headline, summary, body, body_extraction_ok, url, published_at, fetched_at, cluster_id, sentiment)
        VALUES (:id, :source, :headline, :summary, :body, :body_extraction_ok, :url, :published_at, :fetched_at, NULL, :sentiment)
        """,
        article,
    )


def reset_clusters(conn):
    """Clear previous cluster assignments before regrouping (grouping is recomputed
    over the full article set each run -- simplest correct approach for this scope)."""
    conn.execute("DELETE FROM clusters")
    conn.execute("UPDATE articles SET cluster_id = NULL")


def insert_cluster(conn, cluster_id: str, label: str, keywords: list, article_ids: list):
    ts = now_iso()
    conn.execute(
        "INSERT INTO clusters (id, label, keywords, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (cluster_id, label, json.dumps(keywords), ts, ts),
    )
    conn.executemany(
        "UPDATE articles SET cluster_id = ? WHERE id = ?",
        [(cluster_id, aid) for aid in article_ids],
    )


def start_job(conn, job_id: str):
    conn.execute(
        "INSERT OR REPLACE INTO ingest_jobs (id, status, started_at, finished_at, message, articles_added, clusters_total) "
        "VALUES (?, 'running', ?, NULL, NULL, 0, 0)",
        (job_id, now_iso()),
    )
    conn.commit()


def finish_job(conn, job_id: str, status: str, message: str, articles_added: int, clusters_total: int):
    conn.execute(
        "UPDATE ingest_jobs SET status=?, finished_at=?, message=?, articles_added=?, clusters_total=? WHERE id=?",
        (status, now_iso(), message, articles_added, clusters_total, job_id),
    )
    conn.commit()
