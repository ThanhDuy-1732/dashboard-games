import type { PoolClient } from "pg";
import { z } from "zod";

export const cleanupFilter = z.strictObject({
  kinds: z.array(z.enum(["view", "session_started", "activity", "game_started", "game_completed", "latency"])).min(1).max(6),
  before: z.iso.datetime(),
});
type CleanupFilter = z.infer<typeof cleanupFilter>;
type Db = Pick<PoolClient, "query">;

export async function previewCleanup(db: Db, scope: string, filter: CleanupFilter) {
  const { rows } = await db.query<{ count: number; estimatedBytes: number }>(`
    SELECT count(*)::float8 AS count, coalesce(sum(pg_column_size(event)), 0)::float8 AS "estimatedBytes"
    FROM nha_choi_metric_events event
    WHERE scope = $1 AND kind = ANY($2::text[]) AND occurred_at < $3::timestamptz
    HAVING $3::timestamptz <= statement_timestamp() - interval '30 days'
  `, [scope, filter.kinds, filter.before]);
  return rows[0] ?? null;
}

export async function cleanupMetrics(db: Db, scope: string, filter: CleanupFilter) {
  const values = [scope, filter.kinds, filter.before];
  const { rows } = await db.query<{ deleted: number }>(`
    WITH selected AS (
      SELECT scope, source, id FROM nha_choi_metric_events
      WHERE scope = $1 AND kind = ANY($2::text[]) AND occurred_at < $3::timestamptz
        AND $3::timestamptz <= statement_timestamp() - interval '30 days'
      ORDER BY occurred_at, source, id LIMIT 1000 FOR UPDATE
    ), removed AS (
      DELETE FROM nha_choi_metric_events e USING selected s
      WHERE e.scope = s.scope AND e.source = s.source AND e.id = s.id
      RETURNING e.id
    )
    INSERT INTO nha_choi_metric_cleanup(scope, cutoff, kinds, deleted)
    SELECT $1, $3, $2, count(*) FROM removed HAVING count(*) > 0
    RETURNING deleted
  `, values);
  const remaining = await previewCleanup(db, scope, filter);
  return { deleted: rows[0]?.deleted ?? 0, remaining: remaining?.count ?? 0 };
}

export async function cleanupHistory(db: Db, scope: string) {
  const { rows } = await db.query<{ removedAt: Date; before: Date; kinds: string[]; deleted: number }>(`
    SELECT removed_at AS "removedAt", cutoff AS "before", kinds, deleted
    FROM nha_choi_metric_cleanup WHERE scope = $1 ORDER BY id DESC LIMIT 50
  `, [scope]);
  return rows;
}
