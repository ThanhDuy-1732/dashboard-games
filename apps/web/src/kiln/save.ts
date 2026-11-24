import { createKilnGame, KILN_LEVELS, KILN_LOCK_COUNT, KILN_LOCK_KINDS, KILN_LOCKED_SIZE, KILN_ORDER_KINDS, KILN_SIZES, placeKilnPiece, restoreKilnFreePlay } from "@nha-choi/game-core";
import type { KilnFreeMode, KilnFreeState, KilnGame, KilnLevelId, KilnMove, KilnSize, KilnSlot } from "@nha-choi/game-core";
import { z } from "zod";

type KilnRunTiming = { id?: string; startedAt?: number };

export type KilnSave = {
  version: 1;
  unlocked: KilnLevelId;
  active: { level: KilnLevelId; size?: KilnSize; moves: KilnMove[] } & KilnRunTiming;
  mode?: "campaign" | KilnFreeMode;
  endless?: KilnFreeState & KilnRunTiming;
  locked?: KilnFreeState & KilnRunTiming;
};

const levelId = z.literal([1, 2, 3]);
const slot = z.literal([0, 1, 2]);
const size = z.literal(KILN_SIZES);
const runTiming = { id: z.uuid().optional(), startedAt: z.int().nonnegative().optional() };
const freePlayFields = {
  ...runTiming,
  board: z.array(z.strictObject({ glaze: z.enum(["clay", "green"]), placedAt: z.int().positive().nullable() }).nullable()).max(KILN_SIZES[2] ** 2),
  turn: z.int().nonnegative(),
  score: z.int().nonnegative(),
  collected: z.int().nonnegative(),
  used: z.array(slot).max(2),
};
const saveSchema = z.strictObject({
  version: z.literal(1),
  unlocked: levelId,
  active: z.strictObject({
    level: levelId,
    size: size.optional(),
    ...runTiming,
    moves: z.array(z.strictObject({ slot, anchor: z.int().min(0).max(KILN_SIZES[2] ** 2 - 1) })).max(12),
  }),
  mode: z.enum(["campaign", "endless", "locked"]).optional(),
  endless: z.strictObject({
    ...freePlayFields,
    size,
    order: z.strictObject({
      kind: z.enum(KILN_ORDER_KINDS),
      progress: z.int().min(0).max(1),
      remaining: z.int().positive().nullable(),
    }).optional(),
  }).optional(),
  locked: z.strictObject({
    ...freePlayFields,
    size: z.literal(KILN_LOCKED_SIZE),
    locks: z.array(z.strictObject({
      index: z.int().min(0).max(KILN_LOCKED_SIZE ** 2 - 1),
      kind: z.enum(KILN_LOCK_KINDS),
      remaining: z.int().min(1).max(6),
    }).refine(lock => lock.kind !== "blasts" || lock.remaining <= 2)).max(KILN_LOCK_COUNT),
  }).optional(),
});
const recordSchema = z.strictObject({ revision: z.int().positive(), save: saveSchema });

export class KilnSaveError extends Error {
  constructor(readonly kind: "corrupt" | "conflict") {
    super(kind === "corrupt" ? "Bản lưu Lò Gốm không hợp lệ." : "Bản lưu Lò Gốm đã thay đổi ở tab khác.");
  }
}

export function restoreKilnGame(save: KilnSave): KilnGame | null {
  const parsed = saveSchema.safeParse(save);
  if (!parsed.success) return null;
  const { active, unlocked, mode } = parsed.data;
  if (active.level > unlocked || active.moves.length > KILN_LEVELS[active.level].turnLimit) return null;

  let game = createKilnGame(active.level, active.size);
  for (const move of active.moves) {
    const next = placeKilnPiece(game, move);
    if (!next) return null;
    game = next;
  }
  if (game.status === "won" && unlocked < Math.min(3, active.level + 1)) return null;
  let selected = game;
  for (const freeMode of ["endless", "locked"] as const) {
    const state = parsed.data[freeMode];
    const freeGame = state ? restoreKilnFreePlay(freeMode, state) : null;
    if ((state || mode === freeMode) && !freeGame) return null;
    if (mode === freeMode && freeGame) selected = freeGame;
  }
  return selected;
}

export function saveKilnFreePlay(save: KilnSave, game: KilnGame, timing: KilnRunTiming = {}): KilnSave {
  const { level, board, size, turn, score, collected, tray, order, locks } = game;
  if (typeof level === "number") throw new Error("Expected a free-play kiln game");
  const used = tray.flatMap((piece, index) => piece ? [] : [index as KilnSlot]);
  const state = { board, size, turn, score, collected, used, ...(order ? { order } : {}), ...(locks ? { locks } : {}), ...timing };
  return { ...save, mode: level, [level]: state };
}

function decode(raw: unknown): { save: KilnSave; revision: number } | null {
  const result = recordSchema.safeParse(raw);
  return result.success && restoreKilnGame(result.data.save) ? result.data : null;
}

function accessSave<T>(
  mode: IDBTransactionMode,
  use: (raw: unknown, store: IDBObjectStore) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("nha-choi-kiln-v1", 1);
    let blocked = false;
    opening.onupgradeneeded = () => { opening.result.createObjectStore("saves"); };
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => {
      blocked = true;
      reject(new Error("Kho bản lưu Lò Gốm đang bị chặn."));
    };
    opening.onsuccess = () => {
      const db = opening.result;
      if (blocked) {
        db.close();
        return;
      }
      let tx: IDBTransaction;
      try {
        tx = db.transaction("saves", mode);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      const store = tx.objectStore("saves");
      const reading = store.get("current");
      let result: T;
      let failure: unknown;
      reading.onsuccess = () => {
        try {
          result = use(reading.result, store);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("Không đọc hoặc ghi được bản lưu.")); };
    };
  });
}

export function loadKilnSave(): Promise<{ save: KilnSave; revision: number } | null> {
  return accessSave("readonly", raw => {
    if (raw === undefined) return null;
    const record = decode(raw);
    if (!record) throw new KilnSaveError("corrupt");
    return record;
  });
}

export function writeKilnSave(save: KilnSave, expectedRevision: number | null): Promise<number> {
  return accessSave("readwrite", (raw, store) => {
    if (!restoreKilnGame(save)) throw new KilnSaveError("corrupt");
    const previous = raw === undefined ? null : decode(raw);
    if ((!previous && raw !== undefined) || (previous?.revision ?? null) !== expectedRevision) {
      throw new KilnSaveError("conflict");
    }
    const revision = (previous?.revision ?? 0) + 1;
    store.put({ save, revision }, "current");
    return revision;
  });
}

export function replaceCorruptKilnSave(save: KilnSave): Promise<number> {
  return accessSave("readwrite", (raw, store) => {
    if (!restoreKilnGame(save)) throw new KilnSaveError("corrupt");
    if (raw === undefined || decode(raw)) throw new KilnSaveError("conflict");
    const oldRevision = z.object({ revision: z.int().positive() }).safeParse(raw);
    const revision = oldRevision.success ? oldRevision.data.revision + 1 : Date.now();
    store.put({ save, revision }, "current");
    return revision;
  });
}
