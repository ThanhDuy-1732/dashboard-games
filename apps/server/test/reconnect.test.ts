import { afterEach, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { RoomReply, SessionUpdate, LobbyView } from "@nha-choi/protocol";
import { createGameServer } from "../src/server.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function connect(
  url: string,
  auth = { protocolVersion: 1, rulesVersion: "classic-v1" },
) {
  const client = io(url, {
    transports: ["websocket"],
    reconnection: false,
    auth,
  });
  cleanup.push(async () => {
    client.close();
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}
function ack<T = RoomReply>(
  client: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return client.timeout(2000).emitWithAck(event, payload);
}
async function pair(now: () => number) {
  const app = await createGameServer({ port: 0, now });
  cleanup.push(app.close);
  const host = await connect(app.url),
    guest = await connect(app.url);
  const a = await ack(host, "room:create", { name: "Một", token: "car" });
  if (!a.ok) throw new Error(a.code);
  const b = await ack(guest, "room:join", {
    name: "Hai",
    token: "cat",
    code: a.room.code,
  });
  if (!b.ok) throw new Error(b.code);
  return { app, host, guest, a, b };
}
it("pauses_until_every_living_player_returns_and_allows_no_winner_close_only_after_120_seconds", async () => {
  let time = 1000;
  const { app, host, guest, a, b } = await pair(() => time);
  let update: SessionUpdate | undefined;
  host.on("game:update", (value) => (update = value));
  await ack(host, "room:ready", { ready: true });
  await ack(guest, "room:ready", { ready: true });
  await ack(host, "room:start", {});
  guest.disconnect();
  await vi.waitFor(() => expect(update?.connection).toBe("paused"));
  const revision = update!.view!.revision;
  time += 119999;
  app.rooms.sweep();
  expect(await ack(host, "game:end-interrupted", {})).toMatchObject({
    ok: false,
    code: "NOT_AUTHORIZED",
  });
  const returned = await connect(app.url);
  await ack(returned, "room:resume", { resumeToken: b.resumeToken });
  await vi.waitFor(() => expect(update?.connection).toBe("connected"));
  expect(update?.view?.revision).toBe(revision);
  returned.disconnect();
  await vi.waitFor(() => expect(update?.connection).toBe("paused"));
  time += 120000;
  app.rooms.sweep();
  await vi.waitFor(() => expect(update?.canEndInterrupted).toBe(true));
  expect(await ack(host, "game:end-interrupted", {})).toMatchObject({
    ok: true,
    room: { closed: true },
  });
  await vi.waitFor(() => expect(update?.connection).toBe("closed"));
  expect(update?.view?.winner).toBeNull();
  expect(update?.view?.revision).toBe(revision);
  expect(
    await ack(await connect(app.url), "room:join", {
      code: a.room.code,
      name: "Mới",
      token: "hat",
    }),
  ).toMatchObject({ ok: false, code: "INVALID_ROOM" });
});
it("replaces_an_old_connection_explicitly_and_transfers_an_expired_lobby_host", async () => {
  let time = 1000;
  const { app, host, guest, a, b } = await pair(() => time);
  let lobby: LobbyView | undefined;
  guest.on("room:update", (value) => (lobby = value));
  const replacement = await connect(app.url);
  await ack(replacement, "room:resume", { resumeToken: a.resumeToken });
  await vi.waitFor(() => expect(host.connected).toBe(false));
  expect(
    await ack(host.connect(), "room:ready", { ready: true }),
  ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  replacement.disconnect();
  await vi.waitFor(() =>
    expect(lobby?.players.find((p) => p.id === a.selfId)?.connected).toBe(
      false,
    ),
  );
  time += 120001;
  app.rooms.sweep();
  await vi.waitFor(() => expect(lobby?.hostId).toBe(b.selfId));
  expect(lobby?.players).toHaveLength(1);
});
it("rejects_incompatible_clients_before_room_authentication", async () => {
  const app = await createGameServer({ port: 0 });
  cleanup.push(app.close);
  await expect(
    connect(app.url, { protocolVersion: 2, rulesVersion: "classic-v1" }),
  ).rejects.toThrow("PROTOCOL_MISMATCH");
});
it("drains_existing_rooms_and_refuses_new_players_before_shutdown", async () => {
  const { app, host, a } = await pair(Date.now);
  let update: SessionUpdate | undefined;
  host.on("game:update", (value) => (update = value));
  app.beginDrain();
  await vi.waitFor(() => expect(update?.connection).toBe("closed"));
  expect(
    await ack(await connect(app.url), "room:create", {
      name: "Mới",
      token: "hat",
    }),
  ).toMatchObject({ ok: false, code: "SERVER_CLOSING" });
  expect(await ack(host, "room:start", {})).toMatchObject({ ok: false });
  const restarted = await createGameServer({ port: 0 });
  cleanup.push(restarted.close);
  expect(
    await ack(await connect(restarted.url), "room:resume", {
      resumeToken: a.resumeToken,
    }),
  ).toMatchObject({ ok: false, code: "INVALID_ROOM" });
});
it("returns_an_original_command_ack_even_when_the_room_is_paused_or_closed", async () => {
  const { app, host, guest } = await pair(Date.now);
  let update: SessionUpdate | undefined;
  host.on("game:update", (value) => (update = value));
  await ack(host, "room:ready", { ready: true });
  await ack(guest, "room:ready", { ready: true });
  await ack(host, "room:start", {});
  await vi.waitFor(() => expect(update?.view).toBeTruthy());
  const view = update!.view!;
  const actor = view.turn.playerId === view.viewerId ? host : guest;
  const command = {
    protocolVersion: 1,
    gameId: view.gameId,
    commandId: crypto.randomUUID(),
    expectedRevision: view.revision,
    action: { type: "roll" },
  };
  const first = await ack(actor, "game:command", command);
  expect(first).toMatchObject({ ok: true });
  const other = actor === host ? guest : host;
  other.disconnect();
  await vi.waitFor(() =>
    expect(
      app.rooms.command(actor.id!, {
        ...command,
        commandId: crypto.randomUUID(),
      }),
    ).toMatchObject({ code: "PAUSED" }),
  );
  expect(await ack(actor, "game:command", command)).toEqual(first);
  app.beginDrain();
  expect(await ack(actor, "game:command", command)).toEqual(first);
});
