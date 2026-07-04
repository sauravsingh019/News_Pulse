const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export type ClusterSummary = {
  id: string;
  label: string;
  keywords: string[];
  article_count: number;
  sources: string[];
  time_range: { start: string | null; end: string | null };
};

export type TimelineItem = {
  cluster_id: string;
  label: string;
  keywords: string[];
  start: string;
  end: string;
  article_count: number;
  sources: string[];
  intensity: number;
  is_trending?: boolean;
  dominant_sentiment?: "positive" | "negative" | "neutral";
};

export type Article = {
  id: string;
  source: string;
  headline: string;
  summary: string;
  body?: string | null;
  sentiment?: "positive" | "negative" | "neutral";
  url: string;
  published_at: string | null;
  body_extraction_ok: number;
};

export type ClusterDetail = {
  id: string;
  label: string;
  keywords: string[];
  article_count: number;
  articles: Article[];
};

export type IngestJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  articles_added: number;
  clusters_total: number;
};

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTimeline: () => req<{ count: number; timeline: TimelineItem[] }>("/timeline"),
  getClusters: (source?: string) =>
    req<{ count: number; clusters: ClusterSummary[] }>(
      source ? `/clusters?source=${encodeURIComponent(source)}` : "/clusters"
    ),
  getClusterDetail: (id: string) => req<ClusterDetail>(`/clusters/${id}`),
  triggerIngest: async (): Promise<{ job_id: string; status: string }> => {
    const res = await fetch(`${API_BASE}/ingest/trigger`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },
  getIngestStatus: (jobId: string) => req<IngestJob>(`/ingest/status/${jobId}`),
};
