import { isCaroDifficulty, restoreCaro } from "@nha-choi/game-core";
import type { CaroDifficulty, CaroGame, CaroMark } from "@nha-choi/game-core";

const KEY = "nha-choi-caro-offline-v1";
export type CaroLocalMode = "local" | CaroDifficulty;

export interface CaroSave {
  id?: string;
  startedAt?: number;
  mode: CaroLocalMode;
  firstMark: CaroMark;
  game: CaroGame;
}

export function readCaroSave(): CaroSave | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      (data?.version !== 1 && data?.version !== 2) ||
      (data.mode !== "local" && !isCaroDifficulty(data.mode)) ||
      (data.firstMark !== "X" && data.firstMark !== "O")
    )
      return null;
    const game = restoreCaro(data.moves, { legacySave: data.version === 1 });
    return game ? {
      mode: data.mode, firstMark: data.firstMark, game,
      ...(Number.isSafeInteger(data.startedAt) && data.startedAt >= 0 ? { startedAt: data.startedAt } : {}),
      ...(typeof data.id === "string" && /^[a-f0-9-]{36}$/.test(data.id) ? { id: data.id } : {}),
    } : null;
  } catch {
    return null;
  }
}

export function writeCaroSave(save: CaroSave) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 2,
      id: save.id,
      startedAt: save.startedAt,
      mode: save.mode,
      firstMark: save.firstMark,
      moves: save.game.moves,
    }),
  );
}
