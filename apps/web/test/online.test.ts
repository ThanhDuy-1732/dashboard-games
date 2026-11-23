import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { createGameServer } from "../../server/src/server.js";
import { connectOnlineRoom, resumeOnlineRoom } from "../src/session/online.js";
import type { SessionUpdate } from "@nha-choi/protocol";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
  vi.unstubAllGlobals();
});
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}
it("cancels_a_pending_room_and_keeps_the_previous_saved_session", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  const saved = storage();
  saved.setItem("nha-choi-online-v1", "old proof");
  vi.stubGlobal("sessionStorage", saved);
  const controller = new AbortController();
  const pending = connectOnlineRoom({
    serverUrl: `http://127.0.0.1:${address.port}`,
    name: "Bạn",
    token: "car",
  }, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(saved.getItem("nha-choi-online-v1")).toBe("old proof");
}, 3000);
it("resumes_the_same_seat_and_latest_revision_after_refresh_without_replaying_a_command", async () => {
  const app = await createGameServer({ port: 0 });
  cleanup.push(app.close);
  const hostStore = storage();
  vi.stubGlobal("sessionStorage", hostStore);
  const host = await connectOnlineRoom({
    serverUrl: app.url,
    name: "Một",
    token: "car",
  });
  cleanup.push(() => host.close());
  let code = "";
  host.subscribeLobby((room) => {
    code = room.code!;
  });
  vi.stubGlobal("sessionStorage", storage());
  const guest = await connectOnlineRoom({
    serverUrl: app.url,
    name: "Hai",
    token: "cat",
    code,
  });
  cleanup.push(() => guest.close());
  let latest: SessionUpdate | undefined;
  host.subscribe((update) => {
    latest = update;
  });
  await host.setReady(true);
  await guest.setReady(true);
  await host.startGame();
  await vi.waitFor(() => expect(latest?.view).not.toBeNull());
  const view = latest!.view!;
  const actor = view.turn.playerId === host.selfId ? host : guest;
  const envelope = {
    protocolVersion: 1 as const,
    gameId: view.gameId,
    commandId: crypto.randomUUID(),
    expectedRevision: view.revision,
    action: { type: "roll" as const },
  };
  const first = await actor.send(envelope);
  expect(first.ok).toBe(true);
  expect(await actor.send(envelope)).toEqual(first);
  await vi.waitFor(() => expect(latest?.view?.revision).toBe(first.revision));
  let guestUpdate: SessionUpdate | undefined;
  guest.subscribe((value) => {
    guestUpdate = value;
  });
  await host.setActive(false);
  await vi.waitFor(() => expect(guestUpdate?.connection).toBe("paused"));
  await host.setActive(true);
  await vi.waitFor(() => expect(guestUpdate?.connection).toBe("connected"));
  expect(guestUpdate?.view?.revision).toBe(first.revision);
  await host.close();
  vi.stubGlobal("sessionStorage", hostStore);
  const resumed = await resumeOnlineRoom();
  cleanup.push(() => resumed.close());
  expect(resumed.selfId).toBe(host.selfId);
  let restored: SessionUpdate | undefined;
  resumed.subscribe((update) => {
    restored = update;
  });
  await vi.waitFor(() => expect(restored?.view?.revision).toBe(first.revision));
  expect(restored?.connection).toBe("connected");
});
it("failed_join_preserves_the_credential_for_the_previous_live_room", async () => {
  const app = await createGameServer({ port: 0 });
  cleanup.push(app.close);
  const saved = storage();
  vi.stubGlobal("sessionStorage", saved);
  const original = await connectOnlineRoom({
    serverUrl: app.url,
    name: "Bạn",
    token: "car",
  });
  const proof = saved.getItem("nha-choi-online-v1");
  await original.close();
  await expect(
    connectOnlineRoom({
      serverUrl: app.url,
      name: "Bạn",
      token: "cat",
      code: "000000",
    }),
  ).rejects.toThrow();
  expect(saved.getItem("nha-choi-online-v1")).toBe(proof);
  const restored = await resumeOnlineRoom();
  cleanup.push(() => restored.close());
  expect(restored.selfId).toBe(original.selfId);
});
it("retries_a_transient_database_admission_failure_without_losing_the_new_session", async () => {
  type Record = import("../../server/src/room-checkpoint.js").RoomCheckpoint;
  let records: Record[] = [],
    fail = true;
  const app = await createGameServer({
    port: 0,
    store: {
      needsReload() {
        return false;
      },
      async load() {
        return structuredClone(records);
      },
      async save(next) {
        if (fail) {
          fail = false;
          throw new Error("temporary storage failure");
        }
        records = structuredClone(next);
      },
      async close() {},
    },
  });
  cleanup.push(app.close);
  vi.stubGlobal("sessionStorage", storage());
  const session = await connectOnlineRoom({
    serverUrl: app.url,
    name: "Khôi phục",
    token: "car",
  });
  cleanup.push(() => session.close());
  expect(session.selfId).toBeTruthy();
  expect(records).toHaveLength(1);
  expect(records[0]!.members).toHaveLength(1);
});

it("keeps_the_room_and_proof_when_leaving_cannot_be_saved", async () => {
  type Record = import("../../server/src/room-checkpoint.js").RoomCheckpoint;
  let records: Record[] = [],
    fail = false;
  const app = await createGameServer({
    port: 0,
    store: {
      needsReload: () => false,
      async load() {
        return structuredClone(records);
      },
      async save(next) {
        if (fail) {
          fail = false;
          throw new Error("database unavailable");
        }
        records = structuredClone(next);
      },
      async close() {},
    },
  });
  cleanup.push(app.close);
  const saved = storage();
  vi.stubGlobal("sessionStorage", saved);
  const host = await connectOnlineRoom({
    serverUrl: app.url,
    name: "Bạn",
    token: "car",
  });
  cleanup.push(() => host.close());
  const proof = saved.getItem("nha-choi-online-v1");
  fail = true;
  await expect(host.leaveRoom()).rejects.toThrow();
  expect(saved.getItem("nha-choi-online-v1")).toBe(proof);
  await host.leaveRoom();
  expect(saved.getItem("nha-choi-online-v1")).toBeNull();
  expect(records).toHaveLength(0);
});
