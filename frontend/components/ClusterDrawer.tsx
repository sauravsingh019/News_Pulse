"use client";

import { useEffect, useState, useMemo } from "react";
import { api, ClusterDetail } from "@/lib/api";

function fmt(d: string | null) {
  if (!d) return "Unknown time";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Zero-dependency Highlight Text Component Helper
function highlightText(text: string, query: string) {
  if (!query || !query.trim()) return <>{text}</>;
  try {
    const cleanQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${cleanQuery})`, "gi");
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-400/35 text-slate-900 px-0.5 rounded-sm font-semibold select-all">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch (e) {
    return <>{text}</>;
  }
}

// Source colors mapping
const sourceColors: Record<string, string> = {
  "BBC News": "bg-pulse",
  "The Guardian": "bg-emerald-500",
  "Al Jazeera": "bg-sky-500",
};

const sentimentStyles = {
  positive: {
    badge: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
    dot: "bg-emerald-400",
    label: "Positive",
  },
  negative: {
    badge: "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30",
    dot: "bg-rose-400",
    label: "Critical",
  },
  neutral: {
    badge: "bg-slate-100 dark:bg-muted/10 text-slate-500 dark:text-muted border-slate-200 dark:border-line",
    dot: "bg-muted",
    label: "Neutral",
  },
};

export default function ClusterDrawer({
  clusterId,
  onClose,
  theme = "dark",
  searchQuery = "",
}: {
  clusterId: string | null;
  onClose: () => void;
  theme?: "dark" | "light";
  searchQuery?: string;
}) {
  const [detail, setDetail] = useState<ClusterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!clusterId) return;
    setDetail(null);
    setError(null);
    setExpandedArticleId(null);
    setCopied(false);
    api
      .getClusterDetail(clusterId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [clusterId]);

  const stats = useMemo(() => {
    if (!detail) return null;
    const total = detail.articles.length;
    const sources: Record<string, number> = {};
    const sentiments: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };

    detail.articles.forEach((a) => {
      sources[a.source] = (sources[a.source] || 0) + 1;
      const s = a.sentiment || "neutral";
      sentiments[s] = (sentiments[s] || 0) + 1;
    });

    return { total, sources, sentiments };
  }, [detail]);

  const dominantSentiment = useMemo(() => {
    if (!stats) return null;
    const { positive, negative, neutral } = stats.sentiments;
    if (positive > negative && positive > neutral) return "Positive Tone";
    if (negative > positive && negative > neutral) return "Critical Tone";
    return "Balanced Tone";
  }, [stats]);

  const getBriefMarkdown = () => {
    if (!detail || !stats) return "";
    const sourcesText = Object.entries(stats.sources)
      .map(([src, count]) => `${src}: ${count}`)
      .join(", ");

    let md = `# News Pulse Brief: ${detail.label}\n\n`;
    md += `**Overall Sentiment:** ${dominantSentiment}\n`;
    md += `**Source Distribution:** ${sourcesText}\n`;
    md += `**Keywords:** ${detail.keywords.map((k) => `#${k}`).join(" ")}\n\n`;
    md += `## Articles\n\n`;

    detail.articles.forEach((a) => {
      md += `### [${a.source}] ${a.headline}\n`;
      md += `*Published: ${fmt(a.published_at)} | Sentiment: ${a.sentiment || "neutral"}*\n\n`;
      if (a.summary) {
        md += `> ${a.summary}\n\n`;
      }
      md += `[Original Link](${a.url})\n\n---\n\n`;
    });
    return md;
  };

  const handleExport = () => {
    const md = getBriefMarkdown();
    if (!md) return;
    navigator.clipboard
      .writeText(md)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error("Failed to copy brief: ", err));
  };

  const handleDownload = () => {
    const md = getBriefMarkdown();
    if (!md || !detail) return;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `NewsPulse_Brief_${detail.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isLight = theme === "light";

  if (!clusterId) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-lg h-full overflow-y-auto flex flex-col transition-colors border-l ${
          isLight
            ? "bg-[#FAF7F0] border-[#E3DFD5] text-[#1F2022]"
            : "bg-[#171C24] border-[#262C36] text-[#E9E6DD]"
        }`}
      >
        {/* Sticky Header */}
        <div
          className={`sticky top-0 border-b px-6 py-5 flex items-start justify-between gap-3 z-10 ${
            isLight
              ? "bg-[#FAF7F0]/95 border-[#E3DFD5]"
              : "bg-[#171C24]/95 border-[#262C36]"
          }`}
        >
          <div>
            <p className={`font-mono text-[9px] uppercase tracking-wider mb-1.5 ${isLight ? "text-slate-500" : "text-muted"}`}>
              Topic Explorer
            </p>
            <h2 className={`font-display text-xl leading-snug font-semibold ${isLight ? "text-slate-900" : "text-paper"}`}>
              {detail?.label || "Loading topic details…"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`font-mono text-[10px] uppercase tracking-wider border rounded px-3 py-1.5 transition-colors ${
              isLight
                ? "border-slate-300 hover:border-slate-500 text-slate-700 hover:bg-slate-100"
                : "border-line hover:border-muted text-muted hover:text-paper hover:bg-panel"
            }`}
          >
            Close
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 flex-1 flex flex-col gap-6">
          {error && (
            <div className="p-4 bg-pulse/10 border border-pulse/20 rounded-lg text-pulse font-mono text-sm">
              {error}
            </div>
          )}

          {detail && stats && (
            <>
              {/* Keywords list */}
              <div className="flex flex-wrap gap-1.5">
                {detail.keywords.map((k) => (
                  <span
                    key={k}
                    className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-wire/30 text-wire bg-wire/5"
                  >
                    #{k}
                  </span>
                ))}
              </div>

              {/* Cluster Insights Card */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-4 border rounded-xl flex flex-col ${
                    isLight ? "bg-[#FAF7F0] border-[#E3DFD5]" : "bg-ink/30 border-line"
                  }`}
                >
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${isLight ? "text-slate-500" : "text-muted"}`}>
                    Timeline Activity
                  </span>
                  <span className={`font-mono text-lg mt-1 font-semibold ${isLight ? "text-slate-950" : "text-paper"}`}>
                    {stats.total} Articles
                  </span>
                </div>
                <div
                  className={`p-4 border rounded-xl flex flex-col ${
                    isLight ? "bg-[#FAF7F0] border-[#E3DFD5]" : "bg-ink/30 border-line"
                  }`}
                >
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${isLight ? "text-slate-500" : "text-muted"}`}>
                    Overall Sentiment
                  </span>
                  <span
                    className={`font-mono text-sm mt-1.5 font-semibold ${
                      dominantSentiment?.includes("Positive")
                        ? "text-emerald-500 dark:text-emerald-400"
                        : dominantSentiment?.includes("Critical")
                        ? "text-rose-500 dark:text-rose-400"
                        : isLight ? "text-slate-900" : "text-paper"
                    }`}
                  >
                    {dominantSentiment}
                  </span>
                </div>
              </div>

              {/* Export Brief Panel */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExport}
                  className="font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-xl border border-wire bg-wire/10 text-wire hover:bg-wire/20 transition-all flex items-center justify-center gap-1.5 font-semibold"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied Brief!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.16-7.5-8.875a9.06 9.06 0 00-1.5-.124m7.5 10.376h-3.375a1.125 1.125 0 01-1.125-1.125V11.25m-6 3h3.375c.621 0 1.125-.504 1.125-1.125V11.25M3 18.75h18.75"
                        />
                      </svg>
                      Copy Markdown
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-xl border border-pulse bg-pulse/10 text-pulse hover:bg-pulse/20 transition-all flex items-center justify-center gap-1.5 font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download .MD
                </button>
              </div>

              {/* Source Distribution Bar Chart */}
              <div className={`p-5 border rounded-xl ${isLight ? "bg-slate-50 border-[#E3DFD5]" : "bg-ink/20 border-line"}`}>
                <h4 className={`font-mono text-[9px] uppercase tracking-wider mb-3 ${isLight ? "text-slate-500" : "text-muted"}`}>
                  Coverage Breakdown
                </h4>
                <div className={`h-2 rounded-full overflow-hidden flex ${isLight ? "bg-slate-200" : "bg-line"}`}>
                  {Object.entries(stats.sources).map(([source, count]) => {
                    const width = (count / stats.total) * 100;
                    const bg = sourceColors[source] || "bg-muted";
                    return (
                      <div
                        key={source}
                        style={{ width: `${width}%` }}
                        className={`${bg} h-full`}
                        title={`${source}: ${count} (${width.toFixed(0)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                  {Object.entries(stats.sources).map(([source, count]) => {
                    const colorDot = sourceColors[source] || "bg-muted";
                    return (
                      <div key={source} className={`flex items-center gap-1.5 font-mono text-[9px] ${isLight ? "text-slate-600" : "text-muted"}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${colorDot}`} />
                        <span>
                          {source} <span className={isLight ? "text-slate-900 font-medium" : "text-paper"}>({count})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Articles List */}
              <div className="flex flex-col gap-4">
                <h4 className={`font-mono text-[9px] uppercase tracking-wider ${isLight ? "text-slate-500" : "text-muted"}`}>
                  Timeline Articles
                </h4>
                {detail.articles.map((a) => {
                  const isExpanded = expandedArticleId === a.id;
                  const sStyle = sentimentStyles[a.sentiment || "neutral"];
                  return (
                    <div
                      key={a.id}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        isExpanded
                          ? isLight
                            ? "border-pulse/50 bg-[#F3EFE0] shadow-sm"
                            : "border-pulse/50 bg-ink/40 shadow-lg shadow-pulse/5"
                          : isLight
                          ? "border-[#E3DFD5] bg-[#FDFBF7] hover:border-slate-400 cursor-pointer"
                          : "border-line bg-panel/40 hover:border-muted/40 cursor-pointer"
                      }`}
                      onClick={() => !isExpanded && setExpandedArticleId(a.id)}
                    >
                      {/* Card Header (Collapsed or Expanded) */}
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-wire font-semibold">
                              {a.source}
                            </span>
                            <span
                              className={`font-mono text-[8px] px-2 py-0.5 rounded-full border ${sStyle.badge}`}
                            >
                              {sStyle.label}
                            </span>
                          </div>
                          <span className={`font-mono text-[9px] ${isLight ? "text-slate-500" : "text-muted"}`}>
                            {fmt(a.published_at)}
                          </span>
                        </div>

                        <h3
                          className={`font-body leading-snug font-semibold transition-colors ${
                            isLight
                              ? isExpanded
                                ? "text-slate-900 text-base"
                                : "text-slate-800 text-sm hover:text-pulse"
                              : isExpanded
                              ? "text-paper text-base"
                              : "text-paper text-sm hover:text-pulse"
                          }`}
                        >
                          {highlightText(a.headline, searchQuery)}
                        </h3>

                        {/* Collapsed summary snippet */}
                        {!isExpanded && a.summary && (
                          <p className={`font-body text-xs leading-relaxed line-clamp-2 mt-1 ${isLight ? "text-slate-650" : "text-muted"}`}>
                            {highlightText(a.summary, searchQuery)}
                          </p>
                        )}
                      </div>

                      {/* Expanded In-App Reader Block */}
                      {isExpanded && (
                        <div
                          className={`border-t p-5 flex flex-col gap-4 ${
                            isLight
                              ? "border-[#E3DFD5] bg-[#FAF7F0]/60"
                              : "border-line/60 bg-ink/20"
                          }`}
                        >
                          {/* Brief Summary Box */}
                          {a.summary && (
                            <div className="border-l-2 border-pulse/60 pl-3 py-1 bg-pulse/5 rounded-r">
                              <p className={`font-body italic text-xs leading-relaxed ${isLight ? "text-slate-700" : "text-paper/80"}`}>
                                {highlightText(a.summary, searchQuery)}
                              </p>
                            </div>
                          )}

                          {/* Full Body Reader */}
                          {a.body_extraction_ok === 1 && a.body ? (
                            <div
                              className={`font-display text-sm leading-relaxed antialiased max-h-[250px] overflow-y-auto pr-2 custom-reader-body border-y py-4 my-1 select-text ${
                                isLight
                                  ? "border-slate-200 text-slate-850"
                                  : "border-line/40 text-paper"
                              }`}
                            >
                              {a.body.split("\n").map((para, idx) => (
                                <p key={idx} className="mb-3 last:mb-0">
                                  {highlightText(para, searchQuery)}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <div className={`p-3 border rounded text-center ${isLight ? "bg-slate-100/50 border-slate-200" : "bg-muted/5 border-line"}`}>
                              <p className={`font-mono text-[10px] ${isLight ? "text-slate-500" : "text-muted"}`}>
                                Full reader view not available. Original source link is below.
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between mt-1">
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-pulse hover:text-pulse/80 underline decoration-pulseDim hover:decoration-pulse transition-all"
                            >
                              Go to original source →
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedArticleId(null);
                              }}
                              className={`font-mono text-[10px] border px-2.5 py-1 rounded transition-colors ${
                                isLight
                                  ? "border-slate-300 hover:bg-slate-100 text-slate-700"
                                  : "border-line hover:text-paper hover:bg-panel text-muted"
                              }`}
                            >
                              Minimize Reader
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
