import { expect, it } from "vitest";
import { createKilnGame, inspectKilnMove, placeKilnPiece } from "../src/kiln.js";

it.each([0, 0.23, 0.61, 0.999])("generates a playable mixed layout with random value %s", random => {
  let game = createKilnGame("locked", 8, () => random);
  const locks = game.locks!;
  expect(locks).toHaveLength(5);
  expect(new Set(locks.map(lock => lock.index)).size).toBe(5);
  expect(new Set(locks.map(lock => lock.kind))).toEqual(new Set(["turns", "blasts"]));
  expect(inspectKilnMove(game, { slot: 0, anchor: locks[0]!.index })).toBeNull();

  const row = Array.from({ length: 8 }, (_, index) => index)
    .find(index => locks.every(lock => Math.floor(lock.index / 8) !== index))!;
  for (const [slot, column] of [[0, 0], [1, 2], [2, 5]] as const) {
    game = placeKilnPiece(game, { slot, anchor: 8 * row + column })!;
  }
  expect(game.board.every(tile => !tile)).toBe(true);
  expect(game.status).toBe("playing");
  for (const lock of game.locks!) {
    const initial = locks.find(start => start.index === lock.index)!;
    expect(lock.remaining).toBe(initial.remaining - (lock.kind === "turns" ? 3 : 1));
  }
  expect(game.locks?.some(lock => lock.kind === "turns")).toBe(true);
});

it("counts both lines toward blast locks without aging failed placements", () => {
  const base = createKilnGame("locked");
  const board = base.board.map((_, i) => i && (i < 8 || i % 8 === 0) ? { glaze: "clay" as const, placedAt: null } : null);
  const single = { name: "Một ô", glaze: "clay", offsets: [[0, 0]], potteryOffset: null } as const;
  const game = {
    ...base, board, tray: [single, base.tray[1], base.tray[2]] as const,
    locks: [{ index: 10, kind: "blasts", remaining: 2 }, { index: 11, kind: "turns", remaining: 2 }] as const,
  };
  expect(placeKilnPiece(game, { slot: 0, anchor: 10 })).toBeNull();
  expect(inspectKilnMove(game, { slot: 0, anchor: 0 })?.lockUpdate?.opened).toEqual([10]);
  const next = placeKilnPiece(game, { slot: 0, anchor: 0 })!;
  expect(next.locks).toEqual([{ index: 11, kind: "turns", remaining: 1 }]);
  expect(placeKilnPiece(next, { slot: 1, anchor: 10 })).toBeNull(); // crosses the other lock
  const unlock = placeKilnPiece(next, { slot: 1, anchor: 3 })!;
  expect(unlock.locks).toEqual([]);
  expect(inspectKilnMove(unlock, { slot: 2, anchor: 10 })).not.toBeNull();
});
