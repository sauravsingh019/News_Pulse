
# News Pulse — Topic-Clustered News Timeline

News Pulse is a full-stack news aggregation platform that collects articles from multiple RSS feeds, automatically groups related stories into topic clusters using keyword-overlap clustering, and presents them through an interactive timeline interface.

The project demonstrates end-to-end data ingestion, processing, clustering, API development, and visualization using a shared SQLite database.

---

# Project Structure

```text
news-pulse/
│
├── scraper/      Python – RSS ingestion, article extraction & topic clustering
├── backend/      Node.js + Express REST API
├── frontend/     Next.js + React Timeline Dashboard
└── database/     SQLite (shared storage)
```

---

# System Architecture

```text
                  ┌────────────────────┐
                  │     RSS Feeds      │
                  │ BBC • Guardian • AJ│
                  └─────────┬──────────┘
                            │
                            ▼
                scraper/ingest.py
         Feed Parsing & Article Extraction
                            │
                            ▼
                 scraper/grouping.py
          Keyword Overlap Topic Clustering
                            │
                            ▼
                 SQLite Database (WAL)
                            ▲
                ┌───────────┴───────────┐
                │                       │
                │                       │
        Node.js REST API          Python Pipeline
                │
                ▼
        Next.js Frontend Timeline
```

---

# Application Workflow

```text
RSS Feeds
    │
    ▼
Fetch RSS Articles
    │
    ▼
Normalize Feed Data
    │
    ▼
Extract Full Article Content
(Trafilatura → BeautifulSoup Fallback)
    │
    ▼
Store Articles in SQLite
(Deduplicated using SHA256(URL))
    │
    ▼
Keyword Overlap Clustering
(Union-Find Algorithm)
    │
    ▼
Generate Topic Clusters
    │
    ▼
Expose Data via REST API
    │
    ▼
Interactive Timeline UI
```

---

# Technology Stack

| Layer              | Technology                   |
| ------------------ | ---------------------------- |
| Frontend           | Next.js, React               |
| Backend            | Node.js, Express             |
| Scraper            | Python                       |
| Database           | SQLite (WAL Mode)            |
| Article Extraction | Trafilatura, BeautifulSoup   |
| Clustering         | Keyword Overlap + Union Find |

---

# Why SQLite?

Although the assessment allowed SQLite, PostgreSQL, or MongoDB, SQLite running in **Write-Ahead Logging (WAL)** mode was selected because it:

* Requires zero infrastructure setup
* Supports concurrent reads and writes
* Simplifies local development and deployment
* Is sufficient for the scale of this assessment

Python owns the database schema, while the Node.js backend simply consumes the generated data.

---

# Data Processing Pipeline

## 1. RSS Ingestion

Articles are collected from:

* BBC News
* The Guardian
* Al Jazeera

These feeds intentionally use different RSS formats, allowing the ingestion layer to normalize varying schemas, date formats, and content structures.

---

## 2. Full Article Extraction

Each article undergoes full-text extraction using:

1. **Trafilatura** (primary extractor)
2. **BeautifulSoup** (fallback)

Failed extractions are logged without interrupting the pipeline.

---

## 3. Deduplication

Each article is uniquely identified using:

```
SHA256(article_url)
```

The scraper performs:

```
INSERT OR IGNORE
```

making the pipeline completely re-runnable without inserting duplicate records.

---

## 4. Topic Clustering

The project implements **Option A – Keyword Overlap Clustering**.

### Process

* Headlines and summaries are tokenized
* Stopwords are removed
* Words shorter than three characters are discarded
* Articles sharing **3 or more meaningful keywords** are grouped together

A configurable threshold (`OVERLAP_THRESHOLD`) is used rather than hardcoded logic.

---

### Why Keyword Overlap?

Compared to TF-IDF or embedding-based approaches, keyword overlap provides:

* Simplicity
* Transparency
* Easy debugging
* Explainable clustering decisions

This aligns well with the assessment's emphasis on correctness over complexity.

---

### Union-Find Clustering

Clusters are formed transitively using the Union-Find algorithm.

Example:

```
Article A ↔ Article B
Article B ↔ Article C

↓

Cluster:
A, B, C
```

Even if Articles A and C share few direct keywords, they belong to the same topic through transitive relationships.

---

### Current Limitation

Keyword matching cannot detect semantic similarity.

For example:

```
"Senate passes bill"

and

"Upper chamber approves legislation"
```

describe the same event but would not cluster because they share no literal keywords.

Embedding-based approaches could improve this in future iterations.

---

# Backend API

| Endpoint                  | Description                       |
| ------------------------- | --------------------------------- |
| GET /clusters             | Returns all topic clusters        |
| GET /clusters/:id         | Returns articles within a cluster |
| GET /timeline             | Timeline visualization data       |
| POST /ingest/trigger      | Starts ingestion pipeline         |
| GET /ingest/status/:jobId | Returns ingestion progress        |

The backend never performs clustering itself—it simply serves the latest processed results generated by the Python pipeline.

---

# Frontend Features

* Interactive timeline visualization
* Topic cluster explorer
* Article detail panel
* Source-based filtering
* Manual data refresh
* Auto-refresh mode
* Responsive dark-themed interface

The timeline is implemented as a custom visualization rather than using a charting library, allowing greater flexibility and lightweight rendering.

---

# Deployment Architecture

| Component | Platform                           |
| --------- | ---------------------------------- |
| Frontend  | Vercel                             |
| Backend   | Render / Railway                   |
| Scraper   | Same server as Backend or Cron Job |
| Database  | SQLite on Persistent Volume        |

The scraper can be executed either manually through the API or periodically using a scheduled cron job.

---

# Future Improvements

* Semantic clustering using sentence embeddings
* TF-IDF similarity scoring
* Named Entity Recognition (NER)
* Redis-based job queue
* PostgreSQL migration for horizontal scaling
* Scheduled background ingestion
* Real-time updates using WebSockets

---



