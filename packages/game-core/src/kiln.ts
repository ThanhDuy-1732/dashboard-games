import { KILN_LEVELS, kilnBatch, kilnOpening } from "./kiln-levels.js";
import { KILN_LOCKED_SIZE, makeKilnLocks, tickKilnLocks } from "./kiln-locks.js";
import type { KilnLock } from "./kiln-locks.js";
import { advanceKilnOrder, startKilnOrder, validKilnOrder } from "./kiln-orders.js";
import type { KilnOrderResult, KilnOrderState } from "./kiln-orders.js";

export { KILN_LEVELS } from "./kiln-levels.js";
export { KILN_LOCKED_SIZE, KILN_LOCK_COUNT, KILN_LOCK_KINDS } from "./kiln-locks.js";
export { KILN_ORDER_KINDS, KILN_ORDERS } from "./kiln-orders.js";

export const KILN_SIZES = [8, 9, 10] as const;
export type KilnSize = (typeof KILN_SIZES)[number];
export type KilnLevelId = 1 | 2 | 3;
export type KilnFreeMode = "endless" | "locked";
export type KilnMode = KilnLevelId | KilnFreeMode;
export type KilnSlot = 0 | 1 | 2;
export type KilnMove = { slot: KilnSlot; anchor: number };
export type KilnStatus = "playing" | "won" | "lost-turns" | "lost-space";
export type KilnTile = { glaze: "clay" | "green"; placedAt: number | null };
export type KilnPiece = {
  name: string;
  offsets: readonly (readonly [row: number, column: number])[];
  glaze: KilnTile["glaze"];
  potteryOffset: number | null;
};
export type KilnGame = {
  level: KilnMode;
  size: KilnSize;
  board: readonly (KilnTile | null)[];
  tray: readonly [KilnPiece | null, KilnPiece | null, KilnPiece | null];
  batch: number;
  turn: number;
  score: number;
  collected: number;
  status: KilnStatus;
  order?: KilnOrderState;
  locks?: readonly KilnLock[];
};
export type KilnFreeState = Pick<KilnGame, "size" | "board" | "turn" | "score" | "collected" | "order" | "locks"> & {
  used: readonly KilnSlot[];
};
export type KilnPlacement = {
  placed: readonly number[];
  cleared: readonly number[];
  collected: readonly number[];
  lines: number;
  points: number;
  order?: KilnOrderResult;
  lockUpdate?: ReturnType<typeof tickKilnLocks>;
};

function boardLines(size: KilnSize): number[][] {
  const offsets = Array.from({ length: size }, (_, index) => index);
  return offsets.flatMap(n => [
    offsets.map(column => n * size + column),
    offsets.map(row => row * size + n),
  ]);
}

export function createKilnGame(level: KilnMode, boardSize: KilnSize = KILN_SIZES[0], random = Math.random): KilnGame {
  const size = level === "locked" ? KILN_LOCKED_SIZE : boardSize;
  const board = typeof level === "string" ? Array<null>(size * size).fill(null) : kilnOpening(level, size);
  return {
    level, size, board, tray: kilnBatch(level, 0),
    batch: 0, turn: 0, score: 0, collected: 0, status: "playing",
    ...(level === "endless" ? { order: startKilnOrder() } : {}),
    ...(level === "locked" ? { locks: makeKilnLocks(random) } : {}),
  };
}

export function kilnPotteryState(age: number): "raw" | "ready" | "broken" {
  if (age < 2) return "raw";
  return age < 4 ? "ready" : "broken";
}

function positions({ board, size, locks }: Pick<KilnGame, "board" | "size" | "locks">, piece: KilnPiece, anchor: number): number[] | null {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= board.length) return null;
  const row = Math.floor(anchor / size);
  const column = anchor % size;
  const placed: number[] = [];
  for (const [dy, dx] of piece.offsets) {
    const y = row + dy;
    const x = column + dx;
    if (y < 0 || x < 0 || y >= size || x >= size) return null;
    const index = y * size + x;
    if (board[index] || locks?.some(lock => lock.index === index)) return null;
    placed.push(index);
  }
  return placed;
}

function hasPlacement(game: Pick<KilnGame, "board" | "size" | "tray" | "locks">): boolean {
  return game.tray.some(piece => piece && game.board.some((_, index) => positions(game, piece, index)));
}

export function restoreKilnFreePlay(level: KilnFreeMode, { used, board, size, turn, score, collected, order = startKilnOrder(), locks }: KilnFreeState): KilnGame | null {
  if (board.length !== size * size || used.length !== turn % 3 || new Set(used).size !== used.length) return null;
  if (!turn && (score || collected || board.some(Boolean))) return null;
  if (board.some(tile => tile?.placedAt != null && tile.placedAt > turn)) return null;
  if (boardLines(size).some(line => line.every(index => board[index]))) return null;
  if (level === "endless" && !validKilnOrder(order)) return null;
  if (level === "locked") {
    if (size !== KILN_LOCKED_SIZE || !locks || new Set(locks.map(lock => lock.index)).size !== locks.length) return null;
    if (locks.some(lock => board[lock.index])) return null;
  }
  const batch = Math.floor(turn / 3);
  const tray: [KilnPiece | null, KilnPiece | null, KilnPiece | null] = [...kilnBatch(level, batch)];
  for (const slot of used) tray[slot] = null;
  const status = hasPlacement({ board, size, tray, locks }) ? "playing" : "lost-space";
  return {
    level, size, board, tray, batch, turn, score, collected, status,
    ...(level === "endless" ? { order } : { locks }),
  };
}

export function inspectKilnMove(game: KilnGame, { slot, anchor }: KilnMove): KilnPlacement | null {
  const piece = game.tray[slot];
  if (game.status !== "playing" || !piece) return null;
  const placed = positions(game, piece, anchor);
  if (!placed) return null;

  const newCells = new Set(placed);
  const full = boardLines(game.size).flatMap((cells, index) =>
    cells.every(cell => game.board[cell] || newCells.has(cell)) ? [{ cells, row: index % 2 === 0 }] : []);
  const cleared = [...new Set(full.flatMap(line => line.cells))];
  const collected = cleared.filter(index => {
    const firedAt = game.board[index]?.placedAt;
    return firedAt != null && kilnPotteryState(game.turn + 1 - firedAt) === "ready";
  });
  const rows = full.filter(line => line.row).length;
  const order = game.level === "endless"
    ? advanceKilnOrder(game.order ?? startKilnOrder(), { pots: collected.length, rows, columns: full.length - rows })
    : undefined;
  const points = placed.length + full.length * 10 + collected.length * 50 + (collected.length >= 2 ? 25 : 0) + (order?.bonus ?? 0);
  const lockUpdate = game.locks ? tickKilnLocks(game.locks, full.length) : undefined;
  return { placed, cleared, collected, lines: full.length, points, ...(order ? { order } : {}), ...(lockUpdate ? { lockUpdate } : {}) };
}

export function placeKilnPiece(game: KilnGame, move: KilnMove): KilnGame | null {
  const result = inspectKilnMove(game, move);
  if (!result) return null;
  const piece = game.tray[move.slot]!;
  const turn = game.turn + 1;
  const board = [...game.board];
  result.placed.forEach((index, offset) => {
    board[index] = { glaze: piece.glaze, placedAt: offset === piece.potteryOffset ? turn : null };
  });
  result.cleared.forEach(index => { board[index] = null; });

  let tray: [KilnPiece | null, KilnPiece | null, KilnPiece | null] = [...game.tray];
  tray[move.slot] = null;
  let batch = game.batch;
  if (tray.every(entry => entry === null)) {
    batch++;
    tray = [...kilnBatch(game.level, batch)];
  }

  const collected = game.collected + result.collected.length;
  const level = typeof game.level === "number" ? KILN_LEVELS[game.level] : null;
  const locks = result.lockUpdate?.remaining;
  let status: KilnStatus = "playing";
  if (level && collected >= level.target) status = "won";
  else if (level && turn >= level.turnLimit) status = "lost-turns";
  else if (!hasPlacement({ board, size: game.size, tray, locks })) status = "lost-space";
  return {
    ...game, board, tray, batch, turn, score: game.score + result.points, collected, status,
    ...(result.order ? { order: result.order.next } : {}),
    ...(locks ? { locks } : {}),
  };
}
