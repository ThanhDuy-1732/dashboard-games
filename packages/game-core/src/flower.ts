export type FlowerColor = 0 | 1 | 2 | 3 | 4;
export type FlowerMode = "quick" | "journey" | "mystery";
export type FlowerTool = "shovel" | "water";
export type FlowerObstacle = { kind: "rock" | "bud" | "turn-lock" | "blast-lock"; hp: number };
export function isFlowerLock(obstacle: FlowerObstacle | null) {
  return obstacle?.kind === "turn-lock" || obstacle?.kind === "blast-lock";
}
export interface FlowerCell { color: FlowerColor; obstacle: FlowerObstacle | null }
export interface FlowerGoal {
  kind: "score" | "flower" | "grass" | "rock" | "bud";
  color?: FlowerColor;
  target: number;
}
export interface FlowerLevel {
  id: number; name: string; moves: number; goals: FlowerGoal[];
  grass: number[]; rocks: number[]; buds: number[];
}
export interface FlowerGame {
  mode: FlowerMode; level: number; board: FlowerCell[]; grass: number[];
  movesLeft: number; score: number; harvested: number[];
  cleared: { grass: number; rock: number; bud: number };
  tools: Record<FlowerTool, number>;
  status: "playing" | "won" | "lost"; revision: number;
}
export interface FlowerFrame {
  kind: "swap" | "burst" | "fall" | "shuffle" | "unlock";
  board: FlowerCell[]; grass: number[]; score: number;
  indices: number[]; drops: Record<number, number>; combo: number;
}
export interface FlowerTurn { game: FlowerGame; frames: FlowerFrame[] }
export const FLOWER_NAMES = ["Hoa hồng", "Cúc vàng", "Lưu ly", "Hoa tím", "Hoa lá xanh"] as const;
const GRASS = [5, 8, 28, 36, 41, 46];
const ROCKS = [11, 18, 32, 39];
const BUDS = [10, 33, 44];
const goal = (kind: FlowerGoal["kind"], target: number, color?: FlowerColor): FlowerGoal =>
  color === undefined ? { kind, target } : { kind, target, color };
export const FLOWER_LEVELS: FlowerLevel[] = [
  { id: 1, name: "Nắng đầu vườn", moves: 20, goals: [goal("score", 800)], grass: [], rocks: [], buds: [] },
  { id: 2, name: "Một sắc hồng", moves: 20, goals: [goal("flower", 18, 0)], grass: [], rocks: [], buds: [] },
  { id: 3, name: "Hoa có bạn", moves: 22, goals: [goal("flower", 15, 0), goal("flower", 15, 1)], grass: [], rocks: [], buds: [] },
  { id: 4, name: "Lối nhỏ xanh", moves: 22, goals: [goal("score", 1500)], grass: GRASS.slice(0, 4), rocks: [], buds: [] },
  { id: 5, name: "Dọn cỏ, đón hoa", moves: 24, goals: [goal("grass", 6)], grass: GRASS, rocks: [], buds: [] },
  { id: 6, name: "Sắc xanh dịu dàng", moves: 24, goals: [goal("flower", 24, 2)], grass: GRASS, rocks: [], buds: [] },
  { id: 7, name: "Qua miền đá nhỏ", moves: 25, goals: [goal("rock", 4)], grass: [], rocks: ROCKS, buds: [] },
  { id: 8, name: "Vườn sau cơn mưa", moves: 25, goals: [goal("score", 2000)], grass: GRASS.slice(0, 4), rocks: ROCKS, buds: [] },
  { id: 9, name: "Đánh thức nụ hoa", moves: 26, goals: [goal("bud", 2)], grass: [], rocks: [], buds: BUDS.slice(0, 2) },
  { id: 10, name: "Lối đi rộng mở", moves: 26, goals: [goal("grass", 4), goal("rock", 4)], grass: GRASS.slice(0, 4), rocks: ROCKS, buds: [] },
  { id: 11, name: "Nụ hoa thức giấc", moves: 28, goals: [goal("bud", 3)], grass: GRASS.slice(0, 4), rocks: [], buds: BUDS },
  { id: 12, name: "Cả khu vườn nở rộ", moves: 30, goals: [goal("bud", 3), goal("score", 2500)], grass: GRASS.slice(0, 4), rocks: ROCKS, buds: BUDS },
];
const QUICK: FlowerLevel = { id: 0, name: "Chơi nhanh", moves: 20, goals: [goal("score", 1500)], grass: [], rocks: [], buds: [] };
const MYSTERY: FlowerLevel = { ...QUICK, name: "Vườn khóa bí ẩn" };
export function flowerLevel(game: Pick<FlowerGame, "mode" | "level">): FlowerLevel {
  if (game.mode === "quick" && game.level === 0) return QUICK;
  if (game.mode === "mystery" && game.level === 0) return MYSTERY;
  const config = FLOWER_LEVELS[game.level - 1];
  if (game.mode !== "journey" || !Number.isInteger(game.level) || !config) throw new RangeError("Màn Vườn Hoa không hợp lệ.");
  return config;
}
export function flowerAdjacent(a: number, b: number) {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a < 49 && b >= 0 && b < 49 &&
    Math.abs(a % 7 - b % 7) + Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) === 1;
}
export function flowerMatches(board: FlowerCell[]): number[] {
  const found = new Set<number>();
  for (let axis = 0; axis < 2; axis++) for (let line = 0; line < 7; line++) {
    let run: number[] = [];
    for (let offset = 0; offset <= 7; offset++) {
      const index = axis ? offset * 7 + line : line * 7 + offset;
      const color = offset < 7 && !board[index]!.obstacle ? board[index]!.color : -1;
      if (run.length && (color < 0 || color !== board[run[0]!]!.color)) {
        if (run.length >= 3) run.forEach(i => found.add(i));
        run = [];
      }
      if (color >= 0) run.push(index);
    }
  }
  return [...found];
}
function exchanged(board: FlowerCell[], a: number, b: number) {
  const next = [...board]; [next[a], next[b]] = [next[b]!, next[a]!]; return next;
}
export function flowerHint(board: FlowerCell[]): [number, number] | null {
  for (let a = 0; a < 49; a++) for (const b of [a + 1, a + 7]) {
    if (!flowerAdjacent(a, b) || board[a]!.obstacle || board[b]!.obstacle || board[a]!.color === board[b]!.color) continue;
    const found = flowerMatches(exchanged(board, a, b));
    if (found.includes(a) || found.includes(b)) return [a, b];
  }
  return null;
}
const copyBoard = (board: FlowerCell[]) => board.map(cell => ({ ...cell, obstacle: cell.obstacle ? { ...cell.obstacle } : null }));
function randomInt(random: () => number, min: number, max: number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("Nguồn ngẫu nhiên không hợp lệ.");
  return min + Math.floor(value * (max - min + 1));
}
const color = (random: () => number) => randomInt(random, 0, 4) as FlowerColor;
function freshBoard(obstacles: FlowerCell[], random: () => number, keepLockedFlowers = true): FlowerCell[] {
  let seed = 17;
  for (let attempt = 0; attempt < 128; attempt++) {
    // Constant random sources still get a bounded, deterministic fallback.
    const draw = attempt < 8 ? random : () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const board: FlowerCell[] = [];
    for (let i = 0; i < 49; i++) {
      const choices = ([0, 1, 2, 3, 4] as FlowerColor[]).filter(c =>
        !(i % 7 >= 2 && !board[i - 1]!.obstacle && !board[i - 2]!.obstacle && board[i - 1]!.color === c && board[i - 2]!.color === c) &&
        !(i >= 14 && !board[i - 7]!.obstacle && !board[i - 14]!.obstacle && board[i - 7]!.color === c && board[i - 14]!.color === c));
      const pick = color(draw);
      board.push({ color: keepLockedFlowers && isFlowerLock(obstacles[i]?.obstacle ?? null) ? obstacles[i]!.color : choices[pick % choices.length]!, obstacle: obstacles[i]?.obstacle ? { ...obstacles[i]!.obstacle! } : null });
    }
    // Every configured board leaves this teaching move clear.
    if ([16, 22, 23, 24].every(i => !board[i]!.obstacle)) {
      for (const i of [16, 22, 24]) board[i]!.color = 0;
      board[23]!.color = 1;
    }
    if (!flowerMatches(board).length && flowerHint(board)) return board;
  }
  throw new Error("Không tạo được bàn hoa có nước đi.");
}
export function flowerGoals(game: FlowerGame) {
  return flowerLevel(game).goals.map(g => ({ ...g, current: g.kind === "score" ? game.score : g.kind === "flower" ? game.harvested[g.color!]! : game.cleared[g.kind] }));
}
export function flowerStatus(game: FlowerGame): FlowerGame["status"] {
  return flowerGoals(game).every(g => g.current >= g.target) ? "won" : game.movesLeft === 0 ? "lost" : "playing";
}
export function flowerStars(game: FlowerGame) {
  if (game.status !== "won") return 0;
  const fraction = game.movesLeft / flowerLevel(game).moves;
  return fraction >= 0.4 ? 3 : fraction >= 0.2 ? 2 : 1;
}
export function createFlowerGame(mode: FlowerMode, level = mode === "journey" ? 1 : 0, random = Math.random): FlowerGame {
  const config = flowerLevel({ mode, level });
  const board: FlowerCell[] = Array.from({ length: 49 }, () => ({ color: 0, obstacle: null }));
  config.rocks.forEach(i => board[i]!.obstacle = { kind: "rock", hp: 2 });
  config.buds.forEach(i => board[i]!.obstacle = { kind: "bud", hp: 4 });
  if (mode === "mystery") {
    const available = Array.from({ length: 49 }, (_, i) => i).filter(i => ![16, 22, 23, 24].includes(i));
    const count = randomInt(random, 4, 6);
    for (let i = 0; i < count; i++) {
      const [index] = available.splice(randomInt(random, 0, available.length - 1), 1);
      board[index!]!.obstacle = { kind: randomInt(random, 0, 1) === 0 ? "turn-lock" : "blast-lock", hp: randomInt(random, 2, 4) };
    }
  }
  return { mode, level, board: freshBoard(board, random, false), grass: [...config.grass], movesLeft: config.moves, score: 0,
    harvested: [0, 0, 0, 0, 0], cleared: { grass: 0, rock: 0, bud: 0 },
    tools: { shovel: mode === "journey" ? 1 : 0, water: mode === "journey" ? 1 : 0 }, status: "playing", revision: 0 };
}
function copyGame(game: FlowerGame): FlowerGame {
  return { ...game, board: copyBoard(game.board), grass: [...game.grass], harvested: [...game.harvested], cleared: { ...game.cleared }, tools: { ...game.tools } };
}
function snapshot(game: FlowerGame, kind: FlowerFrame["kind"], indices: number[] = [], combo = 0, drops: Record<number, number> = {}): FlowerFrame {
  return { kind, board: copyBoard(game.board), grass: [...game.grass], score: game.score, indices, combo, drops };
}
function fall(game: FlowerGame, removed: Set<number>, random: () => number) {
  const drops: Record<number, number> = {};
  for (let col = 0; col < 7; col++) {
    const cuts = [-1];
    for (let row = 0; row < 7; row++) if (game.board[row * 7 + col]!.obstacle) cuts.push(row);
    cuts.push(7);
    for (let segment = 1; segment < cuts.length; segment++) {
      const top = cuts[segment - 1]! + 1, bottom = cuts[segment]! - 1;
      const kept: { cell: FlowerCell; row: number }[] = [];
      for (let row = bottom; row >= top; row--) if (!removed.has(row * 7 + col)) kept.push({ cell: game.board[row * 7 + col]!, row });
      let spawn = 0;
      for (let row = bottom; row >= top; row--) {
        const i = row * 7 + col, item = kept.shift();
        game.board[i] = item?.cell ?? { color: color(random), obstacle: null };
        const from = item ? item.row : top - 1 - spawn++;
        if (from !== row) drops[i] = row - from;
      }
    }
  }
  return drops;
}
function damage(game: FlowerGame, index: number, amount: number, removed: Set<number>) {
  const cell = game.board[index]!, obstacle = cell.obstacle;
  if (!obstacle || obstacle.kind === "turn-lock" || obstacle.kind === "blast-lock") return;
  obstacle.hp -= amount;
  if (obstacle.hp > 0) return;
  game.cleared[obstacle.kind]++;
  game.score += obstacle.kind === "rock" ? 100 : 200;
  cell.obstacle = null; removed.add(index);
}
function resolve(game: FlowerGame, initial: number[], random: () => number, frames: FlowerFrame[], initialRemoved: Set<number> = new Set(), directTool = false, tickTurnLocks = false) {
  let found = initial, combo = 0;
  do {
    const removed = new Set(initialRemoved); initialRemoved.clear();
    const unlocked: number[] = [];
    if (found.length) {
      combo++;
      const hits = new Map<number, number>();
      found.forEach(i => {
        if (game.board[i]!.obstacle) return;
        removed.add(i); game.harvested[game.board[i]!.color]!++;
        if (game.grass.includes(i)) { game.grass = game.grass.filter(g => g !== i); game.cleared.grass++; game.score += 50; }
        if (!directTool) for (let neighbor = 0; neighbor < 49; neighbor++) if (flowerAdjacent(i, neighbor) && game.board[neighbor]!.obstacle) hits.set(neighbor, (hits.get(neighbor) ?? 0) + 1);
      });
      hits.forEach((amount, index) => {
        const obstacle = game.board[index]!.obstacle!;
        if (obstacle.kind === "blast-lock") {
          // One wave counts once, even when several matched flowers touch this lock.
          if (--obstacle.hp === 0) { game.board[index]!.obstacle = null; unlocked.push(index); }
        } else damage(game, index, amount, removed);
      });
      game.score += found.length * 30 * combo;
    }
    directTool = false;
    if (removed.size) {
      frames.push(snapshot(game, "burst", [...removed], Math.max(1, combo)));
      if (unlocked.length) frames.push(snapshot(game, "unlock", unlocked));
      frames.push(snapshot(game, "fall", [], combo, fall(game, removed, random)));
    }
    found = flowerMatches(game.board);
    if (!found.length && tickTurnLocks) {
      tickTurnLocks = false;
      const expired: number[] = [];
      game.board.forEach((cell, index) => {
        if (cell.obstacle?.kind === "turn-lock" && --cell.obstacle.hp === 0) { cell.obstacle = null; expired.push(index); }
      });
      if (expired.length) {
        frames.push(snapshot(game, "unlock", expired));
        found = flowerMatches(game.board);
      }
    }
    // shortcut: cap a single move at 30 cascade waves; replace with incremental resolution if longer combos are needed.
    if (combo >= 30 && found.length) {
      game.board = freshBoard(game.board, random); frames.push(snapshot(game, "shuffle")); found = [];
    }
  } while (found.length || tickTurnLocks);
  if (!flowerHint(game.board)) { game.board = freshBoard(game.board, random); frames.push(snapshot(game, "shuffle")); }
  game.status = flowerStatus(game);
  game.revision++;
}
export function swapFlower(input: FlowerGame, a: number, b: number, random = Math.random): FlowerTurn | null {
  if (input.status !== "playing" || !flowerAdjacent(a, b) || input.board[a]!.obstacle || input.board[b]!.obstacle) return null;
  const game = copyGame(input); game.board = exchanged(game.board, a, b);
  const found = flowerMatches(game.board);
  if (!found.includes(a) && !found.includes(b)) return null;
  game.movesLeft--;
  const frames = [snapshot(game, "swap", [a, b])]; resolve(game, found, random, frames, new Set(), false, true);
  return { game, frames };
}
export function useFlowerTool(input: FlowerGame, tool: FlowerTool, index: number, random = Math.random): FlowerTurn | null {
  if (input.status !== "playing" || !Number.isInteger(index) || index < 0 || index >= 49 || !input.tools[tool] || isFlowerLock(input.board[index]!.obstacle) || (tool === "water" && input.board[index]!.obstacle)) return null;
  const game = copyGame(input); game.tools[tool]--;
  const frames: FlowerFrame[] = [];
  if (game.board[index]!.obstacle) {
    const removed = new Set<number>(); damage(game, index, 1, removed);
    resolve(game, [], random, frames, removed);
  } else {
    const found = [index];
    if (tool === "water") for (let i = 0; i < 49; i++) if (flowerAdjacent(index, i) && !game.board[i]!.obstacle && game.board[i]!.color === game.board[index]!.color) found.push(i);
    resolve(game, found, random, frames, new Set(), true);
  }
  return { game, frames };
}
