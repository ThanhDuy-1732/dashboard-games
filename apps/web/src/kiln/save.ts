import { createKilnGame, KILN_LEVELS, KILN_ORDER_KINDS, KILN_SIZES, placeKilnPiece, restoreKilnEndless } from "@nha-choi/game-core";
import type { KilnEndlessState, KilnGame, KilnLevelId, KilnMove, KilnSize, KilnSlot } from "@nha-choi/game-core";
import { z } from "zod";

type KilnRunTiming = { id?: string; startedAt?: number };

export type KilnSave = {
  version: 1;
  unlocked: KilnLevelId;
  active: { level: KilnLevelId; size?: KilnSize; moves: KilnMove[] } & KilnRunTiming;
  mode?: "campaign" | "endless";
  endless?: KilnEndlessState & KilnRunTiming;
};

const levelId = z.literal([1, 2, 3]);
const slot = z.literal([0, 1, 2]);
const size = z.literal(KILN_SIZES);
const runTiming = { id: z.uuid().optional(), startedAt: z.int().nonnegative().optional() };
const saveSchema = z.strictObject({
  version: z.literal(1),
  unlocked: levelId,
  active: z.strictObject({
    level: levelId,
    size: size.optional(),
    ...runTiming,
    moves: z.array(z.strictObject({ slot, anchor: z.int().min(0).max(KILN_SIZES[2] ** 2 - 1) })).max(12),
  }),
  mode: z.enum(["campaign", "endless"]).optional(),
  endless: z.strictObject({
    size,
    ...runTiming,
    board: z.array(z.strictObject({ glaze: z.enum(["clay", "green"]), placedAt: z.int().positive().nullable() }).nullable()).max(KILN_SIZES[2] ** 2),
    turn: z.int().nonnegative(),
    score: z.int().nonnegative(),
    collected: z.int().nonnegative(),
    used: z.array(slot).max(2),
    order: z.strictObject({
      kind: z.enum(KILN_ORDER_KINDS),
      progress: z.int().min(0).max(1),
      remaining: z.int().positive().nullable(),
    }).optional(),
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
  const { active, unlocked, mode, endless } = parsed.data;
  if (active.level > unlocked || active.moves.length > KILN_LEVELS[active.level].turnLimit) return null;

  let game = createKilnGame(active.level, active.size);
  for (const move of active.moves) {
    const next = placeKilnPiece(game, move);
    if (!next) return null;
    game = next;
  }
  if (game.status === "won" && unlocked < Math.min(3, active.level + 1)) return null;
  const endlessGame = endless ? restoreKilnEndless(endless) : null;
  if (endless && !endlessGame) return null;
  return mode === "endless" ? endlessGame : game;
}

export function saveKilnEndless(save: KilnSave, game: KilnGame, timing: KilnRunTiming = {}): KilnSave {
  const { board, size, turn, score, collected, tray, order } = game;
  const used = tray.flatMap((piece, index) => piece ? [] : [index as KilnSlot]);
  return { ...save, mode: "endless", endless: { board, size, turn, score, collected, used, ...(order ? { order } : {}), ...timing } };
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
