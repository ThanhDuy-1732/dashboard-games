import { z } from "zod";
import { FLOWER_LEVELS, flowerHint, flowerLevel, flowerMatches, flowerStars, flowerStatus, isFlowerLock } from "@nha-choi/game-core";
import type { FlowerGame } from "@nha-choi/game-core";

export const FLOWER_SAVE_KEY = "nha-choi-flower-offline-v1";
const count = z.number().int().min(0).max(1_000_000);
const score = z.number().int().min(0).max(1_000_000_000);
const color = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const gameSchema = z.object({
  mode: z.enum(["quick", "journey", "mystery"]), level: z.number().int().min(0).max(12),
  board: z.array(z.object({ color, obstacle: z.object({ kind: z.enum(["rock", "bud", "turn-lock", "blast-lock"]), hp: z.number().int().min(1).max(4) }).strict().nullable() }).strict()).length(49),
  grass: z.array(z.number().int().min(0).max(48)).max(6),
  movesLeft: z.number().int().min(0).max(30), score,
  harvested: z.array(count).length(5), cleared: z.object({ grass: count, rock: count, bud: count }).strict(),
  tools: z.object({ shovel: z.number().int().min(0).max(1), water: z.number().int().min(0).max(1) }).strict(),
  status: z.enum(["playing", "won", "lost"]), revision: count,
}).strict().refine((game) => {
  try {
    const config = flowerLevel(game);
    if (game.movesLeft > config.moves || new Set(game.grass).size !== game.grass.length) return false;
    const usedTools = game.mode !== "journey" ? 0 : 2 - game.tools.shovel - game.tools.water;
    if (game.mode !== "journey" && (game.tools.shovel || game.tools.water)) return false;
    if (game.revision !== config.moves - game.movesLeft + usedTools) return false;
    const locks = game.board.flatMap(cell => isFlowerLock(cell.obstacle) ? [cell.obstacle!] : []);
    if (locks.length > 6 || (game.mode !== "mystery" && locks.length)) return false;
    if (game.mode === "mystery") {
      if (game.revision === 0 && (locks.length < 4 || locks.some(lock => lock.hp < 2))) return false;
      const turns = config.moves - game.movesLeft;
      if (locks.some(lock => lock.kind === "turn-lock" && lock.hp > 4 - turns)) return false;
    }
    if (game.grass.some(i => !config.grass.includes(i) || game.board[i]!.obstacle) || game.cleared.grass !== config.grass.length - game.grass.length) return false;
    for (const kind of ["rock", "bud"] as const) {
      const positions = kind === "rock" ? config.rocks : config.buds;
      const remaining = game.board.flatMap((cell, i) => cell.obstacle?.kind === kind ? [i] : []);
      if (remaining.some(i => !positions.includes(i) || game.board[i]!.obstacle!.hp > (kind === "rock" ? 2 : 4))) return false;
      if (game.cleared[kind] !== positions.length - remaining.length) return false;
    }
    return game.status === flowerStatus(game) && !flowerMatches(game.board).length && flowerHint(game.board) !== null;
  } catch { return false; }
}, "Bản lưu Vườn Hoa không nhất quán.");
const saveSchema = z.object({
  version: z.literal(1),
  levels: z.array(z.object({ stars: z.number().int().min(0).max(3), score }).strict()).length(12),
  quick: gameSchema.nullable(), journey: gameSchema.nullable(), mystery: gameSchema.nullable().default(null),
}).strict().refine(save => {
  if (save.quick && save.quick.mode !== "quick" || save.journey && save.journey.mode !== "journey") return false;
  if (save.mystery && save.mystery.mode !== "mystery") return false;
  let locked = false;
  for (const level of save.levels) {
    if (locked && level.stars > 0) return false;
    if (!level.stars) locked = true;
  }
  const unlocked = Math.min(12, save.levels.findIndex(l => !l.stars) < 0 ? 12 : save.levels.findIndex(l => !l.stars) + 1);
  if (save.journey?.status === "won") {
    const best = save.levels[save.journey.level - 1]!;
    if (best.stars < flowerStars(save.journey) || best.score < save.journey.score) return false;
  }
  return !save.journey || save.journey.level <= unlocked;
});
export interface FlowerSave {
  version: 1; levels: { stars: number; score: number }[];
  quick: FlowerGame | null; journey: FlowerGame | null; mystery: FlowerGame | null;
}
export function emptyFlowerSave(): FlowerSave {
  return { version: 1, levels: FLOWER_LEVELS.map(() => ({ stars: 0, score: 0 })), quick: null, journey: null, mystery: null };
}
export function flowerUnlocked(save: FlowerSave) {
  const first = save.levels.findIndex(level => level.stars === 0);
  return first < 0 ? 12 : first + 1;
}
export function recordFlowerGame(save: FlowerSave, game: FlowerGame): FlowerSave {
  const levels = save.levels.map(l => ({ ...l }));
  if (game.mode === "journey" && game.status === "won") {
    const previous = levels[game.level - 1]!;
    levels[game.level - 1] = { stars: Math.max(previous.stars, flowerStars(game)), score: Math.max(previous.score, game.score) };
  }
  return { ...save, levels, [game.mode]: game };
}
export interface FlowerSaveRead { save: FlowerSave; raw: string | null; problem: string | null; corrupt: boolean }
export function readFlowerSave(): FlowerSaveRead {
  let raw: string | null;
  try { raw = localStorage.getItem(FLOWER_SAVE_KEY); }
  catch { return { save: emptyFlowerSave(), raw: null, corrupt: false, problem: "Không đọc được bản lưu Vườn Hoa trên thiết bị này. Bạn có thể chơi, nhưng tiến độ có thể chưa được lưu." }; }
  if (raw === null) return { save: emptyFlowerSave(), raw, problem: null, corrupt: false };
  try {
    const result = raw.length <= 100_000 ? saveSchema.safeParse(JSON.parse(raw)) : null;
    if (result?.success) return { save: result.data, raw, problem: null, corrupt: false };
  } catch { /* Invalid JSON is handled as a corrupt record, never overwritten on read. */ }
  return { save: emptyFlowerSave(), raw, corrupt: true, problem: "Bản lưu Vườn Hoa bị hỏng hoặc thuộc phiên bản khác. Bắt đầu mới sẽ đặt lại các ván và tiến độ 12 màn trên thiết bị." };
}
export class FlowerSaveConflict extends Error {
  constructor() { super("Bản lưu đã thay đổi ở trang khác. Hãy chọn bản muốn tiếp tục."); }
}
export async function writeFlowerSave(save: FlowerSave, expectedRaw: string | null): Promise<string> {
  const next = JSON.stringify(saveSchema.parse(save));
  // A readwrite transaction serializes this compare/write across tabs, including older WebViews without Web Locks.
  return new Promise((resolve, reject) => {
    let blocked = false;
    const opening = indexedDB.open("nha-choi-flower-save-lock", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("mutex");
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => { blocked = true; reject(new Error("Kho lưu Vườn Hoa đang bị chặn. Hãy đóng trang cũ và thử lại.")); };
    opening.onsuccess = () => {
      const db = opening.result;
      if (blocked) { db.close(); return; }
      let transaction: IDBTransaction;
      try { transaction = db.transaction("mutex", "readwrite"); }
      catch (reason) { db.close(); reject(reason); return; }
      let failure: unknown;
      transaction.objectStore("mutex").put(0, "lock").onsuccess = () => {
        try {
          if (localStorage.getItem(FLOWER_SAVE_KEY) !== expectedRaw) throw new FlowerSaveConflict();
          localStorage.setItem(FLOWER_SAVE_KEY, next);
        } catch (reason) { failure = reason; transaction.abort(); }
      };
      transaction.oncomplete = () => { db.close(); resolve(next); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(failure ?? transaction.error ?? new Error("Không ghi được bản lưu Vườn Hoa.")); };
    };
  });
}
