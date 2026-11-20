import { afterEach, expect, it } from "vitest";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { RoomReply, SessionUpdate } from "@nha-choi/protocol";
import { randomBytes } from "node:crypto";
import { createGameServer } from "../src/server.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
export async function connect(url: string, compactBoard = false) {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { compactBoard },
  });
  cleanups.push(async () => {
    socket.disconnect();
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}
it("keeps the host board size and rejects legacy clients for compact rooms", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const host = await connect(app.url, true);
  const created = await ack(host, "room:create", {
    name: "Chủ phòng",
    token: "car",
    boardSize: 24,
  });
  if (!created.ok) throw new Error(created.code);
  expect(created.room.boardSize).toBe(24);
  const invite = { code: created.room.code, name: "Bạn", token: "cat" };
  const legacy = await connect(app.url);
  expect(await ack(legacy, "room:join", invite)).toEqual({
    ok: false,
    code: "UNSUPPORTED_BOARD",
  });
  expect(
    await ack(legacy, "room:resume", { resumeToken: created.resumeToken }),
  ).toEqual({ ok: false, code: "UNSUPPORTED_BOARD" });
  const guest = await connect(app.url, true);
  expect(await ack(guest, "room:join", invite)).toMatchObject({
    ok: true,
    room: { boardSize: 24 },
  });
  for (const player of [host, guest])
    await ack(player, "room:ready", { ready: true });
  expect(await ack(host, "room:start", {})).toMatchObject({ ok: true });
  const restarted = await createGameServer({ port: 0 });
  cleanups.push(restarted.close);
  restarted.rooms.restore(app.rooms.checkpoint());
  const returning = await connect(restarted.url, true);
  expect(
    await ack(returning, "room:resume", { resumeToken: created.resumeToken }),
  ).toMatchObject({ ok: true, room: { boardSize: 24, started: true } });
  expect(restarted.rooms.checkpoint()[0]?.authority?.state.board).toHaveLength(
    24,
  );
});
export function ack<T = RoomReply>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(3000)
      .emit(event, payload, (error: Error | null, reply: T) =>
        error ? reject(error) : resolve(reply),
      );
  });
}
it("enforces_room_capacity_readiness_host_and_unique_pieces", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const host = await connect(app.url);
  const created = await ack(host, "room:create", {
    name: "Chủ phòng",
    token: "car",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.code);
  expect(created.room.code).toMatch(/^[A-Z0-9]{6}$/);
  expect(created.resumeToken).toBeTruthy();
  expect(await ack(host, "room:start", {})).toMatchObject({
    ok: false,
    code: "NOT_READY",
  });
  const sockets = [host];
  const tokens = ["cat", "hat", "ship", "dog", "plane"];
  for (const [i, token] of tokens.entries()) {
    const guest = await connect(app.url);
    sockets.push(guest);
    expect(
      await ack(guest, "room:join", {
        code: created.room.code,
        name: `Bạn ${i + 1}`,
        token,
      }),
    ).toMatchObject({ ok: true });
  }
  const extra = await connect(app.url);
  expect(
    await ack(extra, "room:join", {
      code: created.room.code,
      name: "Thêm",
      token: "car",
    }),
  ).toMatchObject({ ok: false, code: "ROOM_FULL" });
  expect(await ack(sockets[1]!, "room:start", {})).toMatchObject({
    ok: false,
    code: "NOT_HOST",
  });
  for (const socket of sockets)
    expect(await ack(socket, "room:ready", { ready: true })).toMatchObject({
      ok: true,
    });
  const views = sockets.map(
    (socket) =>
      new Promise<SessionUpdate>((resolve) =>
        socket.once("game:update", resolve),
      ),
  );
  expect(await ack(host, "room:start", {})).toMatchObject({ ok: true });
  const updates = await Promise.all(views);
  expect(new Set(updates.map((u) => u.view?.viewerId)).size).toBe(6);
  for (const update of updates) {
    expect(update.view?.players).toHaveLength(6);
    expect(update.view).not.toHaveProperty("decks");
    expect(JSON.stringify(update)).not.toContain("resumeToken");
  }
});
it("rejects_duplicate_pieces_and_replays_room_creation_with_the_same_proof", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const host = await connect(app.url);
  const secret = randomBytes(32).toString("base64url");
  const request = { name: "Chủ", token: "car", resumeToken: secret };
  const first = await ack(host, "room:create", request);
  const retry = await ack(host, "room:create", request);
  expect(first.ok).toBe(true);
  expect(retry).toEqual(first);
  if (!first.ok) throw new Error(first.code);
  const guest = await connect(app.url);
  expect(
    await ack(guest, "room:join", {
      name: "Bạn",
      token: "car",
      code: first.room.code,
    }),
  ).toMatchObject({ ok: false, code: "TOKEN_TAKEN" });
  expect(
    await ack(guest, "room:join", {
      name: " ",
      token: "cat",
      code: first.room.code,
    }),
  ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
});
it("limits_room_requests_and_keeps_the_health_endpoint_available", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const socket = await connect(app.url);
  let response: RoomReply | undefined;
  for (let n = 0; n < 31; n++)
    response = await ack(socket, "room:create", { name: "Bạn", token: "car" });
  expect(response).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  expect(await (await fetch(app.url + "/health")).json()).toEqual({ ok: true });
});
it("rejects_disallowed_origins_and_disconnects_oversized_frames", async () => {
  const app = await createGameServer({ port: 0 });
  cleanups.push(app.close);
  const denied = io(app.url, {
    transports: ["websocket"],
    reconnection: false,
    extraHeaders: { Origin: "https://untrusted.invalid" },
  });
  cleanups.push(async () => {
    denied.close();
  });
  expect(
    await new Promise((resolve) => denied.once("connect_error", resolve)),
  ).toBeTruthy();
  const socket = await connect(app.url);
  const disconnected = new Promise<string>((resolve) =>
    socket.once("disconnect", resolve),
  );
  socket.emit("room:create", { name: "x".repeat(40000), token: "car" });
  expect(await disconnected).toBeTruthy();
  expect((await fetch(app.url + "/health")).status).toBe(200);
});
