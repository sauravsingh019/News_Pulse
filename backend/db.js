const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, process.env.NEWS_PULSE_DB || "../data/news_pulse.db");

// Ensure the parent directory of the database exists so better-sqlite3 doesn't crash on startup
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// The Python pipeline owns schema creation. If it hasn't run yet, fail loudly
// with a clear message instead of a cryptic sqlite error.
if (!fs.existsSync(dbPath)) {
  console.warn(
    `[db] WARNING: ${dbPath} does not exist yet. Run the Python pipeline once ` +
      `("python run.py" inside /scraper) or call POST /ingest/trigger before ` +
      `hitting the read endpoints.`
  );
}

const db = new Database(dbPath, { fileMustExist: false });
db.pragma("journal_mode = WAL");

module.exports = db;
