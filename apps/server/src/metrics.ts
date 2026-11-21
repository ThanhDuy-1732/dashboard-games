import type { PoolClient } from "pg";
import type { TelemetryEvent } from "@nha-choi/protocol";

type Queryable = Pick<PoolClient, "query">;
type Source = "device" | "server";
export interface MetricReceipt {
  accepted: string[];
  expired: string[];
}
export interface MetricWriter {
  preview?(filter: Parameters<typeof import("./metrics-cleanup.js").previewCleanup>[2]): ReturnType<typeof import("./metrics-cleanup.js").previewCleanup>;
  cleanup?(filter: Parameters<typeof import("./metrics-cleanup.js").cleanupMetrics>[2]): ReturnType<typeof import("./metrics-cleanup.js").cleanupMetrics>;
  cleanupHistory?(): ReturnType<typeof import("./metrics-cleanup.js").cleanupHistory>;
  summary?(days: number, includeSystem: boolean): ReturnType<typeof import("./metrics-read.js").readMetrics>;
  record(source: Source, events: readonly TelemetryEvent[]): Promise<MetricReceipt>;
}

export async function recordEvents(db: Queryable, scope: string, source: Source, events: readonly TelemetryEvent[]): Promise<MetricReceipt> {
  const input = events.map(({ id, occurredAt, kind, ...attributes }) => ({
    id, occurred_at: occurredAt, kind, attributes,
  }));
  const result = await db.query<{ id: string; accepted: boolean }>(`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset($3::jsonb)
        AS event(id text, occurred_at timestamptz, kind text, attributes jsonb)
    ), eligible AS (
      SELECT * FROM incoming
      WHERE occurred_at >= statement_timestamp() - interval '30 days'
        AND occurred_at <= statement_timestamp() + interval '5 minutes'
    ), inserted AS (
      INSERT INTO nha_choi_metric_events(scope, source, id, occurred_at, kind, attributes)
      SELECT $1, $2, id, occurred_at, kind, attributes FROM eligible ORDER BY id
      ON CONFLICT DO NOTHING
      RETURNING occurred_at, kind, attributes
    ), grouped AS (
      SELECT (occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, kind,
        CASE WHEN kind = 'latency' THEN
          (attributes - 'durationMs') || jsonb_build_object('bucket',
            (ARRAY[10,25,50,100,200,400,800,1500,3000,6000,12000,30000,60000,120000])[
              width_bucket(ceil((attributes->>'durationMs')::numeric),
                ARRAY[11,26,51,101,201,401,801,1501,3001,6001,12001,30001,60001]::numeric[]) + 1
            ])
        ELSE attributes - 'sessionId' END AS dimensions
      FROM inserted WHERE kind <> 'activity'
    ), aggregated AS (
      INSERT INTO nha_choi_metric_days(scope, day, source, kind, dimensions, count)
      SELECT $1, day, $2, kind, dimensions, count(*) FROM grouped
      GROUP BY day, kind, dimensions
      ORDER BY day, kind, dimensions
      ON CONFLICT (scope, day, source, kind, dimensions)
      DO UPDATE SET count = nha_choi_metric_days.count + EXCLUDED.count
    )
    SELECT id, bool_or(occurred_at >= statement_timestamp() - interval '30 days'
      AND occurred_at <= statement_timestamp() + interval '5 minutes') AS accepted
    FROM incoming GROUP BY id
  `, [scope, source, JSON.stringify(input)]);
  return {
    accepted: result.rows.filter((row) => row.accepted).map((row) => row.id),
    expired: result.rows.filter((row) => !row.accepted).map((row) => row.id),
  };
}
