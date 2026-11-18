import type { RandomSource } from "@nha-choi/game-core";
export const cryptoRandom: RandomSource = {
  int(min, max) {
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min > max ||
      max - min >= 2 ** 32
    )
      throw new RangeError("Invalid random range");
    const range = max - min + 1;
    const ceiling = 2 ** 32 - (2 ** 32 % range);
    const value = new Uint32Array(1);
    do {
      crypto.getRandomValues(value);
    } while (value[0]! >= ceiling);
    return min + (value[0]! % range);
  },
};
