import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import { roomCheckpointSchema } from "./room-checkpoint.js";
import type { RoomCheckpoint } from "./room-checkpoint.js";
export interface RoomStore {
  needsReload(): boolean;
  load(): Promise<RoomCheckpoint[]>;
  save(rooms: RoomCheckpoint[]): Promise<void>;
  close(): Promise<void>;
}
export class RoomStoreError extends Error {
  constructor(
    public code:
      | "DATABASE_UNAVAILABLE"
      | "BACKEND_ALREADY_RUNNING"
      | "WRITER_LEASE_LOST"
      | "INVALID_CHECKPOINT",
  ) {
    super(code);
    this.name = "RoomStoreError";
  }
}
export class NeonRoomStore implements RoomStore {
  private pool: Pool;
  private owner = randomUUID();
  private initialized = false;
  private previous = new Map<string, string>();
  private lastWrite = 0;
  constructor(
    connectionString: string,
    private scope = "online-v1",
  ) {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new RoomStoreError("DATABASE_UNAVAILABLE");
    url.searchParams.set("sslmode", "verify-full");
    this.pool = new Pool({
      connectionString: url.toString(),
      enableChannelBinding: true,
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
    });
    this.pool.on("error", () =>
      console.warn("Neon idle connection closed; reconnecting on next query."),
    );
  }
  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    let failed = false;
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      failed = true;
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release(failed);
    }
  }
  needsReload() {
    return performance.now() - this.lastWrite >= 20000;
  }
  async load() {
    if (!this.initialized) {
      await this.pool.query(
        await readFile(
          new URL("../migrations/001_online_rooms.sql", import.meta.url),
          "utf8",
        ),
      );
      this.initialized = true;
    }
    const records = await this.transaction(async (client) => {
      const lease = await client.query(
        `INSERT INTO nha_choi_backend_leases(scope,owner,expires_at) VALUES($1,$2,clock_timestamp()+interval '45 seconds') ON CONFLICT(scope) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at WHERE nha_choi_backend_leases.expires_at<=clock_timestamp() OR nha_choi_backend_leases.owner=EXCLUDED.owner RETURNING scope`,
        [this.scope, this.owner],
      );
      if (!lease.rowCount) throw new RoomStoreError("BACKEND_ALREADY_RUNNING");
      const result = await client.query<{ document: unknown }>(
        "SELECT document FROM nha_choi_room_checkpoints WHERE scope=$1 ORDER BY id",
        [this.scope],
      );
      return result.rows.map((row) => {
        const parsed = roomCheckpointSchema.safeParse(row.document);
        if (!parsed.success) throw new RoomStoreError("INVALID_CHECKPOINT");
        return parsed.data;
      });
    });
    this.previous = new Map(
      records.map((room) => [room.id, JSON.stringify(room)]),
    );
    this.lastWrite = performance.now();
    return records;
  }
  async save(rooms: RoomCheckpoint[]) {
    const current = new Map(
      rooms.map((room) => [room.id, JSON.stringify(room)]),
    );
    const changed = rooms.filter(
      (room) => current.get(room.id) !== this.previous.get(room.id),
    );
    const removed = [...this.previous.keys()].filter((id) => !current.has(id));
    for (const room of changed)
      if (!roomCheckpointSchema.safeParse(room).success)
        throw new RoomStoreError("INVALID_CHECKPOINT");
    if (
      !changed.length &&
      !removed.length &&
      performance.now() - this.lastWrite < 10000
    )
      return;
    // One atomic statement fences the writer and persists its changed rooms.
    const lease = await this.pool.query(
      `WITH lease AS (
         UPDATE nha_choi_backend_leases
         SET expires_at = clock_timestamp() + interval '45 seconds'
         WHERE scope = $1 AND owner = $2 AND expires_at > clock_timestamp()
         RETURNING scope
       ), saved AS (
         INSERT INTO nha_choi_room_checkpoints(scope,id,code,document)
         SELECT lease.scope, room.id, room.code, room.document
         FROM lease CROSS JOIN jsonb_to_recordset($3::jsonb)
           AS room(id uuid, code text, document jsonb)
         ON CONFLICT(scope,id) DO UPDATE SET
           code = EXCLUDED.code, document = EXCLUDED.document,
           updated_at = clock_timestamp()
       ), removed AS (
         DELETE FROM nha_choi_room_checkpoints AS room USING lease
         WHERE room.scope = lease.scope AND room.id = ANY($4::uuid[])
       )
       SELECT scope FROM lease`,
      [
        this.scope,
        this.owner,
        JSON.stringify(
          changed.map((room) => ({
            id: room.id,
            code: room.code,
            document: room,
          })),
        ),
        removed,
      ],
    );
    if (!lease.rowCount) throw new RoomStoreError("WRITER_LEASE_LOST");
    this.previous = current;
    this.lastWrite = performance.now();
  }
  async close() {
    try {
      if (this.initialized)
        await this.pool.query(
          "UPDATE nha_choi_backend_leases SET owner=NULL,expires_at=clock_timestamp() WHERE scope=$1 AND owner=$2",
          [this.scope, this.owner],
        );
    } finally {
      await this.pool.end();
    }
  }
}
