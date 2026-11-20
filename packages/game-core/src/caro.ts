export const CARO_SIZE = 15;
const CELL_COUNT = CARO_SIZE ** 2;
export type CaroMark = "X" | "O";
export type CaroDifficulty = "easy" | "normal";

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

function winningLine(board: CaroGame["board"], index: number, mark: CaroMark) {
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
    const opponent = mark === "X" ? "O" : "X";
    const before =
      board[cell(row + (start - 1) * dy, column + (start - 1) * dx)];
    const after = board[cell(row + (end + 1) * dy, column + (end + 1) * dx)];
    if (before === opponent && after === opponent) continue;
    return Array.from({ length: 5 }, (_, offset) =>
      cell(row + (start + offset) * dy, column + (start + offset) * dx),
    );
  }
  return null;
}

export function playCaro(game: CaroGame, index: number): CaroGame | null {
  if (game.result || !Number.isInteger(index) || game.board[index] !== null)
    return null;
  const board = [...game.board];
  board[index] = game.turn;
  const moves = [...game.moves, index];
  const line = winningLine(board, index, game.turn);
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

export function restoreCaro(moves: unknown): CaroGame | null {
  if (!Array.isArray(moves) || moves.length > CELL_COUNT) return null;
  let game = createCaro();
  for (const move of moves) {
    if (typeof move !== "number") return null;
    const next = playCaro(game, move);
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

export function chooseCaroMove(
  game: CaroGame,
  difficulty: CaroDifficulty,
  random = Math.random,
) {
  if (game.result) return null;
  const center = Math.floor(CARO_SIZE / 2);
  if (!game.moves.length) return cell(center, center);
  const opponent = game.turn === "X" ? "O" : "X";
  const candidates = game.board.flatMap((mark, index) => {
    if (mark !== null) return [];
    const wins = Boolean(winningLine(game.board, index, game.turn));
    const blocks = Boolean(winningLine(game.board, index, opponent));
    const attack = shapeScore(game.board, index, game.turn);
    const defense = shapeScore(game.board, index, opponent);
    const distance =
      Math.abs(Math.floor(index / CARO_SIZE) - center) +
      Math.abs((index % CARO_SIZE) - center);
    return [
      {
        index,
        wins,
        blocks,
        nearby: attack + defense > 80,
        score: attack + defense * 0.9 - distance,
      },
    ];
  });
  const win = candidates.find((candidate) => candidate.wins);
  if (win) return win.index;
  if (difficulty === "easy") {
    const nearby = candidates.filter((candidate) => candidate.nearby);
    const pool = nearby.length ? nearby : candidates;
    return pool[Math.floor(random() * pool.length)]?.index ?? null;
  }
  return (
    candidates.find((candidate) => candidate.blocks)?.index ??
    candidates.sort((a, b) => b.score - a.score)[0]?.index ??
    null
  );
}
