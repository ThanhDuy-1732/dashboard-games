export interface MetricRow {
  day: string;
  kind: string;
  dimensions: Record<string, string | number | boolean>;
  count: number;
  durationMs?: number;
  durationSamples?: number;
}
export interface Summary {
  days: string[];
  updatedAt: string;
  traffic: { active: number; rows: MetricRow[] };
  games: MetricRow[];
  ongoing: { caro: number; "ty-phu": number };
  droppedMetrics: number;
  metricWriteErrors: number;
  system: {
    bytes: number;
    ramBytes: number;
    tables: { name: string; bytes: number; estimatedRows: number }[];
    storageHistory: { day: string; bytes: number }[];
    latency: { metric: string; samples: number; errors: number; p50: number | null; p95: number | null }[];
  };
}
export class AdminApiError extends Error {
  constructor(readonly status: number) {
    super("Admin API request failed");
  }
}
export async function adminApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/admin/" + path, {
    cache: "no-store",
    ...(body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json"))
    throw new AdminApiError(response.ok ? 503 : response.status);
  return response.json() as Promise<T>;
}
