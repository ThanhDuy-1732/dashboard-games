export const DINO_BEST_KEY = "nha-choi-dino-best-v1";

export function readDinoBest(storage: Storage): number {
  try {
    const value = Number(storage.getItem(DINO_BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveDinoBest(storage: Storage, distanceM: number): number {
  const previous = readDinoBest(storage);
  const current = Math.floor(distanceM);
  if (!Number.isSafeInteger(current) || current <= previous) return previous;
  try {
    storage.setItem(DINO_BEST_KEY, String(current));
  } catch {
    // The result remains available for the current visit.
  }
  return current;
}
