import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { createSaveStore, SaveError } from "../src/storage/save.js";
import { makeSavedGame, savedGameSchema } from "../src/storage/save-schema.js";
import { makeState } from "../../../packages/game-core/test/fixtures/state-factory.js";
afterEach(() => vi.restoreAllMocks());
function rawWrite(name: string, key: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction("offline", "readwrite");
      tx.objectStore("offline").put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    r.onerror = () => reject(r.error);
  });
}
it("restores_complete_game_state_and_preserves_the_previous_revision", async () => {
  const name = crypto.randomUUID();
  const store = createSaveStore(name);
  expect(await store.claim()).toBe(true);
  const state = makeState();
  state.phase = "debt";
  state.players[0]!.cash = 0;
  state.debt = { payer: "p1", payee: "bank", amount: 50 };
  const first = makeSavedGame(state, "p1");
  await store.save(first);
  const next = structuredClone(first);
  next.revision = 1;
  next.state.revision = 1;
  await store.save(next);
  expect((await store.load()).save).toEqual(next);
  await rawWrite(name, "current", { schemaVersion: 1, broken: true });
  const recovered = await store.load();
  expect(recovered.recovered).toBe(true);
  expect(recovered.save).toEqual(first);
  await store.release();
});
it("write_failure_keeps_previous_save_and_aborts_the_whole_transaction", async () => {
  const store = createSaveStore(crypto.randomUUID());
  await store.claim();
  const first = makeSavedGame(makeState(), "p1");
  await store.save(first);
  const next = structuredClone(first);
  next.revision = 1;
  next.state.revision = 1;
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    if (key === "current")
      throw new DOMException("No space", "QuotaExceededError");
    return original.call(this, value, key!);
  });
  await expect(store.save(next)).rejects.toThrow();
  const replacement = structuredClone(next);
  replacement.gameId = "replacement";
  replacement.state.gameId = "replacement";
  await expect(store.replace(replacement)).rejects.toThrow();
  vi.restoreAllMocks();
  expect((await store.load()).save).toEqual(first);
  await store.release();
});
it("unknown_schema_does_not_overwrite_even_when_a_previous_save_is_valid", async () => {
  const name = crypto.randomUUID();
  const store = createSaveStore(name);
  await store.claim();
  const save = makeSavedGame(makeState(), "p1");
  await store.save(save);
  await rawWrite(name, "current", { ...save, schemaVersion: 99 });
  await expect(store.load()).rejects.toMatchObject({ code: "INCOMPATIBLE" });
  await expect(store.save(save)).rejects.toMatchObject({
    code: "INCOMPATIBLE",
  });
  await store.release();
});
it("second_tab_cannot_take_writer_lease_or_overwrite_a_game", async () => {
  const name = crypto.randomUUID();
  const a = createSaveStore(name);
  const b = createSaveStore(name);
  expect(await a.claim()).toBe(true);
  expect(await b.claim()).toBe(false);
  const save = makeSavedGame(makeState(), "p1");
  await a.save(save);
  await expect(b.save(save)).rejects.toMatchObject({ code: "LEASE_LOST" });
  await a.release();
  expect(await b.claim()).toBe(true);
  await b.save(save);
  await b.release();
});
it("an_expired_writer_becomes_read_only_after_another_tab_claims", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const name = crypto.randomUUID();
    const first = createSaveStore(name);
    const second = createSaveStore(name);
    await first.claim();
    vi.setSystemTime(Date.now() + 16000);
    expect(await second.claim()).toBe(true);
    await expect(
      first.save(makeSavedGame(makeState(), "p1")),
    ).rejects.toMatchObject({ code: "LEASE_LOST" });
    await second.release();
  } finally {
    vi.useRealTimers();
  }
});
it("requires_explicit_removal_before_replacing_an_existing_game", async () => {
  const store = createSaveStore(crypto.randomUUID());
  await store.claim();
  const first = makeSavedGame(makeState(), "p1");
  await store.save(first);
  const other = structuredClone(first);
  other.gameId = "other";
  other.state.gameId = "other";
  await expect(store.save(other)).rejects.toMatchObject({
    code: "SAVE_EXISTS",
  });
  await store.remove();
  await store.save(other);
  expect((await store.load()).save?.gameId).toBe("other");
  await store.release();
});
it("rejects_corrupt_ownership_inventory_and_card_distribution", () => {
  const base = makeSavedGame(makeState(), "p1");
  expect(savedGameSchema.safeParse(base).success).toBe(true);
  for (const change of [
    (s: typeof base) => {
      s.state.board[6]!.owner = "stranger";
    },
    (s: typeof base) => {
      s.state.bank.houses = 31;
    },
    (s: typeof base) => {
      s.state.decks.chance[0] = "chance-2";
    },
    (s: typeof base) => {
      s.revision = 99;
    },
  ]) {
    const bad = structuredClone(base);
    change(bad);
    expect(savedGameSchema.safeParse(bad).success).toBe(false);
  }
  expect(new SaveError("LEASE_LOST")).toBeInstanceOf(Error);
});
it("recovers_corrupt_writer_metadata_without_deleting_game_data", async () => {
  const name = crypto.randomUUID();
  const store = createSaveStore(name);
  await store.claim();
  const save = makeSavedGame(makeState(), "p1");
  await store.save(save);
  await rawWrite(name, "lease", { broken: true });
  expect(await store.claim()).toBe(true);
  expect((await store.load()).save).toEqual(save);
  await store.release();
});
it("fences_a_previous_writer_even_after_the_new_tab_releases_its_lease", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const name = crypto.randomUUID(),
      a = createSaveStore(name),
      b = createSaveStore(name);
    const initial = makeSavedGame(makeState(), "p1");
    await a.claim();
    await a.save(initial);
    vi.setSystemTime(Date.now() + 16000);
    await b.claim();
    const newer = structuredClone(initial);
    newer.revision = newer.state.revision = 2;
    newer.state.players[0]!.cash = 1250;
    await b.save(newer);
    await b.release();
    const stale = structuredClone(initial);
    stale.revision = stale.state.revision = 3;
    await expect(a.save(stale)).rejects.toMatchObject({ code: "STALE_SAVE" });
    await expect(a.claim()).rejects.toMatchObject({ code: "STALE_SAVE" });
    expect((await b.load()).save).toEqual(newer);
  } finally {
    vi.useRealTimers();
  }
});
it("rejects_equal_revision_with_a_different_history", async () => {
  const store = createSaveStore(crypto.randomUUID());
  const save = makeSavedGame(makeState(), "p1");
  await store.save(save);
  const different = structuredClone(save);
  different.state.players[0]!.cash = 1200;
  await expect(store.save(different)).rejects.toMatchObject({
    code: "STALE_SAVE",
  });
  expect((await store.load()).save).toEqual(save);
  await store.release();
});
it("recovers_previous_save_when_a_building_auction_has_no_legal_targets", async () => {
  const name = crypto.randomUUID(),
    store = createSaveStore(name),
    save = makeSavedGame(makeState(), "p1");
  await store.save(save);
  const broken = structuredClone(save);
  broken.state.phase = "auction";
  broken.state.auction = {
    kind: "house",
    spaceId: 1,
    bid: 0,
    bidder: null,
    participants: ["p1", "p2"],
  };
  await rawWrite(name, "previous", save);
  await rawWrite(name, "current", broken);
  expect(await store.load()).toEqual({ save, recovered: true });
  await store.release();
});
it("native_single_window_cold_start_claims_the_saved_game_without_waiting_for_a_dead_writer", async () => {
  const name = crypto.randomUUID(),
    oldProcess = createSaveStore(name, true);
  await oldProcess.claim();
  const save = makeSavedGame(makeState(), "p1");
  await oldProcess.save(save);
  const coldStart = createSaveStore(name, true);
  expect(await coldStart.claim()).toBe(true);
  expect((await coldStart.load()).save).toEqual(save);
  await expect(oldProcess.save(save)).rejects.toMatchObject({
    code: "LEASE_LOST",
  });
  await coldStart.release();
});
