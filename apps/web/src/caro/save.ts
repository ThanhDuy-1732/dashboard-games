import { isCaroDifficulty, restoreCaro } from "@nha-choi/game-core";
import type { CaroDifficulty, CaroGame, CaroMark } from "@nha-choi/game-core";

const KEY = "nha-choi-caro-offline-v1";
export type CaroLocalMode = "local" | CaroDifficulty;

export interface CaroSave {
  mode: CaroLocalMode;
  firstMark: CaroMark;
  game: CaroGame;
}

export function readCaroSave(): CaroSave | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      data?.version !== 1 ||
      (data.mode !== "local" && !isCaroDifficulty(data.mode)) ||
      (data.firstMark !== "X" && data.firstMark !== "O")
    )
      return null;
    const game = restoreCaro(data.moves);
    return game ? { mode: data.mode, firstMark: data.firstMark, game } : null;
  } catch {
    return null;
  }
}

export function writeCaroSave(save: CaroSave) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      mode: save.mode,
      firstMark: save.firstMark,
      moves: save.game.moves,
    }),
  );
}
