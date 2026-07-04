"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, TimelineItem } from "@/lib/api";
import PulseHeader from "@/components/PulseHeader";
import SourceFilter from "@/components/SourceFilter";
import Timeline from "@/components/Timeline";
import ClusterDrawer from "@/components/ClusterDrawer";

export default function Home() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Theme control state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeWindow, setTimeWindow] = useState<"all" | "24h" | "3d">("all");

  // Bookmarking and analytics state
  const [starredClusters, setStarredClusters] = useState<Set<string>>(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Load bookmarks on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("starred_clusters");
      if (saved) {
        setStarredClusters(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error("Failed to load bookmarks:", e);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { timeline } = await api.getTimeline();
      setTimeline(timeline);
      setActiveSources((prev) => {
        const allSources = new Set(timeline.flatMap((t) => t.sources));
        return prev.size === 0 ? allSources : prev;
      });
    } catch (e: any) {
      setError(e.message || "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle dynamic body class/background transitions on theme toggle
  useEffect(() => {
    const body = document.body;
    if (theme === "light") {
      body.style.backgroundColor = "#FAF7F0";
      body.style.color = "#1F2022";
      body.style.transition = "background-color 0.25s ease, color 0.25s ease";
    } else {
      body.style.backgroundColor = "#10141A";
      body.style.color = "#E9E6DD";
      body.style.transition = "background-color 0.25s ease, color 0.25s ease";
    }
  }, [theme]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const allSources = useMemo(
    () => Array.from(new Set(timeline.flatMap((t) => t.sources))).sort(),
    [timeline]
  );

  const toggleStar = useCallback((clusterId: string) => {
    setStarredClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      try {
        localStorage.setItem("starred_clusters", JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save bookmarks:", e);
      }
      return next;
    });
  }, []);

  // Advanced Filtering logic (Source + Search Query + Time Window + Bookmarks)
  const filtered = useMemo(() => {
    let result = timeline;

    // 1. Starred/Bookmarked filter
    if (showStarredOnly) {
      result = result.filter((t) => starredClusters.has(t.cluster_id));
    }

    // 2. Source Filter
    result = result.filter((t) => t.sources.some((s) => activeSources.has(s)));

    // 3. Live Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.keywords.some((k) => k.toLowerCase().includes(q)) ||
          t.sources.some((s) => s.toLowerCase().includes(q))
      );
    }

    // 4. Timeframe Window Filter
    if (timeWindow !== "all") {
      const limit = timeWindow === "24h" ? 24 * 60 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - limit;
      result = result.filter((t) => new Date(t.start).getTime() > cutoff);
    }

    return result;
  }, [timeline, activeSources, searchQuery, timeWindow, showStarredOnly, starredClusters]);

  // Global Analytics calculations based on visible clusters
  const globalStats = useMemo(() => {
    if (filtered.length === 0) return null;

    let totalArticles = 0;
    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    const sources: Record<string, number> = {};

    filtered.forEach((item) => {
      totalArticles += item.article_count;
      const s = item.dominant_sentiment || "neutral";
      sentiments[s] = (sentiments[s] || 0) + item.article_count;

      item.sources.forEach((src) => {
        sources[src] = (sources[src] || 0) + 1;
      });
    });

    return { totalArticles, sentiments, sources };
  }, [filtered]);

  function toggleSource(source: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  const isLight = theme === "light";

  return (
    <main
      className={`max-w-6xl mx-auto min-h-screen border-x transition-colors ${
        isLight ? "border-slate-200" : "border-line"
      }`}
    >
      {/* Header with Theme Toggle */}
      <PulseHeader
        onRefreshed={load}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      {/* Sources Filters */}
      {allSources.length > 0 && (
        <SourceFilter
          sources={allSources}
          active={activeSources}
          onToggle={toggleSource}
          theme={theme}
        />
      )}

      {/* Filter Control Dashboard */}
      <div
        className={`px-6 py-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
          isLight ? "border-slate-200 bg-slate-100/30" : "border-line bg-panel/10"
        }`}
      >
        {/* Search bar & Bookmarked Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search headlines, keywords, or sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full font-mono text-xs pl-8 pr-12 py-2.5 rounded-lg border focus:outline-none transition-colors ${
                isLight
                  ? "bg-white border-slate-300 text-slate-900 focus:border-pulse"
                  : "bg-ink/50 border-line text-paper focus:border-pulse"
              }`}
            />
            <svg
              className={`absolute left-2.5 top-3 w-3.5 h-3.5 ${
                isLight ? "text-slate-400" : "text-muted"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`absolute right-3 top-3 text-[9px] uppercase font-mono tracking-wider font-semibold ${
                  isLight ? "text-slate-500 hover:text-slate-800" : "text-muted hover:text-paper"
                }`}
              >
                Clear
              </button>
            )}
          </div>

          {/* Bookmarks Toggle button */}
          <button
            onClick={() => setShowStarredOnly((prev) => !prev)}
            className={`font-mono text-[9px] uppercase tracking-wider px-3.5 py-2.5 rounded-lg border flex items-center justify-center gap-1.5 font-semibold transition-all ${
              showStarredOnly
                ? "border-pulse bg-pulse/15 text-pulse"
                : isLight
                ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                : "border-line text-muted hover:text-paper hover:bg-panel/30"
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill={showStarredOnly ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499c.154-.436.782-.436.936 0l2.3 6.907a.75.75 0 00.707.504h7.26c.458 0 .647.577.278.852l-5.88 4.271a.75.75 0 00-.272.842l2.29 6.883c.139.417-.336.762-.686.492l-5.88-4.271a.75.75 0 00-.882 0l-5.88 4.271c-.35.27-.825-.075-.686-.492l2.29-6.883a.75.75 0 00-.272-.842l-5.88-4.271c-.369-.275-.18-.852.278-.852h7.26a.75.75 0 00.707-.504l2.3-6.907z"
              />
            </svg>
            Bookmarked
          </button>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[10px] uppercase tracking-wider mr-1.5 ${
              isLight ? "text-slate-500" : "text-muted"
            }`}
          >
            Timeframe
          </span>
          {(["all", "3d", "24h"] as const).map((win) => {
            const isActive = timeWindow === win;
            const label = win === "all" ? "Show All" : win === "3d" ? "3 Days" : "24 Hours";
            return (
              <button
                key={win}
                onClick={() => setTimeWindow(win)}
                className={`font-mono text-[9px] uppercase tracking-wider px-3 py-2.5 rounded border transition-colors ${
                  isActive
                    ? "border-pulse bg-pulse/10 text-pulse font-semibold"
                    : isLight
                    ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                    : "border-line text-muted hover:text-paper"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Analytics Dashboard Panel */}
      {showAnalytics && globalStats && (
        <div
          className={`mx-6 mt-4 p-5 rounded-2xl border transition-all flex flex-col md:flex-row gap-6 ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-[#171C24]/50 border-line"
          }`}
        >
          {/* Sentiment Chart */}
          <div className="flex-1">
            <h4
              className={`font-mono text-[9px] uppercase tracking-wider mb-3 font-semibold ${
                isLight ? "text-slate-500" : "text-muted"
              }`}
            >
              Overall Sentiment Distribution (Articles)
            </h4>
            <div className="flex flex-col gap-2.5 font-mono text-[10px]">
              {Object.entries(globalStats.sentiments).map(([sent, val]) => {
                const pct = globalStats.totalArticles > 0 ? (val / globalStats.totalArticles) * 100 : 0;
                const label =
                  sent === "positive" ? "Positive Tone" : sent === "negative" ? "Critical Tone" : "Balanced / Neutral";
                const colorText =
                  sent === "positive"
                    ? "text-emerald-500 dark:text-emerald-400"
                    : sent === "negative"
                    ? "text-rose-500 dark:text-rose-400"
                    : "text-slate-500";
                const colorBg = sent === "positive" ? "bg-emerald-500" : sent === "negative" ? "bg-rose-500" : "bg-slate-400";

                return (
                  <div key={sent} className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className={colorText}>{label}</span>
                      <span className={isLight ? "text-slate-700 font-semibold" : "text-paper font-semibold"}>
                        {val} <span className="font-normal">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full w-full ${isLight ? "bg-slate-200" : "bg-line"}`}>
                      <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${colorBg}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share Chart */}
          <div className="flex-1 border-t md:border-t-0 md:border-l border-line/40 pt-4 md:pt-0 md:pl-6">
            <h4
              className={`font-mono text-[9px] uppercase tracking-wider mb-3 font-semibold ${
                isLight ? "text-slate-500" : "text-muted"
              }`}
            >
              Publisher Coverage Share (Clusters)
            </h4>
            <div className="flex flex-col gap-2.5 font-mono text-[10px]">
              {Object.entries(globalStats.sources).map(([src, count]) => {
                const pct = (count / filtered.length) * 100;
                const colorBg = src === "BBC News" ? "bg-pulse" : src === "The Guardian" ? "bg-emerald-500" : "bg-sky-500";
                return (
                  <div key={src} className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className={isLight ? "text-slate-700 font-medium" : "text-paper"}>{src}</span>
                      <span className={isLight ? "text-slate-700 font-semibold" : "text-paper font-semibold"}>
                        {count} <span className="font-normal">Topics ({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full w-full ${isLight ? "bg-slate-200" : "bg-line"}`}>
                      <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${colorBg}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats Counter & Auto-Refresh */}
      <div className="px-6 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className={`font-mono text-[10px] uppercase tracking-wider ${isLight ? "text-slate-500" : "text-muted"}`}>
            {loading
              ? "Loading…"
              : `${filtered.length} active ${filtered.length === 1 ? "story" : "stories"}`}
          </p>

          {/* Analytics Panel Toggle Button */}
          {!loading && filtered.length > 0 && (
            <button
              onClick={() => setShowAnalytics((prev) => !prev)}
              className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded border flex items-center gap-1 font-semibold ${
                showAnalytics
                  ? "border-pulse text-pulse bg-pulse/5"
                  : isLight
                  ? "border-slate-300 hover:bg-slate-100 text-slate-600"
                  : "border-line hover:text-paper hover:bg-panel text-muted"
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
              {showAnalytics ? "Hide Stats" : "Show Stats"}
            </button>
          )}
        </div>

        <label className={`font-mono text-[10px] flex items-center gap-2 cursor-pointer select-none ${isLight ? "text-slate-500" : "text-muted"}`}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-pulse"
          />
          Auto-refresh every 30s
        </label>
      </div>

      {/* Main Timeline View */}
      {error ? (
        <div className="px-6 py-16 text-center">
          <p className="font-mono text-sm text-pulse mb-2">{error}</p>
          <p className={`font-mono text-xs ${isLight ? "text-slate-500" : "text-muted"}`}>
            Check NEXT_PUBLIC_API_BASE_URL and that the backend is running.
          </p>
        </div>
      ) : (
        <Timeline
          items={filtered}
          onSelect={setSelectedCluster}
          theme={theme}
          starredClusters={starredClusters}
          onToggleStar={toggleStar}
        />
      )}

      {/* Interactive Detail Drawer */}
      <ClusterDrawer
        clusterId={selectedCluster}
        onClose={() => setSelectedCluster(null)}
        theme={theme}
        searchQuery={searchQuery}
      />

      {/* Footer info */}
      <footer
        className={`px-6 py-8 border-t mt-6 transition-colors ${
          isLight ? "border-slate-200" : "border-line"
        }`}
      >
        <p className={`font-mono text-[9px] ${isLight ? "text-slate-500" : "text-muted"}`}>
          News Pulse — topic clustering dashboard. Ingestion triggers the Python NLP pipeline
          as a backend subprocess. Custom Ivory and Terminal themes available.
        </p>
      </footer>
    </main>
  );
}
