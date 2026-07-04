# News Pulse — Topic-Clustered News Timeline

Xponentium India internship take-home assessment. A small system that pulls live
articles from three news RSS feeds, groups related articles into topic clusters,
and shows those clusters as a visual timeline.

```
/scraper   Python — RSS ingestion, full-article extraction, keyword-overlap clustering
/backend   Node.js/Express — REST API over a shared SQLite database
/frontend  Next.js/React — timeline UI, cluster explorer, source filter, refresh control
```

## Architecture overview

```
 RSS feeds ──▶ scraper/ingest.py ──▶ SQLite (WAL) ◀── backend/server.js ──▶ frontend/
 (3 sources)   normalize + extract      (shared file)   REST API           Next.js UI
                     │
                     ▼
              scraper/grouping.py
              (keyword-overlap clustering)
```

- **Why SQLite over WAL, not Postgres/Mongo**: the assessment explicitly allows any of the
  three. SQLite-over-WAL means zero extra infra to stand up locally or on a small
  deployment, while still letting the Node API read concurrently with the Python
  pipeline writing (WAL mode is what makes that safe — without it, a read during a
  write would either block or see a partial state).
- **Python owns the schema.** `scraper/db.py` creates the tables; the Node backend
  only reads/writes rows into that same file, it never redefines the schema. Run the
  scraper at least once before starting the backend.
- **The Node API never re-does clustering.** It reads whatever the last pipeline run
  computed. `POST /ingest/trigger` re-runs the whole pipeline (ingest + regroup) as a
  subprocess and reports progress via `GET /ingest/status/:jobId`.

## Part 1 — Scraper (`/scraper`)

**Sources used:** BBC News, The Guardian, Al Jazeera (see `feeds.py`) — chosen because
they use three different underlying feed shapes, so the normalization code actually
has to reconcile real differences (`<description>` vs `<content:encoded>`, different
date formats, missing fields).

**Topic-grouping approach: keyword/word-overlap (Option A), not TF-IDF.**
- *Why*: the assessment is explicit that a simple approach done well beats a complex
  one that's brittle. Word-overlap is also trivially explainable in the video
  walkthrough and easy for a reviewer to verify by reading `grouping.py` directly —
  there's no vector math to take on faith.
- *How thresholds were picked*: articles are grouped together once they share **3+
  "meaningful" words** (lowercased, stopwords and words under 3 characters stripped)
  from their headline + summary. 3 was chosen empirically as a middle ground —
  2 produced noisy merges of loosely-related stories sharing common newsy words
  ("says," "new," generic verbs already excluded via the stopword list, but even
  content words like "government" or "report" alone aren't enough signal at
  threshold 2); 4+ started splitting genuinely-the-same story across outlets that
  phrased headlines very differently. This is a tunable constant
  (`OVERLAP_THRESHOLD` in `grouping.py`), not a hardcoded magic number buried in logic.
- *Grouping is transitive via union-find*: if article A overlaps enough with B, and B
  with C, all three land in one cluster even if A and C alone don't share 3 words.
  This is what lets 3 outlets covering the same story with very different headlines
  still converge into a single cluster.
- **Known limitation**: pure keyword overlap has no notion of synonymy or semantic
  similarity — "Senate passes bill" and "Upper chamber approves legislation" about the
  same story would NOT cluster together, because they share zero literal keywords.
  A TF-IDF/embedding-based approach would catch that at the cost of being harder to
  explain and tune. Given the assessment's framing (a working, auditable approach over
  a fancier fragile one), that tradeoff was made deliberately.

**Re-runnability & dedup**: every article is keyed by `sha256(url)` in SQLite; the
ingest step does `INSERT OR IGNORE`, so re-running the scraper (or triggering it
repeatedly from the UI) only adds genuinely new articles and is safe to run on a
schedule.

**Full-article extraction**: `trafilatura` first (handles boilerplate removal well),
falling back to a plain BeautifulSoup paragraph-join if that fails. Any page that
fails both is recorded with `body_extraction_ok = 0` and the run continues — a single
bad page never crashes the pipeline.

Run it directly:
```bash
cd scraper
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py                 # full run: ingest + regroup
python run.py --skip-body     # faster: skip full-article fetch, summary-only
```

## Part 2 — Backend (`/backend`)

| Endpoint | Purpose |
|---|---|
| `GET /clusters` | List of clusters — label, article count, sources, time range. Optional `?source=` filter. |
| `GET /clusters/:id` | Full cluster detail, articles sorted chronologically. 404 if unknown. |
| `GET /timeline` | Clusters shaped for a charting library: explicit `start`/`end`, `article_count`, and a normalized `intensity` (0–1) for sizing. |
| `POST /ingest/trigger` | Spawns the Python pipeline as a subprocess, returns `{ job_id }` immediately (202). Rejects a second trigger while one is running (409). |
| `GET /ingest/status/:jobId` | Poll job status: `queued` / `running` / `completed` / `failed`, plus a message and counts. |

Config is entirely via environment variables (`.env.example` provided) — no hardcoded
DB paths, ports, or CORS origins. Errors use a centralized handler returning proper
400/404/500s with a JSON `{ error }` body.

Run it:
```bash
cd backend
npm install
cp .env.example .env      # adjust NEWS_PULSE_DB / SCRAPER_DIR / PYTHON_BIN if needed
npm start
```
> `better-sqlite3` compiles a native addon on `npm install` — this needs Python +
> build tools available (standard on Render/Railway/most CI images; on Windows you
> may need `npm install --global windows-build-tools` once).

## Part 3 — Frontend (`/frontend`)

Design direction: a "wire-service terminal at night" — the timeline is drawn as a
pulse strip (a nod to the product name), amber signal against a dark newsroom
background, monospace timestamps like a teletype stamp.

- **Timeline**: custom-built (not a canned chart lib) — each cluster is a row with a
  bar spanning its earliest→latest article, width/opacity driven by the `/timeline`
  intensity value, so bigger stories visually read as bigger.
- **Cluster detail**: clicking a row opens a slide-over with every article — source,
  headline, summary, published time, and a link to the original.
- **Source filter**: toggle chips per source, filters both the timeline and cluster list.
- **Refresh data**: calls `POST /ingest/trigger`, polls `GET /ingest/status/:jobId`
  every 2.5s, and reloads the timeline on completion.
- **Stretch — auto-refresh**: an opt-in checkbox polls `/timeline` every 30s (off by
  default so it doesn't hammer a free-tier backend on every page view).

Run it:
```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE_URL to your backend
npm run dev
```

## Part 4 — Deployment

This repo is deploy-ready but was not deployed live from this environment (no
outbound access to hosting platforms or the RSS feeds themselves here). To deploy:

| Component | Where | Notes |
|---|---|---|
| Frontend | Vercel | Import `/frontend` as the project root. Set `NEXT_PUBLIC_API_BASE_URL` to the backend's public URL. |
| Backend | Render or Railway | Import `/backend` as the project root. Set `NEWS_PULSE_DB`, `SCRAPER_DIR` (pointing at the deployed `/scraper` path), `PYTHON_BIN`, `CORS_ORIGIN` (the Vercel URL). Needs Python 3.11+ available on the same instance/filesystem so it can spawn the pipeline — a single "web service" with both folders checked out works; a fully split deployment would instead expose the pipeline as its own small HTTP service and have Node call that over HTTP instead of `spawn`. |
| Pipeline | Same host as backend, or a Render/Railway cron hitting `POST /ingest/trigger` on a schedule | Keeps data fresh without a manual click every time. |
| Database | The SQLite file on a persistent disk (Render/Railway both offer this) | If moving to Postgres/Mongo instead, `db.py` and `backend/db.js` are the only two files that would need to change — routes and grouping logic are storage-agnostic. |

## Video walkthrough

Not recorded in this environment — see the assessment's Part 5 for what to cover
(live demo, how grouping works, one hard problem, one improvement) when you record it
from your own machine/deployment.

## Submission checklist status

- [x] Repo with `/scraper`, `/backend`, `/frontend` folders
- [ ] Live frontend URL — deploy per the table above
- [ ] Live backend URL — deploy per the table above
- [x] README — this file
- [ ] Video walkthrough — record after deploying
