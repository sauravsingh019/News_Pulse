const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /clusters -- label, article count, time range per cluster
router.get("/", (req, res, next) => {
  try {
    const { source } = req.query;

    let clusters = db
      .prepare(
        `SELECT id, label, keywords, created_at, updated_at FROM clusters ORDER BY updated_at DESC`
      )
      .all();

    const articleStmt = source
      ? db.prepare(
          `SELECT source, published_at FROM articles WHERE cluster_id = ? AND source = ?`
        )
      : db.prepare(`SELECT source, published_at FROM articles WHERE cluster_id = ?`);

    const result = clusters
      .map((c) => {
        const rows = source ? articleStmt.all(c.id, source) : articleStmt.all(c.id);
        if (rows.length === 0) return null; // filtered out entirely by source filter

        const timestamps = rows.map((r) => r.published_at).filter(Boolean).sort();
        return {
          id: c.id,
          label: c.label,
          keywords: JSON.parse(c.keywords || "[]"),
          article_count: rows.length,
          sources: [...new Set(rows.map((r) => r.source))],
          time_range: {
            start: timestamps[0] || null,
            end: timestamps[timestamps.length - 1] || null,
          },
        };
      })
      .filter(Boolean);

    res.json({ count: result.length, clusters: result });
  } catch (err) {
    next(err);
  }
});

// GET /clusters/:id -- full detail, articles sorted chronologically
router.get("/:id", (req, res, next) => {
  try {
    const cluster = db.prepare(`SELECT * FROM clusters WHERE id = ?`).get(req.params.id);
    if (!cluster) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    const articles = db
      .prepare(
        `SELECT id, source, headline, summary, body, sentiment, url, published_at, body_extraction_ok
         FROM articles WHERE cluster_id = ? ORDER BY published_at ASC`
      )
      .all(req.params.id);

    res.json({
      id: cluster.id,
      label: cluster.label,
      keywords: JSON.parse(cluster.keywords || "[]"),
      created_at: cluster.created_at,
      updated_at: cluster.updated_at,
      article_count: articles.length,
      articles,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
