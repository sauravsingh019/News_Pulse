"""
Entrypoint for the whole Python pipeline: ingest new articles, then regroup
ALL articles into clusters, writing job status as it goes so the Node API's
GET /ingest/status/:jobId can report progress.

Usage:
    python run.py --job-id <uuid>          # normal run, called by the backend
    python run.py                          # ad-hoc local run, no job tracking
"""
import argparse
import logging
import sys

from db import get_conn, init_db, reset_clusters, insert_cluster, start_job, finish_job
from ingest import run_ingest
from grouping import cluster_articles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("run")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default=None)
    parser.add_argument("--skip-body", action="store_true", help="Skip full-article fetch (faster, summary-only)")
    args = parser.parse_args()

    init_db()
    conn = get_conn()
    if args.job_id:
        start_job(conn, args.job_id)

    try:
        added = run_ingest(fetch_full_body=not args.skip_body)

        all_articles = conn.execute("SELECT id, headline, summary FROM articles").fetchall()
        articles_dicts = [dict(a) for a in all_articles]

        reset_clusters(conn)
        clusters = cluster_articles(articles_dicts)
        for c in clusters:
            insert_cluster(conn, c["id"], c["label"], c["keywords"], c["article_ids"])
        conn.commit()

        log.info("Regrouped %d articles into %d clusters", len(articles_dicts), len(clusters))

        if args.job_id:
            finish_job(
                conn, args.job_id, "completed",
                f"Added {added} new articles, regrouped into {len(clusters)} clusters.",
                added, len(clusters),
            )

    except Exception as e:
        log.exception("Pipeline failed")
        if args.job_id:
            finish_job(conn, args.job_id, "failed", str(e), 0, 0)
        conn.close()
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main()
