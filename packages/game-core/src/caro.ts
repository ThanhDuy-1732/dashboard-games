export const CARO_SIZE = 15;
const CELL_COUNT = CARO_SIZE ** 2;
export type CaroMark = "X" | "O";
export const CARO_DIFFICULTIES = ["easy", "normal", "hard", "expert"] as const;
export type CaroDifficulty = (typeof CARO_DIFFICULTIES)[number];

export function isCaroDifficulty(value: unknown): value is CaroDifficulty {
  return CARO_DIFFICULTIES.some((difficulty) => difficulty === value);
}

export interface CaroGame {
  readonly board: readonly (CaroMark | null)[];
  readonly moves: readonly number[];
  readonly turn: CaroMark;
  readonly result:
    | { winner: CaroMark; line: readonly number[] }
    | { winner: null }
    | null;
}

export function createCaro(): CaroGame {
  return {
    board: Array<null>(CELL_COUNT).fill(null),
    moves: [],
    turn: "X",
    result: null,
  };
}

function cell(row: number, column: number) {
  return row >= 0 && row < CARO_SIZE && column >= 0 && column < CARO_SIZE
    ? row * CARO_SIZE + column
    : -1;
}

const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

function winningLine(
  board: CaroGame["board"],
  index: number,
  mark: CaroMark,
  allowBlockedWin = true,
) {
  const row = Math.floor(index / CARO_SIZE);
  const column = index % CARO_SIZE;
  for (const [dy, dx] of directions) {
    let start = 0;
    let end = 0;
    while (
      board[cell(row + (start - 1) * dy, column + (start - 1) * dx)] === mark
    )
      start--;
    while (board[cell(row + (end + 1) * dy, column + (end + 1) * dx)] === mark)
      end++;
    if (end - start !== 4) continue;
    if (!allowBlockedWin) {
      const opponent = mark === "X" ? "O" : "X";
      const before =
        board[cell(row + (start - 1) * dy, column + (start - 1) * dx)];
      const after =
        board[cell(row + (end + 1) * dy, column + (end + 1) * dx)];
      if (before === opponent && after === opponent) continue;
    }
    return Array.from({ length: 5 }, (_, offset) =>
      cell(row + (start + offset) * dy, column + (start + offset) * dx),
    );
  }
  return null;
}

export function playCaro(game: CaroGame, index: number): CaroGame | null {
  return applyMove(game, index, true);
}

function applyMove(
  game: CaroGame,
  index: number,
  allowBlockedWin: boolean,
): CaroGame | null {
  if (game.result || !Number.isInteger(index) || game.board[index] !== null)
    return null;
  const board = [...game.board];
  board[index] = game.turn;
  const moves = [...game.moves, index];
  const line = winningLine(board, index, game.turn, allowBlockedWin);
  return {
    board,
    moves,
    turn: game.turn === "X" ? "O" : "X",
    result: line
      ? { winner: game.turn, line }
      : moves.length === CELL_COUNT
        ? { winner: null }
        : null,
  };
}

export function restoreCaro(
  moves: unknown,
  { legacySave = false } = {},
): CaroGame | null {
  if (!Array.isArray(moves) || moves.length > CELL_COUNT) return null;
  const current = replay(moves, true);
  if (current || !legacySave || !replay(moves, false)) return current;
  // Valid legacy games may have continued past a win under the current rules.
  return replay(moves, true, true);
}

function replay(
  moves: readonly unknown[],
  allowBlockedWin: boolean,
  stopAtResult = false,
): CaroGame | null {
  let game = createCaro();
  for (const move of moves) {
    if (stopAtResult && game.result) break;
    if (typeof move !== "number") return null;
    const next = applyMove(game, move, allowBlockedWin);
    if (!next) return null;
    game = next;
  }
  return game;
}

function shapeScore(board: CaroGame["board"], index: number, mark: CaroMark) {
  const row = Math.floor(index / CARO_SIZE);
  const column = index % CARO_SIZE;
  let score = 0;
  for (const [dy, dx] of directions) {
    let length = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      let y = row + dy * sign;
      let x = column + dx * sign;
      while (board[cell(y, x)] === mark) {
        length++;
        y += dy * sign;
        x += dx * sign;
      }
      if (board[cell(y, x)] === null) open++;
    }
    if (length < 5 && open) score += open * 5 ** length;
  }
  return score;
}

function scoreMoves(board: CaroGame["board"], turn: CaroMark) {
  const center = Math.floor(CARO_SIZE / 2);
  const opponent = turn === "X" ? "O" : "X";
  return board.flatMap((mark, index) => {
    if (mark !== null) return [];
    const wins = Boolean(winningLine(board, index, turn));
    const blocks = Boolean(winningLine(board, index, opponent));
    const attack = shapeScore(board, index, turn);
    const defense = shapeScore(board, index, opponent);
    const distance =
      Math.abs(Math.floor(index / CARO_SIZE) - center) +
      Math.abs((index % CARO_SIZE) - center);
    return [
      {
        index,
        wins,
        blocks,
        attack,
        defense,
        nearby: attack + defense > 80,
        score: attack + defense * 0.9 - distance,
      },
    ];
  });
}

function searchMoves(candidates: ReturnType<typeof scoreMoves>) {
  // Keep lookahead bounded for play on a phone or offline.
  return candidates
    .sort((a, b) => Number(b.blocks) - Number(a.blocks) || b.score - a.score)
    .slice(0, 6);
}

function lookAhead(
  board: (CaroMark | null)[],
  turn: CaroMark,
  depth: number,
): number {
  const candidates = scoreMoves(board, turn);
  if (candidates.some((move) => move.wins)) return 100_000 + depth;
  if (!candidates.length) return 0;
  if (depth === 0) {
    const attack = Math.max(...candidates.map((move) => move.attack));
    const defense = Math.max(...candidates.map((move) => move.defense));
    const threats = candidates.filter((move) => move.blocks).length;
    return attack - defense - 5_000 * threats;
  }
  const opponent = turn === "X" ? "O" : "X";
  let best = -Infinity;
  for (const { index } of searchMoves(candidates)) {
    board[index] = turn;
    best = Math.max(best, -lookAhead(board, opponent, depth - 1));
    board[index] = null;
  }
  return best;
}

export function chooseCaroMove(
  game: CaroGame,
  difficulty: CaroDifficulty,
  random = Math.random,
) {
  if (game.result) return null;
  const center = Math.floor(CARO_SIZE / 2);
  if (!game.moves.length) return cell(center, center);
  const candidates = scoreMoves(game.board, game.turn);
  const win = candidates.find((candidate) => candidate.wins);
  if (win) return win.index;
  if (difficulty === "easy") {
    const nearby = candidates.filter((candidate) => candidate.nearby);
    const pool = nearby.length ? nearby : candidates;
    return pool[Math.floor(random() * pool.length)]?.index ?? null;
  }
  if (difficulty === "hard" || difficulty === "expert") {
    const board = [...game.board];
    const opponent = game.turn === "X" ? "O" : "X";
    const depth = difficulty === "expert" ? 2 : 1;
    let bestScore = -Infinity;
    let bestMove = null;
    for (const { index } of searchMoves(candidates)) {
      board[index] = game.turn;
      const score = -lookAhead(board, opponent, depth);
      board[index] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = index;
      }
    }
    return bestMove;
  }
  return (
    candidates.find((candidate) => candidate.blocks)?.index ??
    candidates.sort((a, b) => b.score - a.score)[0]?.index ??
    null
  );
}
