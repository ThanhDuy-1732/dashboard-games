import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { readMetrics } from "../src/metrics-read.js";
import { recordEvents } from "../src/metrics.js";

test.skipIf(!process.env.ADMIN_TEST_PG_SOCKET)("counts unique events, applies local dates and rolls back aggregates", async () => {
  const pool = new Pool({ host: process.env.ADMIN_TEST_PG_SOCKET, port: 55474, database: "postgres" });
  const client = await pool.connect();
  try {
    await client.query(await readFile(new URL("../migrations/002_admin_metrics.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../migrations/003_game_duration.sql", import.meta.url), "utf8"));
    await client.query("BEGIN");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const [{ yesterday, today }] = (await client.query(`
      SELECT to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' - interval '1 millisecond', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS yesterday,
             to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS today
    `)).rows;
    const events = [yesterday, today].map((occurredAt, i) => ({
      id: `fixture-${i}`, occurredAt, kind: "game_started" as const,
      game: "caro" as const, mode: "offline" as const,
    }));
    const { expired } = await recordEvents(client, 'admin-fixture', "device", [
      ...events,
      { ...events[0]!, id: "old", occurredAt: "2000-01-01T00:00:00.000Z" },
    ]);
    expect(expired).toEqual(["old"]);
    await recordEvents(client, 'admin-fixture', "device", events);
    const query = "SELECT day::text, count::int FROM nha_choi_metric_days WHERE scope = 'admin-fixture' ORDER BY day";
    expect((await client.query(query)).rows.map((row) => row.count)).toEqual([1, 1]);
    await recordEvents(client, "admin-fixture", "server", [{
      id: "latency-example", occurredAt: new Date().toISOString(), kind: "latency",
      metric: "backend", durationMs: 42, technicalError: false,
    }]);
    const summary = await readMetrics(client, "admin-fixture", 7, true);
    expect(summary.days).toHaveLength(7);
    const timed = {
      kind: "game_completed" as const, game: "caro" as const, mode: "offline" as const,
      playMode: "bot" as const, occurredAt: new Date().toISOString(),
    };
    const measured = { ...timed, id: "duration-1", durationMs: 120_000 };
    await recordEvents(client, "admin-fixture", "device", [
      measured, { ...timed, id: "duration-2", durationMs: 240_000 },
      { ...timed, id: "duration-legacy" },
      { ...timed, id: "duration-same-device", playMode: "same-device", durationMs: 600_000 },
    ]);
    await recordEvents(client, "admin-fixture", "device", [measured]);
    const timedRows = (await readMetrics(client, "admin-fixture", 7, false)).games
      .filter(({ kind }) => kind === "game_completed");
    expect(timedRows).toHaveLength(2);
    expect(timedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimensions: { game: "caro", mode: "offline", playMode: "bot" },
        count: 3, durationMs: 360_000, durationSamples: 2 }),
      expect.objectContaining({ dimensions: { game: "caro", mode: "offline", playMode: "same-device" },
        count: 1, durationMs: 600_000, durationSamples: 1 }),
    ]));
    expect(summary.system.latency).toContainEqual({ metric: "backend", samples: 1, errors: 0, p50: 50, p95: 50 });
    expect(summary.system.latency).toContainEqual({ metric: "device", samples: 0, errors: 0, p50: null, p95: null });
    expect(summary.system).toMatchObject({ storageHistory: [{ bytes: expect.any(Number) }] });
    await client.query("ROLLBACK");
    expect((await client.query(query)).rows).toEqual([]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
