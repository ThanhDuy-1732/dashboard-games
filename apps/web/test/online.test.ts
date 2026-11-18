import { afterEach, expect, it, vi } from "vitest";
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
