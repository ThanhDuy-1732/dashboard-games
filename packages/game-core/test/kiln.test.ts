import { expect, it } from "vitest";
import { createKilnGame, inspectKilnMove, placeKilnPiece } from "../src/kiln.js";
import type { KilnLevelId, KilnMove } from "../src/kiln.js";

const single = { name: "Một ô", offsets: [[0, 0]] as const, glaze: "clay" as const, potteryOffset: null };
const clay = { glaze: "clay", placedAt: null } as const;

it.each([
  [1, [14, 24, 43], 3, 188],
  [2, [0, 30], 1, 63],
  [3, [0, 27], 2, 148],
] as const)("wins fixed level %i", (level, anchors, collected, score) => {
  const slots: Record<KilnLevelId, KilnMove["slot"][]> = { 1: [0, 1, 2], 2: [1, 0], 3: [0, 1] };
  let game = createKilnGame(level);
  anchors.forEach((anchor, i) => {
    game = placeKilnPiece(game, { slot: slots[level][i]!, anchor })!;
    expect(game).not.toBeNull();
  });
  expect(game).toMatchObject({ status: "won", collected, score });
  expect(placeKilnPiece(game, { slot: 2, anchor: 0 })).toBeNull();
});

it("rejects wrapped, occupied, noninteger and spent-slot moves without advancing", () => {
  const game = createKilnGame(1);
  const before = structuredClone(game);
  for (const anchor of [-1, 7, 8, 14.5, 64]) {
    expect(inspectKilnMove(game, { slot: 0, anchor })).toBeNull();
    expect(placeKilnPiece(game, { slot: 0, anchor })).toBeNull();
  }
  expect(game).toEqual(before);
  const first = placeKilnPiece(game, { slot: 0, anchor: 14 })!;
  expect(placeKilnPiece(first, { slot: 0, anchor: 0 })).toBeNull();
});

it.each([[1, 0], [2, 1], [3, 1], [4, 0]])("counts gốm at age %i", (age, collected) => {
  const game = createKilnGame(2);
  const board = [...game.board];
  board[26] = { ...clay, placedAt: 2 - age };
  expect(placeKilnPiece({ ...game, board, turn: 1 }, { slot: 0, anchor: 30 })?.collected).toBe(collected);
});

it("deduplicates an intersection pot and previews the placement score", () => {
  const game = createKilnGame(1);
  const cross = createKilnGame(3).board.map(tile => tile ? clay : null);
  cross[27] = { ...clay, placedAt: 0 };
  cross[28] = null;
  cross[36] = null;
  cross[35] = null;
  const next = {
    ...game, turn: 1, board: cross,
    tray: [{ ...single, offsets: [[0, 1], [1, 0]] as const }, null, null] as const,
  };
  const move = { slot: 0, anchor: 27 } as const;
  const preview = inspectKilnMove(next, move)!;
  expect(preview).toMatchObject({ lines: 2, collected: [27], points: 72 });
  expect(preview.cleared).toHaveLength(15);
  const after = placeKilnPiece(next, move)!;
  expect(after.score).toBe(preview.points);
  expect(after.board.flatMap((tile, index) => !tile && next.board[index] ? [index] : []))
    .toEqual(preview.cleared.filter(index => next.board[index]).toSorted((a, b) => a - b));
});

it("never harvests a newly placed pot", () => {
  const game = createKilnGame(3);
  const tray = [null, { ...single, potteryOffset: 0 }, null] as const;
  expect(inspectKilnMove({ ...game, tray }, { slot: 1, anchor: 27 })?.collected).toEqual([]);
});

it("checks wins before turn limits and detects when all remaining pieces are blocked", () => {
  const base = createKilnGame(2);
  const finalTurn = { ...base, turn: 2 };
  expect(placeKilnPiece(finalTurn, { slot: 0, anchor: 30 })?.status).toBe("won");
  expect(placeKilnPiece(finalTurn, { slot: 1, anchor: 0 })?.status).toBe("lost-turns");
  const board = base.board.map((_, index) => (index + Math.floor(index / 8)) % 2 === 0 ? null : clay);
  expect(placeKilnPiece({ ...base, board }, { slot: 1, anchor: 0 })?.status).toBe("lost-space");
});

it("replenishes only when all three slots are spent and follows the fixed next batch", () => {
  let game = createKilnGame(1);
  for (const move of [{ slot: 1, anchor: 48 }, { slot: 0, anchor: 14 }, { slot: 2, anchor: 43 }] as const) {
    game = placeKilnPiece(game, move)!;
  }
  expect(game.batch).toBe(1);
  expect(game.tray.map(piece => piece?.potteryOffset)).toEqual([0, 1, null]);
});

it.each([9, 10] as const)("keeps all opening routes playable on a board of size %i", size => {
  const routes = [
    { level: 1, moves: [{ slot: 0, anchor: 2 * size - 2 }, { slot: 1, anchor: 3 * size }, { slot: 2, anchor: 5 * size + 3 }], score: 188 },
    { level: 2, moves: [{ slot: 1, anchor: 0 }, { slot: 0, anchor: 4 * size - 2 }], score: 63 },
    { level: 3, moves: [{ slot: 0, anchor: 0 }, { slot: 1, anchor: 3 * size + 3 }], score: 148 },
  ] as const;

  for (const { level, moves, score } of routes) {
    let game = createKilnGame(level, size);
    expect(game.board).toHaveLength(size * size);
    expect(inspectKilnMove(game, { slot: 0, anchor: size - 1 })).toBeNull();
    for (const move of moves) game = placeKilnPiece(game, move)!;
    expect(game).toMatchObject({ status: "won", score, size });
  }

  const cross = placeKilnPiece(createKilnGame(3, size), { slot: 0, anchor: 0 })!;
  expect(inspectKilnMove(cross, { slot: 1, anchor: 3 * size + 3 })?.cleared).toHaveLength(2 * size - 1);
});
