const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const SCRAPER_DIR = path.resolve(__dirname, "..", process.env.SCRAPER_DIR || "../scraper");

// In-memory guard so a double-click doesn't spawn two pipelines at once.
// (Job *state* itself lives in SQLite -- this is just a lightweight lock.)
let jobInFlight = false;

// POST /ingest/trigger -- runs the Python pipeline as a subprocess, returns a job ID immediately
router.post("/trigger", (req, res, next) => {
  try {
    if (jobInFlight) {
      return res.status(409).json({ error: "An ingest job is already running. Poll its status or wait for it to finish." });
    }

    const jobId = uuidv4();
    const args = ["run.py", "--job-id", jobId];
    if (req.body && req.body.skipBody) args.push("--skip-body");

    // Insert the job into SQLite immediately to prevent race conditions during frontend polling
    db.prepare(
      "INSERT OR REPLACE INTO ingest_jobs (id, status, started_at, finished_at, message, articles_added, clusters_total) " +
      "VALUES (?, 'queued', ?, NULL, NULL, 0, 0)"
    ).run(jobId, new Date().toISOString());

    jobInFlight = true;
    const child = spawn(PYTHON_BIN, args, { cwd: SCRAPER_DIR });

    child.stdout.on("data", (d) => process.stdout.write(`[ingest ${jobId.slice(0, 8)}] ${d}`));
    child.stderr.on("data", (d) => process.stderr.write(`[ingest ${jobId.slice(0, 8)}] ${d}`));

    child.on("error", (err) => {
      jobInFlight = false;
      console.error(`[ingest] Failed to spawn Python process: ${err.message}`);
      try {
        db.prepare(
          "UPDATE ingest_jobs SET status = 'failed', finished_at = ?, message = ? WHERE id = ?"
        ).run(new Date().toISOString(), `Failed to spawn Python process: ${err.message}`, jobId);
      } catch (dbErr) {
        console.error(`[ingest] Failed to write failed status: ${dbErr.message}`);
      }
    });

    child.on("close", (code) => {
      jobInFlight = false;
      // If the job is still marked as queued or running, it crashed or exited prematurely
      try {
        const job = db.prepare("SELECT status FROM ingest_jobs WHERE id = ?").get(jobId);
        if (job && (job.status === "queued" || job.status === "running")) {
          db.prepare(
            "UPDATE ingest_jobs SET status = 'failed', finished_at = ?, message = ? WHERE id = ?"
          ).run(new Date().toISOString(), `Python process exited prematurely with code ${code}`, jobId);
        }
      } catch (dbErr) {
        console.error(`[ingest] Failed to update closed job status: ${dbErr.message}`);
      }
    });

    res.status(202).json({ job_id: jobId, status: "queued" });
  } catch (err) {
    next(err);
  }
});

// GET /ingest/status/:jobId -- lets the frontend poll
router.get("/status/:jobId", (req, res, next) => {
  try {
    const job = db.prepare(`SELECT * FROM ingest_jobs WHERE id = ?`).get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
