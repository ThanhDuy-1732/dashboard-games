import type { DinoMap } from "@nha-choi/game-core";

export const DINO_BEST_KEY = "nha-choi-dino-best-v1";
const bestKey = (map: DinoMap) => map === "volcano" ? DINO_BEST_KEY : `${DINO_BEST_KEY}-${map}`;

export function readDinoBest(storage: Storage, map: DinoMap = "volcano"): number {
  try {
    const value = Number(storage.getItem(bestKey(map)));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveDinoBest(storage: Storage, distanceM: number, map: DinoMap = "volcano"): number {
  const previous = readDinoBest(storage, map);
  const current = Math.floor(distanceM);
  if (!Number.isSafeInteger(current) || current <= previous) return previous;
  try {
    storage.setItem(bestKey(map), String(current));
  } catch {
    // The result remains available for the current visit.
  }
  return current;
}
