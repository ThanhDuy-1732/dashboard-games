import { randomInt } from "node:crypto";
import type { RandomSource } from "@nha-choi/game-core";
export const serverRandom: RandomSource = {
  int: (min, max) => randomInt(min, max + 1),
};
