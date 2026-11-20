import { describe, expect, it } from "vitest";
import {
  CARO_SIZE,
  chooseCaroMove,
  createCaro,
  playCaro,
  restoreCaro,
} from "../src/caro.js";

const at = (row: number, col: number) => row * CARO_SIZE + col;

describe("Cờ Caro", () => {
  it.each([
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const)("wins with exactly five along direction (%s, %s)", (dy, dx) => {
    const line = Array.from({ length: 5 }, (_, i) =>
      at(3 + dy * i, 6 + dx * i),
    );
    const moves = line.flatMap((index, i) =>
      i < 4 ? [index, at(12, 2 * i)] : [index],
    );
    const game = restoreCaro(moves)!;
    expect(game.result).toEqual({ winner: "X", line });
    expect(playCaro(game, at(1, 1))).toBeNull();
  });

  it("rejects two opposing ends and overlines, while allowing the board edge", () => {
    const blocked = [1, 0, 2, 6, 3, 20, 4, 40, 5];
    expect(restoreCaro(blocked)?.result).toBeNull();
    expect(restoreCaro([0, 5, 1, 20, 2, 22, 3, 24, 4])?.result).toEqual({
      winner: "X",
      line: [0, 1, 2, 3, 4],
    });
    expect(
      restoreCaro([0, 30, 1, 32, 3, 34, 4, 36, 5, 38, 2])?.result,
    ).toBeNull();
    expect(
      restoreCaro([13, 30, 14, 32, 15, 34, 16, 36, 17])?.result,
    ).toBeNull();
  });

  it("identifies a full board without a win and rejects invalid saved moves", () => {
    const x: number[] = [];
    const o: number[] = [];
    for (let row = 0; row < CARO_SIZE; row++) {
      for (let col = 0; col < CARO_SIZE; col++) {
        const target = (col + Number(row % 4 >= 2)) % 2 === 0 ? x : o;
        target.push(at(row, col));
      }
    }
    const draw = x.flatMap((index, i) =>
      o[i] === undefined ? [index] : [index, o[i]!],
    );
    expect(restoreCaro(draw)?.result).toEqual({ winner: null });
    expect(restoreCaro([112, 112])).toBeNull();
    expect(restoreCaro([-1])).toBeNull();
    expect(restoreCaro([225])).toBeNull();
    expect(restoreCaro([0.1])).toBeNull();
  });

  it("has the normal bot take a win or block an immediate opponent win", () => {
    expect(chooseCaroMove(createCaro(), "normal")).toBe(at(7, 7));
    const mustBlock = restoreCaro([0, 30, 1, 32, 2, 34, 3])!;
    expect(chooseCaroMove(mustBlock, "normal")).toBe(4);
    const canWin = restoreCaro([0, 30, 2, 31, 4, 32, 6, 33, 8])!;
    expect(chooseCaroMove(canWin, "normal")).toBe(34);
    const easyMove = chooseCaroMove(mustBlock, "easy", () => 0);
    expect(mustBlock.board[easyMove!]).toBeNull();
  });
});
