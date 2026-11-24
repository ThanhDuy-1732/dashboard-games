export const KILN_LOCKED_SIZE = 8;
export const KILN_LOCK_COUNT = 5;
export const KILN_LOCK_KINDS = ["turns", "blasts"] as const;

export type KilnLock = {
  index: number;
  kind: (typeof KILN_LOCK_KINDS)[number];
  remaining: number;
};

export function makeKilnLocks(random: () => number): KilnLock[] {
  const size = KILN_LOCKED_SIZE;
  const pick = (count: number) => Math.floor(random() * count);
  // A free row can always be filled by the first three pieces, and a free column remains for alternate routes.
  const clearRow = pick(size);
  const clearColumn = pick(size);
  const candidates = Array.from({ length: size * size }, (_, index) => index)
    .filter(index => Math.floor(index / size) !== clearRow && index % size !== clearColumn);

  return Array.from({ length: KILN_LOCK_COUNT }, (_, i) => {
    const [index] = candidates.splice(pick(candidates.length), 1);
    const kind = KILN_LOCK_KINDS[i < 2 ? i : pick(KILN_LOCK_KINDS.length)]!;
    return { index: index!, kind, remaining: kind === "turns" ? 4 + pick(3) : 1 + pick(2) };
  });
}

export function tickKilnLocks(locks: readonly KilnLock[], lines: number) {
  const remaining: KilnLock[] = [];
  const opened: number[] = [];
  for (const lock of locks) {
    const count = lock.remaining - (lock.kind === "turns" ? 1 : lines);
    if (count <= 0) opened.push(lock.index);
    else remaining.push({ ...lock, remaining: count });
  }
  return { remaining, opened };
}
