"use client";

export default function SourceFilter({
  sources,
  active,
  onToggle,
  theme = "dark",
}: {
  sources: string[];
  active: Set<string>;
  onToggle: (source: string) => void;
  theme?: "dark" | "light";
}) {
  const isLight = theme === "light";
  return (
    <div className={`flex flex-wrap items-center gap-2 px-6 py-4 border-b ${isLight ? "border-slate-200" : "border-line"}`}>
      <span className={`font-mono text-[10px] uppercase tracking-wider mr-1 ${isLight ? "text-slate-500" : "text-muted"}`}>
        Sources
      </span>
      {sources.map((s) => {
        const isActive = active.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isActive
                ? "border-wire text-wire bg-wire/10 font-medium"
                : isLight
                ? "border-slate-300 text-slate-700 hover:border-slate-500 hover:bg-slate-100/50"
                : "border-line text-muted hover:border-muted hover:bg-panel/20"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
