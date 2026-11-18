import { afterEach, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  RoomReply,
  SessionUpdate,
  CommandReply,
} from "@nha-choi/protocol";
import { BOARD } from "@nha-choi/game-core";
import { createGameServer } from "../src/server.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});
async function connect(url: string) {
  const socket = io(url, { transports: ["websocket"], reconnection: false });
  cleanups.push(async () => {
    socket.close();
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}
function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(3000)
      .emit(event, payload, (err: Error | null, value: T) =>
        err ? reject(err) : resolve(value),
      );
  });
}
it("authenticates_the_actor_and_applies_duplicate_or_racing_commands_once", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const clients = [await connect(app.url), await connect(app.url)];
  const host = await ack<RoomReply>(clients[0]!, "room:create", {
    name: "Một",
    token: "car",
  });
  if (!host.ok) throw new Error(host.code);
  const guest = await ack<RoomReply>(clients[1]!, "room:join", {
    name: "Hai",
    token: "cat",
    code: host.room.code,
  });
  if (!guest.ok) throw new Error(guest.code);
  const latest = new Map<string, SessionUpdate>();
  for (const [i, client] of clients.entries())
    client.on("game:update", (value: SessionUpdate) =>
      latest.set(i === 0 ? host.selfId : guest.selfId, value),
    );
  for (const client of clients)
    await ack(client, "room:ready", { ready: true });
  await ack(clients[0]!, "room:start", {});
  const ids = [host.selfId, guest.selfId];
  let view = latest.get(host.selfId)!.view!;
  const send = (
    index: number,
    action: unknown,
    commandId = crypto.randomUUID(),
    revision = view.revision,
  ) =>
    ack<CommandReply>(clients[index]!, "game:command", {
      protocolVersion: 1,
      gameId: view.gameId,
      commandId,
      expectedRevision: revision,
      action,
    });
  expect(
    await ack(clients[0]!, "game:command", {
      protocolVersion: 1,
      gameId: view.gameId,
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      playerId: view.turn.playerId,
      action: { type: "roll", dice: [6, 6] },
    }),
  ).toMatchObject({ ok: false, code: "INVALID_ACTION" });
  for (let step = 0; view.phase !== "awaiting-purchase" && step < 30; step++) {
    const actor = ids.indexOf(view.turn.playerId);
    const reply = await send(actor, {
      type: view.phase === "awaiting-end-turn" ? "end-turn" : "roll",
    });
    expect(reply.ok).toBe(true);
    await vi.waitFor(() =>
      expect(latest.get(host.selfId)!.view!.revision).toBeGreaterThanOrEqual(
        reply.revision,
      ),
    );
    view = latest.get(host.selfId)!.view!;
  }
  expect(view.phase).toBe("awaiting-purchase");
  const actor = ids.indexOf(view.turn.playerId);
  const other = 1 - actor;
  const oldRevision = view.revision;
  const target = view.purchase!;
  const balance = view.players.find((p) => p.id === ids[actor])!.cash;
  const commandId = crypto.randomUUID();
  const replies = await Promise.all([
    send(actor, { type: "buy-property" }, commandId, oldRevision),
    send(other, { type: "buy-property" }, crypto.randomUUID(), oldRevision),
  ]);
  expect(replies.filter((r) => r.ok)).toHaveLength(1);
  expect(
    await send(actor, { type: "buy-property" }, commandId, oldRevision),
  ).toEqual(replies[0]);
  await vi.waitFor(() =>
    expect(latest.get(host.selfId)!.view!.revision).toBe(oldRevision + 1),
  );
  view = latest.get(host.selfId)!.view!;
  expect(view.players.find((p) => p.id === ids[actor])!.cash).toBe(
    balance - BOARD[target]!.price!,
  );
  expect(view.board[target]!.owner).toBe(ids[actor]);
});
it("limits_game_commands_per_authenticated_player", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const host = await connect(app.url);
  const guest = await connect(app.url);
  const room = await ack<RoomReply>(host, "room:create", {
    name: "Chủ",
    token: "car",
  });
  if (!room.ok) throw new Error(room.code);
  await ack(guest, "room:join", {
    name: "Bạn",
    token: "cat",
    code: room.room.code,
  });
  await ack(host, "room:ready", { ready: true });
  await ack(guest, "room:ready", { ready: true });
  await ack(host, "room:start", {});
  let response: CommandReply | undefined;
  for (let i = 0; i < 21; i++)
    response = await ack(host, "game:command", {
      protocolVersion: 1,
      gameId: room.room.roomId,
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      action: { type: "end-turn" },
    });
  expect(response).toMatchObject({ ok: false, code: "RATE_LIMITED" });
});
