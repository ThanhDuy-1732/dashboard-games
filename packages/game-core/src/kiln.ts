import { KILN_LEVELS, kilnBatch, kilnOpening } from "./kiln-levels.js";

export { KILN_LEVELS } from "./kiln-levels.js";

export const KILN_SIZES = [8, 9, 10] as const;
export type KilnSize = (typeof KILN_SIZES)[number];
export type KilnLevelId = 1 | 2 | 3;
export type KilnMode = KilnLevelId | "endless";
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
};
export type KilnEndlessState = Pick<KilnGame, "size" | "board" | "turn" | "score" | "collected"> & {
  used: readonly KilnSlot[];
};
export type KilnPlacement = {
  placed: readonly number[];
  cleared: readonly number[];
  collected: readonly number[];
  lines: number;
  points: number;
};

function boardLines(size: KilnSize): number[][] {
  const offsets = Array.from({ length: size }, (_, index) => index);
  return offsets.flatMap(n => [
    offsets.map(column => n * size + column),
    offsets.map(row => row * size + n),
  ]);
}

export function createKilnGame(level: KilnMode, size: KilnSize = KILN_SIZES[0]): KilnGame {
  const board = level === "endless" ? Array<null>(size * size).fill(null) : kilnOpening(level, size);
  return {
    level, size, board, tray: kilnBatch(level, 0),
    batch: 0, turn: 0, score: 0, collected: 0, status: "playing",
  };
}

export function kilnPotteryState(age: number): "raw" | "ready" | "broken" {
  if (age < 2) return "raw";
  return age < 4 ? "ready" : "broken";
}

function positions({ board, size }: Pick<KilnGame, "board" | "size">, piece: KilnPiece, anchor: number): number[] | null {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= board.length) return null;
  const row = Math.floor(anchor / size);
  const column = anchor % size;
  const placed: number[] = [];
  for (const [dy, dx] of piece.offsets) {
    const y = row + dy;
    const x = column + dx;
    if (y < 0 || x < 0 || y >= size || x >= size) return null;
    const index = y * size + x;
    if (board[index]) return null;
    placed.push(index);
  }
  return placed;
}

function hasPlacement(game: Pick<KilnGame, "board" | "size" | "tray">): boolean {
  return game.tray.some(piece => piece && game.board.some((_, index) => positions(game, piece, index)));
}

export function restoreKilnEndless({ used, board, size, turn, score, collected }: KilnEndlessState): KilnGame | null {
  if (board.length !== size * size || used.length !== turn % 3 || new Set(used).size !== used.length) return null;
  if (!turn && (score || collected || board.some(Boolean))) return null;
  if (board.some(tile => tile?.placedAt != null && tile.placedAt > turn)) return null;
  if (boardLines(size).some(line => line.every(index => board[index]))) return null;
  const batch = Math.floor(turn / 3);
  const tray: [KilnPiece | null, KilnPiece | null, KilnPiece | null] = [...kilnBatch("endless", batch)];
  for (const slot of used) tray[slot] = null;
  const status = hasPlacement({ board, size, tray }) ? "playing" : "lost-space";
  return { level: "endless", size, board, tray, batch, turn, score, collected, status };
}

export function inspectKilnMove(game: KilnGame, { slot, anchor }: KilnMove): KilnPlacement | null {
  const piece = game.tray[slot];
  if (game.status !== "playing" || !piece) return null;
  const placed = positions(game, piece, anchor);
  if (!placed) return null;

  const newCells = new Set(placed);
  const full = boardLines(game.size).filter(line => line.every(index => game.board[index] || newCells.has(index)));
  const cleared = [...new Set(full.flat())];
  const collected = cleared.filter(index => {
    const firedAt = game.board[index]?.placedAt;
    return firedAt != null && kilnPotteryState(game.turn + 1 - firedAt) === "ready";
  });
  const points = placed.length + full.length * 10 + collected.length * 50 + (collected.length >= 2 ? 25 : 0);
  return { placed, cleared, collected, lines: full.length, points };
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
  const level = game.level === "endless" ? null : KILN_LEVELS[game.level];
  let status: KilnStatus = "playing";
  if (level && collected >= level.target) status = "won";
  else if (level && turn >= level.turnLimit) status = "lost-turns";
  else if (!hasPlacement({ board, size: game.size, tray })) status = "lost-space";
  return { ...game, board, tray, batch, turn, score: game.score + result.points, collected, status };
}
