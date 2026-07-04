"use client";

import { useMemo, useState } from "react";
import { TimelineItem } from "@/lib/api";

function fmt(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Timeline({
  items,
  onSelect,
  theme = "dark",
  starredClusters = new Set(),
  onToggleStar,
}: {
  items: TimelineItem[];
  onSelect: (clusterId: string) => void;
  theme?: "dark" | "light";
  starredClusters?: Set<string>;
  onToggleStar?: (clusterId: string) => void;
}) {
  const [hoveredItem, setHoveredItem] = useState<TimelineItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { rows, min, max, ticks } = useMemo(() => {
    if (items.length === 0) return { rows: [], min: 0, max: 1, ticks: [] as number[] };

    const starts = items.map((i) => new Date(i.start).getTime());
    const ends = items.map((i) => new Date(i.end).getTime());
    let min = Math.min(...starts);
    let max = Math.max(...ends);
    if (min === max) {
      min -= 1000 * 60 * 30;
      max += 1000 * 60 * 30;
    }
    const span = max - min;
    const rows = [...items]
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map((item) => {
        const s = new Date(item.start).getTime();
        const e = new Date(item.end).getTime();
        const left = ((s - min) / span) * 100;
        const width = Math.max(((e - s) / span) * 100, 0.6);
        return { item, left, width };
      });

    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => min + (span * i) / (tickCount - 1));

    return { rows, min, max, ticks };
  }, [items]);

  const handleMouseMove = (e: React.MouseEvent, item: TimelineItem) => {
    setHoveredItem(item);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const tooltipCoords = useMemo(() => {
    if (typeof window === "undefined") return { left: 0, top: 0 };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const offset = 15;
    let x = mousePos.x + offset;
    let y = mousePos.y + offset;

    if (x + 260 > w) {
      x = mousePos.x - 260 - offset;
    }
    if (y + 150 > h) {
      y = mousePos.y - 150 - offset;
    }
    return { left: x, top: y };
  }, [mousePos]);

  const isLight = theme === "light";

  if (items.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className={`font-mono text-sm ${isLight ? "text-slate-500" : "text-muted"}`}>
          No clusters matches your filter. Try adjusting your search query or sources filter.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 overflow-x-auto relative">
      <div className="min-w-[750px]">
        {/* Axis timestamps */}
        <div className={`relative h-6 border-b mb-4 ml-[250px] ${isLight ? "border-slate-200" : "border-line/60"}`}>
          {ticks.map((t, i) => (
            <span
              key={i}
              className={`absolute font-mono text-[9px] -translate-x-1/2 tracking-wider ${
                isLight ? "text-slate-500" : "text-muted"
              }`}
              style={{ left: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {fmt(new Date(t).toISOString())}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2">
          {rows.map(({ item, left, width }) => (
            <div
              key={item.cluster_id}
              className={`group flex items-center gap-2 border-y border-transparent py-1 transition-colors rounded-lg px-2 ${
                isLight ? "hover:bg-slate-200/40" : "hover:bg-panel/10"
              }`}
            >
              {/* Star Bookmark */}
              {onToggleStar && (
                <button
                  onClick={() => onToggleStar(item.cluster_id)}
                  className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    starredClusters.has(item.cluster_id)
                      ? "text-pulse hover:bg-pulse/5"
                      : isLight
                      ? "text-slate-350 hover:text-slate-700 hover:bg-slate-200/60"
                      : "text-muted hover:text-paper hover:bg-panel/60"
                  }`}
                  title={starredClusters.has(item.cluster_id) ? "Remove Bookmark" : "Bookmark Story"}
                >
                  <svg className="w-3.5 h-3.5" fill={starredClusters.has(item.cluster_id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.154-.436.782-.436.936 0l2.3 6.907a.75.75 0 00.707.504h7.26c.458 0 .647.577.278.852l-5.88 4.271a.75.75 0 00-.272.842l2.29 6.883c.139.417-.336.762-.686.492l-5.88-4.271a.75.75 0 00-.882 0l-5.88 4.271c-.35.27-.825-.075-.686-.492l2.29-6.883a.75.75 0 00-.272-.842l-5.88-4.271c-.369-.275-.18-.852.278-.852h7.26a.75.75 0 00.707-.504l2.3-6.907z" />
                  </svg>
                </button>
              )}

              {/* Main click handler for select */}
              <button
                onClick={() => onSelect(item.cluster_id)}
                onMouseMove={(e) => handleMouseMove(e, item)}
                onMouseLeave={handleMouseLeave}
                className="flex-1 flex items-center gap-3 text-left"
              >
                {/* Cluster Title Label + Trending Badge */}
                <div className="w-[220px] shrink-0 pr-2 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`font-body text-sm font-semibold truncate group-hover:text-pulse transition-colors ${
                        isLight ? "text-slate-900" : "text-paper"
                      }`}
                    >
                      {item.label}
                    </div>
                    {item.is_trending && (
                      <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-pulse/10 text-pulse border border-pulse/20 inline-block animate-pulse shrink-0 font-bold leading-none">
                        🔥 TRENDING
                      </span>
                    )}
                  </div>
                  <div className={`font-mono text-[10px] truncate ${isLight ? "text-slate-500" : "text-muted"}`}>
                    {item.sources.join(" · ")}
                  </div>
                </div>

                {/* Spanning timeline block */}
                <div className="relative flex-1 h-6">
                  <div className={`absolute inset-y-0 left-0 right-0 border-l ${isLight ? "border-slate-350" : "border-line/40"}`} />
                  
                  {/* Glow backdrop bar */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-pulse blur-[3px] opacity-0 group-hover:opacity-60 transition-all duration-200"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                    }}
                  />

                  {/* Main visible block bar */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-gradient-to-r from-pulseDim to-pulse
                               group-hover:brightness-125 transition-all relative z-10"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      opacity: 0.45 + item.intensity * 0.55,
                    }}
                  />

                  {/* Pulse dot at start */}
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pulse pulse-dot z-20"
                    style={{ left: `calc(${left}% - 4px)` }}
                  />
                </div>

                {/* Article count label */}
                <span className={`font-mono text-[10px] w-8 text-right shrink-0 ${isLight ? "text-slate-500" : "text-muted"}`}>
                  {item.article_count}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {hoveredItem && (
        <div
          className={`fixed z-50 p-4 border rounded-xl pointer-events-none font-mono text-[11px] w-[260px] flex flex-col gap-2 transition-all duration-75 select-none ${
            isLight
              ? "bg-[#FAF7F0]/95 backdrop-blur border-[#E3DFD5] text-[#1F2022] shadow-lg"
              : "bg-[#171C24]/95 backdrop-blur-md border border-line text-[#E9E6DD] shadow-2xl"
          }`}
          style={{
            left: `${tooltipCoords.left}px`,
            top: `${tooltipCoords.top}px`,
          }}
        >
          <div
            className={`font-semibold border-b pb-1.5 text-xs font-display leading-snug ${
              isLight ? "text-slate-900 border-slate-200" : "text-paper border-line"
            }`}
          >
            {hoveredItem.label}
          </div>
          <div className="flex items-center justify-between">
            <span className={isLight ? "text-slate-500" : "text-muted"}>Articles:</span>
            <span className="text-pulse font-bold">{hoveredItem.article_count}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={isLight ? "text-slate-500" : "text-muted"}>Sources:</span>
            <span
              className={`font-semibold truncate max-w-[170px] text-right ${isLight ? "text-slate-800" : "text-wire"}`}
              title={hoveredItem.sources.join(", ")}
            >
              {hoveredItem.sources.join(", ")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={isLight ? "text-slate-500" : "text-muted"}>Dominant Sentiment:</span>
            <span
              className={`font-semibold capitalize ${
                hoveredItem.dominant_sentiment === "positive"
                  ? "text-emerald-500 dark:text-emerald-400"
                  : hoveredItem.dominant_sentiment === "negative"
                  ? "text-rose-500 dark:text-rose-400"
                  : isLight ? "text-slate-800" : "text-paper"
              }`}
            >
              {hoveredItem.dominant_sentiment || "neutral"}
            </span>
          </div>
          <div
            className={`flex flex-col gap-1 border-t pt-2 text-[10px] ${
              isLight ? "border-slate-200 text-slate-500" : "border-line/60 text-muted"
            }`}
          >
            <div className="flex justify-between">
              <span>First:</span>
              <span className={isLight ? "text-slate-850 font-medium" : "text-paper"}>{fmt(hoveredItem.start)}</span>
            </div>
            <div className="flex justify-between">
              <span>Last:</span>
              <span className={isLight ? "text-slate-850 font-medium" : "text-paper"}>{fmt(hoveredItem.end)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
