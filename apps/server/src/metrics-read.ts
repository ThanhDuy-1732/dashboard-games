import type { PoolClient } from "pg";

type Db = Pick<PoolClient, "query">;
const localDay = "(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
const tables = [
  "nha_choi_room_checkpoints", "nha_choi_backend_leases", "nha_choi_metric_events",
  "nha_choi_metric_days", "nha_choi_metric_sizes", "nha_choi_metric_cleanup",
];
type Dimensions = Record<string, string | boolean | number>;
export interface DayRow {
  day: string;
  kind: string;
  source: string;
  dimensions: Dimensions;
  count: number;
}
function latencySummary(rows: DayRow[]) {
  return ["backend", "database", "device"].map((metric) => {
    const entries = rows.filter((row) => row.kind === "latency" && row.dimensions.metric === metric)
      .sort((a, b) => Number(a.dimensions.bucket) - Number(b.dimensions.bucket));
    const samples = entries.reduce((n, row) => n + row.count, 0);
    const errors = entries.reduce((n, row) => n + (row.dimensions.technicalError ? row.count : 0), 0);
    const quantile = (p: number) => {
      let remaining = Math.ceil(samples * p);
      for (const row of entries) {
        remaining -= row.count;
        if (remaining <= 0) return Number(row.dimensions.bucket);
      }
      return null;
    };
    return { metric, samples, errors, p50: quantile(0.5), p95: quantile(0.95) };
  });
}
export async function readMetrics(db: Db, scope: string, days: number, includeSystem: boolean) {
  const updatedAt = new Date().toISOString();
  const { rows } = await db.query<DayRow>(`
    SELECT day::text, kind, source, dimensions, count::float8
    FROM nha_choi_metric_days WHERE scope = $1 AND day BETWEEN ${localDay} - ($2::int - 1) AND ${localDay}
    ORDER BY day, kind
  `, [scope, days]);
  const range = (await db.query<{ day: string }>(`
    SELECT (${localDay} - n)::text AS day FROM generate_series($1::int - 1, 0, -1) n
  `, [days])).rows.map(({ day }) => day);
  const [presence] = (await db.query<{ active: number }>(`
    SELECT count(DISTINCT attributes->>'sessionId')::float8 AS active FROM nha_choi_metric_events
    WHERE scope = $1 AND source = 'device' AND kind = 'activity'
      AND occurred_at BETWEEN statement_timestamp() - interval '5 minutes' AND statement_timestamp()
  `, [scope])).rows;
  const traffic = { active: presence?.active ?? 0, rows: rows.filter((row) => row.kind === "view" || row.kind === "session_started") };
  const games = rows.filter((row) => row.kind.startsWith("game_"));
  const latency = latencySummary(rows);
  const system = includeSystem ? {
    ...(await storageMetrics(db, scope, days)), ramBytes: process.memoryUsage().rss, latency,
  } : { latency };
  return { days: range, updatedAt, traffic, games, system };
}
export async function captureStorage(db: Db, scope: string) {
  const size = await db.query<{ name: string; bytes: number; estimatedRows: number }>(`
    SELECT tablename AS name, pg_total_relation_size(format('%I.%I', pg_tables.schemaname, tablename)::regclass)::float8 AS bytes,
           greatest(coalesce(n_live_tup, 0), 0)::float8 AS "estimatedRows"
    FROM pg_tables
    LEFT JOIN pg_stat_user_tables ON pg_tables.schemaname = pg_stat_user_tables.schemaname AND tablename = relname
    WHERE pg_tables.schemaname = current_schema() AND tablename = ANY($1::text[])
    ORDER BY tablename
  `, [tables]);
  const bytes = size.rows.reduce((n, row) => n + row.bytes, 0);
  await db.query(`
    INSERT INTO nha_choi_metric_sizes(scope, day, bytes) VALUES($1, ${localDay}, $2)
    ON CONFLICT DO NOTHING
  `, [scope, bytes]);
  return { tables: size.rows, bytes };
}
async function storageMetrics(db: Db, scope: string, days: number) {
  const storage = await captureStorage(db, scope);
  const history = await db.query<{ day: string; bytes: number }>(`
    SELECT day::text, bytes::float8 FROM nha_choi_metric_sizes
    WHERE scope = $1 AND day BETWEEN ${localDay} - ($2::int - 1) AND ${localDay} ORDER BY day
  `, [scope, days]);
  return { ...storage, storageHistory: history.rows };
}
