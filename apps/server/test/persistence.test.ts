import { afterEach, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  RoomReply,
  CommandReply,
  SessionUpdate,
  TelemetryEvent,
} from "@nha-choi/protocol";
import type { RoomCheckpoint } from "../src/room-checkpoint.js";
import { RoomStoreError } from "../src/database.js";
import type { RoomStore } from "../src/database.js";
import { createGameServer } from "../src/server.js";
class MemoryStore implements RoomStore {
  reload = false;
  needsReload() {
    return this.reload;
  }
  records: RoomCheckpoint[] = [];
  events: TelemetryEvent[] = [];
  fail: "before" | "after" | null = null;
  gate: Promise<void> | null = null;
  async load() {
    this.reload = false;
    return structuredClone(this.records);
  }
  async save(records: RoomCheckpoint[], events: TelemetryEvent[] = []) {
    if (this.gate) await this.gate;
    if (this.fail === "before") {
      this.fail = null;
      throw new Error("database down");
    }
    this.records = structuredClone(records);
    this.events.push(...events);
    if (this.fail === "after") {
      this.fail = null;
      throw new Error("commit acknowledgement lost");
    }
  }
  async close() {}
}
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function connect(url: string) {
  const client = io(url, { transports: ["websocket"], reconnection: false });
  cleanup.push(async () => {
    client.close();
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}
const ack = <T = RoomReply>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> => socket.timeout(5000).emitWithAck(event, payload);
async function pair(store: MemoryStore) {
  const app = await createGameServer({ port: 0, store });
  let closed = false;
  const close = async () => {
    if (!closed) {
      closed = true;
      await app.close();
    }
  };
  cleanup.push(close);
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
  const updates = new Map<Socket, SessionUpdate>();
  for (const client of [host, guest])
    client.on("game:update", (value) => updates.set(client, value));
  await ack(host, "room:ready", { ready: true });
  await ack(guest, "room:ready", { ready: true });
  await ack(host, "room:start", {});
  return { app, close, host, guest, a, b, updates };
}
it("waits for the old Render writer before admitting clients or writing checkpoints", async () => {
  const store = new MemoryStore();
  const old = await pair(store);
  let oldOwnsWriter = true;
  const save = vi.fn(store.save.bind(store));
  const replacement: RoomStore = {
    needsReload: () => store.needsReload(),
    async load() {
      if (oldOwnsWriter) throw new RoomStoreError("BACKEND_ALREADY_RUNNING");
      return store.load();
    },
    save,
    async close() {},
  };
  const app = await createGameServer({ port: 0, store: replacement, allowWriterHandoff: true });
  cleanup.push(app.close);
  const health = await fetch(app.url + "/health");
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ ok: false, status: "WAITING_FOR_WRITER" });
  expect((await fetch(app.url + "/socket.io/?EIO=4&transport=polling")).status).toBe(403);
  expect(save).not.toHaveBeenCalled();

  await old.close();
  oldOwnsWriter = false;
  await vi.waitFor(async () => {
    expect(await (await fetch(app.url + "/health")).json()).toEqual({ ok: true });
  }, { timeout: 4000 });
  const client = await connect(app.url);
  expect(await ack(client, "room:resume", { resumeToken: old.a.resumeToken }))
    .toMatchObject({ ok: true, selfId: old.a.selfId });
});

it("persists_room_before_ack_and_does_not_publish_an_uncommitted_room", async () => {
  const store = new MemoryStore(),
    app = await createGameServer({ port: 0, store });
  cleanup.push(app.close);
  const host = await connect(app.url);
  let release = () => {};
  store.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const lobby = vi.fn();
  host.on("room:update", lobby);
  let finished = false;
  const created = ack(host, "room:create", { name: "Bạn", token: "car" }).then(
    (reply) => {
      finished = true;
      return reply;
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(finished).toBe(false);
  expect(lobby).not.toHaveBeenCalled();
  release();
  expect((await created).ok).toBe(true);
  expect(store.records).toHaveLength(1);
});
it("resumes_players_state_and_exact_duplicate_reply_after_backend_restart", async () => {
  const store = new MemoryStore(),
    game = await pair(store);
  const view = game.updates.get(game.host)!.view!,
    actor = view.turn.playerId === game.a.selfId ? game.host : game.guest;
  const command = {
    protocolVersion: 1,
    gameId: view.gameId,
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    action: { type: "roll" },
  };
  const first = await ack<CommandReply>(actor, "game:command", command);
  expect(first.ok).toBe(true);
  const snapshot = store.records[0]!.authority!.state;
  await game.close();
  const next = await createGameServer({ port: 0, store });
  cleanup.push(next.close);
  const host = await connect(next.url),
    guest = await connect(next.url);
  let latest: SessionUpdate | undefined;
  host.on("game:update", (value) => (latest = value));
  expect(
    await ack(host, "room:resume", { resumeToken: game.a.resumeToken }),
  ).toMatchObject({ ok: true, selfId: game.a.selfId });
  expect(latest?.connection).toBe("paused");
  await ack(guest, "room:resume", { resumeToken: game.b.resumeToken });
  await vi.waitFor(() => expect(latest?.connection).toBe("connected"));
  expect(latest?.view?.revision).toBe(snapshot.revision);
  expect(latest?.view?.players).toEqual(snapshot.players);
  expect(
    await ack(
      view.turn.playerId === game.a.selfId ? host : guest,
      "game:command",
      command,
    ),
  ).toEqual(first);
  expect(store.records[0]!.authority!.state).toEqual(snapshot);
});
for (const failure of ["before", "after"] as const)
  it(`recovers_${failure}_commit_failure_without_lost_or_double_applied_command`, async () => {
    const store = new MemoryStore(),
      game = await pair(store);
    const view = game.updates.get(game.host)!.view!,
      actor = view.turn.playerId === game.a.selfId ? game.host : game.guest;
    const command = {
      protocolVersion: 1,
      gameId: view.gameId,
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      action: { type: "roll" },
    };
    const seen: SessionUpdate[] = [];
    game.host.on("game:update", (value) => seen.push(value));
    store.fail = failure;
    expect(await ack(actor, "game:command", command)).toMatchObject({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    });
    expect(seen.some((value) => value.view?.revision === 1)).toBe(false);
    const retry = await ack<CommandReply>(actor, "game:command", command);
    expect(retry).toMatchObject({ ok: true, revision: 1 });
    expect(store.records[0]!.authority!.state.revision).toBe(1);
    expect(
      store.records[0]!.authority!.replies.filter(
        (value) => value.command.commandId === command.commandId,
      ),
    ).toHaveLength(1);
  });
it("restores_lobby_connection_status_after_a_database_failure", async () => {
  const store = new MemoryStore(),
    app = await createGameServer({ port: 0, store });
  cleanup.push(app.close);
  const host = await connect(app.url);
  await ack(host, "room:create", { name: "Bạn", token: "car" });
  let update: SessionUpdate | undefined;
  host.on("game:update", (value) => (update = value));
  store.fail = "before";
  expect(await ack(host, "room:ready", { ready: true })).toMatchObject({
    ok: false,
    code: "STORAGE_UNAVAILABLE",
  });
  expect(update?.connection).toBe("paused");
  expect(await ack(host, "room:ready", { ready: true })).toMatchObject({
    ok: true,
  });
  expect(update?.connection).toBe("connected");
});
it("does_not_roll_back_a_committed_room_when_a_socket_notification_fails", async () => {
  const { Rooms } = await import("../src/rooms.js");
  const { serverRandom } = await import("../src/random.js");
  const io = {
    to: () => ({
      emit() {
        throw new Error("notification failed");
      },
    }),
    sockets: { sockets: new Map() },
  } as unknown as import("socket.io").Server;
  const rooms = new Rooms(io, serverRandom, Date.now);
  let committed: RoomCheckpoint[] = [];
  await expect(
    rooms.durable(
      () => rooms.create("socket", { name: "Bạn", token: "car" }),
      async (records) => {
        committed = structuredClone(records);
      },
    ),
  ).rejects.toThrow("notification failed");
  expect(rooms.checkpoint()).toEqual(committed);
  expect(committed).toHaveLength(1);
});

it("refreshes_expired_writer_ownership_before_applying_another_action", async () => {
  const store = new MemoryStore(),
    load = vi.spyOn(store, "load"),
    app = await createGameServer({ port: 0, store });
  cleanup.push(app.close);
  const host = await connect(app.url);
  const room = await ack(host, "room:create", { name: "Bạn", token: "car" });
  store.reload = true;
  expect(await ack(host, "room:ready", { ready: true })).toMatchObject({
    ok: true,
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(store.records[0]!.id).toBe(room.ok ? room.room.roomId : "invalid");
});

it("recovers_health_without_new_traffic_after_first_room_save_fails", async () => {
  const store = new MemoryStore(),
    app = await createGameServer({ port: 0, store });
  cleanup.push(app.close);
  const host = await connect(app.url);
  store.fail = "before";
  expect(
    await ack(host, "room:create", { name: "Bạn", token: "car" }),
  ).toMatchObject({
    ok: false,
    code: "STORAGE_UNAVAILABLE",
  });
  expect((await fetch(`${app.url}/health`)).status).toBe(503);
  await vi.waitFor(
    async () => {
      expect((await fetch(`${app.url}/health`)).status).toBe(200);
    },
    { timeout: 2500 },
  );
});

it("reports_only_committed_revisions_while_a_move_is_waiting_for_storage", async () => {
  const store = new MemoryStore(),
    game = await pair(store);
  const view = game.updates.get(game.host)!.view!,
    actor = view.turn.playerId === game.a.selfId ? game.host : game.guest;
  let release = () => {};
  store.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saving = vi.spyOn(store, "save");
  store.fail = "before";
  const result = ack(actor, "game:command", {
    protocolVersion: 1,
    gameId: view.gameId,
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    action: { type: "roll" },
  });
  await vi.waitFor(() => expect(saving).toHaveBeenCalled());
  const observed = game.app.rooms.currentRevision(actor.id!);
  release();
  await result;
  expect(observed).toBe(0);
});

it("removes the checkpoint only when every player chooses to discard on exit", async () => {
  const store = new MemoryStore();
  const { host, guest, close, a, b } = await pair(store);
  expect(await ack(host, "room:leave", { discard: true })).toMatchObject({
    ok: true,
  });
  expect(await ack(guest, "room:leave", {})).toMatchObject({ ok: true });
  expect(store.records).toHaveLength(1);
  await close();

  const next = await createGameServer({ port: 0, store });
  cleanup.push(next.close);
  const returning = await connect(next.url);
  expect(
    await ack(returning, "room:resume", { resumeToken: b.resumeToken }),
  ).toMatchObject({ ok: true, selfId: b.selfId });

  store.fail = "before";
  expect(await ack(returning, "room:leave", { discard: true })).toMatchObject({
    ok: false,
    code: "STORAGE_UNAVAILABLE",
  });
  expect(store.records).toHaveLength(1);
  expect(await ack(returning, "room:leave", { discard: true })).toMatchObject({
    ok: true,
  });
  expect(store.records).toHaveLength(0);
  const hostAgain = await connect(next.url);
  expect(
    await ack(hostAgain, "room:resume", { resumeToken: a.resumeToken }),
  ).toEqual({ ok: false, code: "INVALID_ROOM" });
});

it("stores one start milestone together with the durable room", async () => {
  const store = new MemoryStore();
  const { host } = await pair(store);
  expect(store.events).toMatchObject([{ kind: "game_started", game: "ty-phu", mode: "online" }]);
  expect((await ack(host, "room:start", {})).ok).toBe(false);
  expect(store.events).toHaveLength(1);
});
