import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { loadKilnSave, replaceCorruptKilnSave, restoreKilnGame, writeKilnSave } from "../src/kiln/save.js";
import type { KilnSave } from "../src/kiln/save.js";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("nha-choi-kiln-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

const first: KilnSave = { version: 1, unlocked: 1, active: { level: 1, moves: [{ slot: 0, anchor: 14 }] } };
const victory: KilnSave = {
  version: 1, unlocked: 2, active: {
    level: 1, moves: [...first.active.moves, { slot: 1, anchor: 24 }, { slot: 2, anchor: 43 }],
  },
};

it("replays valid moves and rejects illegal or inconsistent history", () => {
  expect(restoreKilnGame(first)).toMatchObject({ turn: 1, score: 62, status: "playing" });
  expect(restoreKilnGame(victory)).toMatchObject({ turn: 3, score: 188, status: "won" });
  expect(restoreKilnGame({ ...first, active: { level: 2, moves: [] } })).toBeNull();
  expect(restoreKilnGame({ ...first, active: { ...first.active, moves: [...first.active.moves, { slot: 0, anchor: 0 }] } })).toBeNull();
  expect(restoreKilnGame({ ...victory, unlocked: 1 })).toBeNull();
  expect(restoreKilnGame({ ...victory, active: { ...victory.active, moves: [...victory.active.moves, { slot: 0, anchor: 0 }] } })).toBeNull();
  expect(restoreKilnGame({ ...victory, active: { level: 2, moves: victory.active.moves.concat({ slot: 1, anchor: 0 }) } })).toBeNull();
});

it("serializes revisions and keeps the winning write when two tabs compete", async () => {
  expect(await loadKilnSave()).toBeNull();
  const revision = await writeKilnSave(first, null);
  const outcomes = await Promise.allSettled([writeKilnSave(victory, revision), writeKilnSave(first, revision)]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const rejected = outcomes.find(result => result.status === "rejected");
  expect(rejected).toMatchObject({ reason: { kind: "conflict" } });
  const current = await loadKilnSave();
  expect(current?.revision).toBe(revision + 1);
  expect([victory, first]).toContainEqual(current?.save);
  await expect(writeKilnSave({ ...first, unlocked: 3, active: { level: 1, moves: [{ slot: 0, anchor: 7 }] } }, current!.revision)).rejects.toMatchObject({ kind: "corrupt" });
  expect(await loadKilnSave()).toEqual(current);
});

it("preserves unreadable records until reset and refuses to replace a repaired record", async () => {
  await writeKilnSave(first, null);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("nha-choi-kiln-v1");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put({ revision: 1, save: { version: 0 } }, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
  await expect(loadKilnSave()).rejects.toMatchObject({ kind: "corrupt" });
  await expect(writeKilnSave(first, null)).rejects.toMatchObject({ kind: "conflict" });
  await expect(loadKilnSave()).rejects.toMatchObject({ kind: "corrupt" });
  await replaceCorruptKilnSave(first);
  expect((await loadKilnSave())?.save).toEqual(first);
  await expect(replaceCorruptKilnSave(victory)).rejects.toMatchObject({ kind: "conflict" });
});

it("rejects promptly when the database is missing its store", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("nha-choi-kiln-v1", 1);
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
  await expect(loadKilnSave()).rejects.toMatchObject({ name: "NotFoundError" });
}, 500);

it("restores legacy saves at 8 × 8 and round trips a larger board", async () => {
  expect(restoreKilnGame(first)).toMatchObject({ size: 8, turn: 1, score: 62 });
  const save: KilnSave = { ...first, active: { level: 1, size: 10, moves: [{ slot: 0, anchor: 18 }, { slot: 1, anchor: 80 }] } };
  await writeKilnSave(save, null);
  expect((await loadKilnSave())?.save).toEqual(save);
  expect(restoreKilnGame(save)).toMatchObject({ size: 10, turn: 2, score: 65 });
});
