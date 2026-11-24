import type { KilnLevelId, KilnMode, KilnPiece, KilnSize, KilnTile } from "./kiln.js";

type Batch = readonly [KilnPiece, KilnPiece, KilnPiece];

const domino: KilnPiece = { name: "Hai ô ngang", offsets: [[0, 0], [0, 1]], glaze: "green", potteryOffset: null };
const corner: KilnPiece = { name: "Ba ô chữ L", offsets: [[0, 0], [0, 1], [1, 0]], glaze: "clay", potteryOffset: null };
const bar: KilnPiece = { name: "Ba ô ngang", offsets: [[0, 0], [0, 1], [0, 2]], glaze: "green", potteryOffset: null };
const potteryBar: KilnPiece = { ...bar, name: "Ba ô ngang có gốm", glaze: "clay", potteryOffset: 1 };
const single: KilnPiece = { name: "Một ô", offsets: [[0, 0]], glaze: "clay", potteryOffset: null };
const square: KilnPiece = { name: "Vuông có gốm", offsets: [[0, 0], [0, 1], [1, 0], [1, 1]], glaze: "clay", potteryOffset: 0 };
const upright: KilnPiece = { name: "Hai ô dọc có gốm", offsets: [[0, 0], [1, 0]], glaze: "green", potteryOffset: 1 };
const laterBatches: readonly Batch[] = [[square, upright, single], [domino, square, bar], [corner, upright, single]];

export const KILN_LEVELS = {
  1: { id: 1, name: "Mẻ đầu tay", turnLimit: 12, target: 3 },
  2: { id: 2, name: "Đợi đúng lửa", turnLimit: 3, target: 1 },
  3: { id: 3, name: "Hai bình một mẻ", turnLimit: 3, target: 2 },
} as const;

const openings = {
  1: ["........", "ccpcgg..", "..gg....", "..cpcggc", "....cc..", "gcp...cg", "..g.....", "........"],
  2: ["........", "........", "........", "ccpcgg..", "........", "........", "........", "........"],
  3: ["...c....", "...p....", "...c....", "cpc.cccc", "...c....", "...c....", "...c....", "...c...."],
} as const;

function openingRow(level: KilnLevelId, y: number, size: KilnSize): string {
  const row = openings[level][y] ?? (level === 3 ? "...c" : "");
  if ((level === 1 && y === 1) || (level === 2 && y === 3)) {
    return row.slice(0, 6).padEnd(size - 2, "c") + "..";
  }
  const extendsLine = (level === 1 && (y === 3 || y === 5)) || (level === 3 && y === 3);
  return row.padEnd(size, extendsLine ? "c" : ".");
}

export function kilnOpening(level: KilnLevelId, size: KilnSize): (KilnTile | null)[] {
  const rows = Array.from({ length: size }, (_, y) => openingRow(level, y, size));
  return rows.flatMap((row, y) => Array.from(row, value => {
    if (value === ".") return null;
    return {
      glaze: value === "g" ? "green" : "clay",
      placedAt: value === "p" ? (level === 1 && y === 1 ? -1 : 0) : null,
    };
  }));
}

export function kilnBatch(level: KilnMode, batch: number): Batch {
  if (level === "locked") {
    return batch === 0 ? [domino, bar, potteryBar] : laterBatches[(batch - 1) % laterBatches.length]!;
  }
  if (level === "endless") return laterBatches[batch % laterBatches.length]!;
  if (level !== 1) return [domino, single, corner];
  if (!batch) return [domino, corner, bar];
  return laterBatches[(batch - 1) % laterBatches.length]!;
}
