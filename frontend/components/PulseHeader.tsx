"use client";

import { useState } from "react";
import { api, IngestJob } from "@/lib/api";

export default function PulseHeader({
  onRefreshed,
  theme = "dark",
  onToggleTheme,
}: {
  onRefreshed: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}) {
  const [status, setStatus] = useState<IngestJob["status"] | "idle">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setStatus("queued");
    setMessage(null);
    try {
      const { job_id } = await api.triggerIngest();
      setStatus("running");
      poll(job_id);
    } catch (e: any) {
      setStatus("failed");
      setMessage(e.message || "Could not start refresh.");
    }
  }

  function poll(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const job = await api.getIngestStatus(jobId);
        if (job.status === "completed") {
          clearInterval(interval);
          setStatus("completed");
          setMessage(job.message);
          onRefreshed();
        } else if (job.status === "failed") {
          clearInterval(interval);
          setStatus("failed");
          setMessage(job.message || "Pipeline failed.");
          onRefreshed(); // reload what we have
        }
      } catch (e: any) {
        clearInterval(interval);
        setStatus("failed");
        setMessage(e.message);
      }
    }, 2500);
  }

  const isBusy = status === "queued" || status === "running";
  const isLight = theme === "light";

  return (
    <header
      className={`border-b px-6 py-5 flex items-center justify-between gap-6 sticky top-0 z-20 transition-colors backdrop-blur-md ${
        isLight
          ? "border-slate-200 bg-[#FAF7F0]/90"
          : "border-line bg-panel/60"
      }`}
    >
      <div className="flex items-center gap-4">
        <svg width="46" height="28" viewBox="0 0 46 28" className="shrink-0">
          <polyline
            points="0,14 10,14 14,4 18,24 22,10 26,18 30,14 46,14"
            fill="none"
            stroke="#FF8A3D"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pulse-line-draw"
          />
        </svg>
        <div>
          <h1 className={`font-display text-2xl tracking-tight leading-none font-semibold ${isLight ? "text-slate-900" : "text-paper"}`}>
            News Pulse
          </h1>
          <p className={`font-mono text-[10px] mt-1 tracking-wide ${isLight ? "text-slate-500" : "text-muted"}`}>
            TOPIC-CLUSTERED TIMELINE · WIRE FEED
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {message && (
          <span className={`font-mono text-xs max-w-xs truncate hidden md:inline ${isLight ? "text-slate-500" : "text-muted"}`}>
            {message}
          </span>
        )}

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 rounded border transition-colors ${
              isLight
                ? "border-slate-300 hover:bg-slate-100 text-slate-700"
                : "border-line hover:bg-panel text-muted hover:text-paper"
            }`}
            title="Toggle Visual Theme"
          >
            {isLight ? "📟 Wire Mode" : "📰 Print Mode"}
          </button>
        )}

        {/* Refresh Data Button */}
        <button
          onClick={handleRefresh}
          disabled={isBusy}
          className={`font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded border transition-all flex items-center gap-2 font-semibold ${
            isLight
              ? "border-pulse bg-pulse/5 text-pulse hover:bg-pulse/15"
              : "border-pulseDim bg-pulse/10 text-pulse hover:bg-pulse/20"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className={`w-1.5 h-1.5 rounded-full bg-pulse ${isBusy ? "pulse-dot" : ""}`} />
          {isBusy ? "Refreshing…" : "Refresh data"}
        </button>
      </div>
    </header>
  );
}
