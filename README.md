# News Pulse — Topic-Clustered News Timeline
🌐 Live Demo: https://news-pulse-drab.vercel.app/

News Pulse is a full-stack news aggregation system built for the Xponentium India Internship assessment. It collects articles from multiple RSS feeds, groups related articles into topic clusters using keyword-overlap clustering, and visualizes them in an interactive timeline.

---
# Project Structure

```
news-pulse/
│
├── scraper/
│   ├── run.py              # Runs the complete pipeline
│   ├── ingest.py           # Fetches and normalizes RSS feeds
│   ├── grouping.py         # Keyword-overlap topic clustering
│   ├── db.py               # Database schema and operations
│   ├── feeds.py            # RSS feed configuration
│   └── requirements.txt
│
├── backend/
│   ├── server.js           # Express server
│   ├── routes/             # REST API endpoints
│   ├── db.js               # SQLite connection
│   ├── controllers/
│   └── package.json
│
├── frontend/
│   ├── app/                # Next.js App Router
│   ├── components/         # Timeline and UI components
│   ├── lib/                # API utilities
│   ├── styles/
│   └── package.json
│
└── README.md
```

---

# Workflow

```
               RSS Feeds
      (BBC, Guardian, Al Jazeera)
                    │
                    ▼
        Fetch & Normalize Articles
            (Python Scraper)
                    │
                    ▼
      Extract Full Article Content
     (Trafilatura → BeautifulSoup)
                    │
                    ▼
      Store Articles in SQLite (WAL)
                    │
                    ▼
      Keyword Overlap Clustering
          (Union-Find Algorithm)
                    │
                    ▼
        Generate Topic Clusters
                    │
                    ▼
        Node.js REST API Layer
                    │
                    ▼
      Next.js Timeline Dashboard
                    │
                    ▼
    Filter • Explore • Refresh News
```

### Workflow Summary

1. The scraper fetches articles from multiple RSS feeds.
2. Feed data is normalized into a common format.
3. Full article content is extracted using **Trafilatura**, with **BeautifulSoup** as a fallback.
4. Articles are stored in a shared SQLite database using SHA256-based deduplication.
5. Related articles are grouped into topic clusters using keyword-overlap clustering.
6. The Express backend exposes clustered data through REST APIs.
7. The Next.js frontend displays clustered news on an interactive timeline with filtering and refresh functionality.

# Setup Instructions

## 1. Clone the repository

```bash
git clone <repository-url>
cd news-pulse
```

## 2. Start the Scraper

```bash
cd scraper
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt

python run.py
```

## 3. Start the Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

## 4. Start the Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

---

# Architecture Overview

```
RSS Feeds
    │
    ▼
Python Scraper
(Feed Parsing + Article Extraction)
    │
    ▼
Keyword Overlap Clustering
    │
    ▼
SQLite Database (WAL)
    │
    ▼
Node.js REST API
    │
    ▼
Next.js Timeline Dashboard
```

The scraper fetches and normalizes RSS articles, extracts full article content, groups related stories into topic clusters, and stores the processed data in a shared SQLite database. The Node.js backend exposes REST APIs, while the Next.js frontend visualizes clustered news on an interactive timeline.

---

# Topic Grouping Approach

This project uses **Keyword Overlap Clustering (Option A)**.

Each article is tokenized using its headline and summary. After removing stopwords and short words, articles sharing **three or more meaningful keywords** are grouped into the same topic cluster. Clusters are built using a Union-Find algorithm, allowing transitive grouping across multiple related articles.

### Limitations

- Cannot detect semantic similarity or synonyms.
- Articles describing the same event with different wording may not be grouped together.
- An embedding or TF-IDF based approach would improve clustering accuracy but adds additional complexity.

---

# News Sources

The application collects articles from the following RSS feeds:

- BBC News
- The Guardian
- Al Jazeera

These sources were selected because they use different RSS feed structures, allowing the scraper to demonstrate normalization across varying feed formats.



