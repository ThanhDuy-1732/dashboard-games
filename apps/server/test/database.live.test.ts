import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  RoomReply,
  CommandReply,
  SessionUpdate,
} from "@nha-choi/protocol";
import { createGameServer } from "../src/server.js";
import { NeonRoomStore } from "../src/database.js";
it.runIf(process.env.NEON_INTEGRATION === "1")(
  "live_neon_persists_restarts_restores_proofs_and_receipts_and_fences_a_second_backend",
  async () => {
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new Error("DATABASE_URL is required");
    const scope = `test-${randomUUID()}`,
      url = new URL(connection);
    url.searchParams.set("sslmode", "verify-full");
    const inspection = new Pool({
      connectionString: url.toString(),
      enableChannelBinding: true,
      max: 1,
    });
    let first: Awaited<ReturnType<typeof createGameServer>> | undefined,
      second: typeof first;
    const sockets: Socket[] = [];
    async function connect(endpoint: string) {
      const client = io(endpoint, {
        transports: ["websocket"],
        reconnection: false,
      });
      sockets.push(client);
      await new Promise<void>((resolve, reject) => {
        client.once("connect", () => resolve());
        client.once("connect_error", reject);
      });
      return client;
    }
    const ack = <T = RoomReply>(
      client: Socket,
      event: string,
      payload: unknown,
    ): Promise<T> => client.timeout(15000).emitWithAck(event, payload);
    try {
      first = await createGameServer({
        port: 0,
        store: new NeonRoomStore(connection, scope),
      });
      const competing = new NeonRoomStore(connection, scope);
      try {
        await expect(competing.load()).rejects.toMatchObject({
          code: "BACKEND_ALREADY_RUNNING",
        });
      } finally {
        await competing.close();
      }
      const host = await connect(first.url),
        guest = await connect(first.url);
      const a = await ack(host, "room:create", {
        name: "Neon host",
        token: "car",
      });
      if (!a.ok) throw new Error(a.code);
      const b = await ack(guest, "room:join", {
        name: "Neon guest",
        token: "cat",
        code: a.room.code,
      });
      if (!b.ok) throw new Error(b.code);
      let update: SessionUpdate | undefined;
      host.on("game:update", (value) => (update = value));
      await ack(host, "room:ready", { ready: true });
      await ack(guest, "room:ready", { ready: true });
      await ack(host, "room:start", {});
      const view = update!.view!;
      const command = {
        protocolVersion: 1,
        gameId: view.gameId,
        commandId: randomUUID(),
        expectedRevision: 0,
        action: { type: "roll" },
      };
      const original = await ack<CommandReply>(
        view.turn.playerId === a.selfId ? host : guest,
        "game:command",
        command,
      );
      expect(original.ok).toBe(true);
      const stored = await inspection.query<{ document: unknown }>(
        "SELECT document FROM nha_choi_room_checkpoints WHERE scope=$1",
        [scope],
      );
      expect(stored.rows).toHaveLength(1);
      const text = JSON.stringify(stored.rows[0]!.document);
      expect(text.includes(a.resumeToken!)).toBe(false);
      expect(text.includes(b.resumeToken!)).toBe(false);
      expect(text.includes(new URL(connection).password)).toBe(false);
      const previous = first.rooms.checkpoint()[0]!.authority!.state;
      const invalid = first.rooms.checkpoint();
      invalid[0]!.members[0]!.tokenHash = "broken";
      const validator = new NeonRoomStore(
        connection,
        `validation-${randomUUID()}`,
      );
      try {
        await expect(validator.save(invalid)).rejects.toMatchObject({
          code: "INVALID_CHECKPOINT",
        });
      } finally {
        await validator.close();
      }
      await first.close();
      first = undefined;
      second = await createGameServer({
        port: 0,
        store: new NeonRoomStore(connection, scope),
      });
      const resumedHost = await connect(second.url),
        resumedGuest = await connect(second.url);
      let restored: SessionUpdate | undefined;
      resumedHost.on("game:update", (value) => (restored = value));
      expect(
        await ack(resumedHost, "room:resume", { resumeToken: a.resumeToken }),
      ).toMatchObject({ ok: true, selfId: a.selfId });
      expect(restored?.connection).toBe("paused");
      await ack(resumedGuest, "room:resume", { resumeToken: b.resumeToken });
      expect(second.rooms.checkpoint()[0]!.authority!.state).toEqual(previous);
      expect(
        await ack(
          view.turn.playerId === a.selfId ? resumedHost : resumedGuest,
          "game:command",
          command,
        ),
      ).toEqual(original);
      expect(second.rooms.checkpoint()[0]!.authority!.state).toEqual(previous);
      const countRoomRows = async () =>
        (
          await inspection.query(
            "SELECT id FROM nha_choi_room_checkpoints WHERE scope=$1",
            [scope],
          )
        ).rowCount;
      expect(
        await ack(resumedHost, "room:leave", { discard: true }),
      ).toMatchObject({ ok: true });
      expect(await countRoomRows()).toBe(1);
      expect(
        await ack(resumedGuest, "room:leave", { discard: true }),
      ).toMatchObject({ ok: true });
      expect(await countRoomRows()).toBe(0);
    } finally {
      for (const socket of sockets) socket.close();
      await first?.close();
      await second?.close();
      await inspection.query(
        "DELETE FROM nha_choi_room_checkpoints WHERE scope=$1",
        [scope],
      );
      await inspection.query(
        "DELETE FROM nha_choi_backend_leases WHERE scope=$1",
        [scope],
      );
      await inspection.end();
    }
  },
  60000,
);
