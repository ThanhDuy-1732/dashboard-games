import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { cleanupMetrics, previewCleanup } from "../src/metrics-cleanup.js";

test.skipIf(!process.env.ADMIN_TEST_PG_SOCKET)("cleans only old detail in the requested scope and retains aggregates", async () => {
  const pool = new Pool({ host: process.env.ADMIN_TEST_PG_SOCKET, port: 55474, database: "postgres" });
  const client = await pool.connect();
  try {
    await client.query(await readFile(new URL("../migrations/002_admin_metrics.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../migrations/003_game_duration.sql", import.meta.url), "utf8"));
    await client.query("BEGIN");
    const scope = "cleanup-fixture";
    await client.query(`
      INSERT INTO nha_choi_metric_events VALUES
        ($1, 'device', 'old', now() - interval '40 days', 'view', '{}'),
        ($1, 'device', 'new', now() - interval '2 days', 'view', '{}'),
        ($1, 'device', 'latency', now() - interval '40 days', 'latency', '{}'),
        ('different-scope', 'device', 'old', now() - interval '40 days', 'view', '{}');
      `, [scope]);
    await client.query("INSERT INTO nha_choi_metric_days VALUES ($1, current_date, 'device', 'view', '{}', 2)", [scope]);
    const before = new Date(Date.now() - 31 * 86400_000).toISOString();
    const filter = { kinds: ["view"], before };
    expect(await previewCleanup(client, scope, filter)).toMatchObject({ count: 1 });
    expect(await previewCleanup(client, scope, { ...filter, before: new Date().toISOString() })).toBeNull();
    expect(await cleanupMetrics(client, scope, filter)).toEqual({ deleted: 1, remaining: 0 });
    expect(await cleanupMetrics(client, scope, filter)).toEqual({ deleted: 0, remaining: 0 });
    expect((await client.query("SELECT count(*)::int AS count FROM nha_choi_metric_events WHERE scope = $1", [scope])).rows[0]?.count).toBe(2);
    expect((await client.query("SELECT count::int FROM nha_choi_metric_days WHERE scope = $1", [scope])).rows[0]?.count).toBe(2);
    expect((await client.query("SELECT count(*)::int AS count FROM nha_choi_metric_cleanup WHERE scope = $1", [scope])).rows[0]?.count).toBe(1);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

test.skipIf(!process.env.ADMIN_TEST_PG_SOCKET)("concurrent cleanup batches report only once per deleted row", async () => {
  const pool = new Pool({ host: process.env.ADMIN_TEST_PG_SOCKET, port: 55474, database: "postgres" });
  const scope = "cleanup-concurrent-" + crypto.randomUUID();
  try {
    await pool.query(await readFile(new URL("../migrations/002_admin_metrics.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../migrations/003_game_duration.sql", import.meta.url), "utf8"));
    await pool.query(`
      INSERT INTO nha_choi_metric_events
      SELECT $1, 'device', n::text, now() - interval '45 days', 'view', '{}'
      FROM generate_series(1, 1200) n
    `, [scope]);
    const filter = { kinds: ["view"], before: new Date(Date.now() - 31 * 86400_000).toISOString() };
    const results = await Promise.all([cleanupMetrics(pool, scope, filter), cleanupMetrics(pool, scope, filter)]);
    expect(results.map(({ deleted }) => deleted).sort((a, b) => a - b)).toEqual([200, 1000]);
    expect(await previewCleanup(pool, scope, filter)).toMatchObject({ count: 0 });
    expect((await pool.query("SELECT sum(deleted)::int AS total FROM nha_choi_metric_cleanup WHERE scope = $1", [scope])).rows[0]?.total).toBe(1200);
  } finally {
    await pool.query("DELETE FROM nha_choi_metric_events WHERE scope = $1", [scope]);
    await pool.query("DELETE FROM nha_choi_metric_cleanup WHERE scope = $1", [scope]);
    await pool.end();
  }
});
