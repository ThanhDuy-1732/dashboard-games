import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { recordEvents } from "../src/metrics.js";

test.skipIf(!process.env.ADMIN_TEST_PG_SOCKET)("counts unique events, applies local dates and rolls back aggregates", async () => {
  const pool = new Pool({ host: process.env.ADMIN_TEST_PG_SOCKET, port: 55474, database: "postgres" });
  const client = await pool.connect();
  try {
    await client.query(await readFile(new URL("../migrations/002_admin_metrics.sql", import.meta.url), "utf8"));
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
    await client.query("ROLLBACK");
    expect((await client.query(query)).rows).toEqual([]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
