require("dotenv").config();
const express = require("express");
const cors = require("cors");

const clustersRouter = require("./routes/clusters");
const timelineRouter = require("./routes/timeline");
const ingestRouter = require("./routes/ingest");

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Basic request log -- helpful when reviewing a deployed instance's logs
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/", (_req, res) => {
  res.json({ service: "news-pulse-backend", status: "ok" });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/clusters", clustersRouter);
app.use("/timeline", timelineRouter);
app.use("/ingest", ingestRouter);

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Centralized error handler -- keeps route files free of try/catch boilerplate noise
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`News Pulse backend listening on port ${PORT}`);
});
