const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /timeline -- clusters shaped for plotting: label, start/end, article
// count, and a size/intensity metric. A raw list of dated items is NOT
// what a timeline/gantt-style charting lib wants -- it wants explicit
// start/end so each cluster can render as a spanning block.
router.get("/", (req, res, next) => {
  try {
    const clusters = db.prepare(`SELECT id, label, keywords FROM clusters`).all();
    const articleStmt = db.prepare(
      `SELECT source, published_at, sentiment FROM articles WHERE cluster_id = ?`
    );

    let maxCount = 1;
    const items = clusters
      .map((c) => {
        const rows = articleStmt.all(c.id);
        const timestamps = rows.map((r) => r.published_at).filter(Boolean).sort();
        if (timestamps.length === 0) return null;

        const count = rows.length;
        maxCount = Math.max(maxCount, count);

        const start = new Date(timestamps[0]);
        const end = new Date(timestamps[timestamps.length - 1]);
        const spanHours = (end - start) / (1000 * 60 * 60);
        const isTrending = count >= 3 && (spanHours <= 24 || count >= 5);

        const sentiments = rows.map((r) => r.sentiment || "neutral");
        const posCount = sentiments.filter((s) => s === "positive").length;
        const negCount = sentiments.filter((s) => s === "negative").length;
        const dominantSentiment = posCount > negCount ? "positive" : (negCount > posCount ? "negative" : "neutral");

        return {
          cluster_id: c.id,
          label: c.label,
          keywords: JSON.parse(c.keywords || "[]"),
          start: timestamps[0],
          end: timestamps[timestamps.length - 1],
          article_count: count,
          sources: [...new Set(rows.map((r) => r.source))],
          is_trending: isTrending,
          dominant_sentiment: dominantSentiment,
        };
      })
      .filter(Boolean);

    // Intensity: 0-1 scale relative to the largest cluster this run, so the
    // frontend can size/color markers without recomputing the max itself.
    const timeline = items.map((i) => ({
      ...i,
      intensity: Number((i.article_count / maxCount).toFixed(2)),
    }));

    timeline.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json({ count: timeline.length, timeline });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
