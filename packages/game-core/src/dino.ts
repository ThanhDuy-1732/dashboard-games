export const DINO_STEP_SECONDS = 1 / 60;
export const DINO_BOULDER_ROLL_M = 16;
export const DINO_LANE_WIDTH = 1.81;
export const DINO_FIRE_RANGE_M = 9;
export const DINO_FIRE_BURST_TICKS = 18;
export const DINO_ARMOR_FLASH_TICKS = 24;
export type DinoLane = -1 | 0 | 1;
export type DinoItemKind = "speed-up" | "slow-down" | "evolution" | "fire" | "armor";

const LANES = [-1, 0, 1] as const;
const ITEMS = [
  { kind: "fire", lane: 0 },
  { kind: "armor", lane: 0 },
  { kind: "speed-up", lane: -1 },
  { kind: "slow-down", lane: 1 },
  { kind: "evolution", lane: 0 },
] as const;
const OBSTACLE_KINDS = ["boulder", "gap", "log", "pillar"] as const;
const BOULDER_SIDE_CLEARANCE = 0.7;
const LANE_CHANGE_METERS_PER_SECOND = 8;

export interface DinoItem {
  id: number;
  kind: DinoItemKind;
  lane: DinoLane;
  atM: number;
}

export interface DinoSpeedEffect {
  kind: "speed-up" | "slow-down";
  ticksLeft: number;
}

export interface DinoObstacle {
  id: number;
  kind: (typeof OBSTACLE_KINDS)[number];
  startM: number;
  lengthM: number;
  clearanceM: number;
  lane?: DinoLane;
  broken?: true;
}

interface DinoFireBurst {
  atM: number;
  ticksLeft: number;
  hit: { atM: number; xM: number } | null;
}

export interface DinoRun {
  seed: number;
  distanceM: number;
  speedMps: number;
  lane: DinoLane;
  xM: number;
  heightM: number;
  verticalSpeedMps: number;
  status: "running" | "crashed";
  obstacles: readonly DinoObstacle[];
  items: readonly DinoItem[];
  speedEffect: DinoSpeedEffect | null;
  evolutionTicks: number;
  hasFire: boolean;
  fireBurst: DinoFireBurst | null;
  hasArmor: boolean;
  absorbedObstacleId: number | null;
  armorFlashTicks: number;
}

export function dinoObstacleCenterX(obstacle: DinoObstacle): number {
  return ((obstacle.lane ?? 0) + (obstacle.kind === "log" ? 0.5 : 0)) * DINO_LANE_WIDTH;
}

export function dinoBoulderOffsetM(obstacle: DinoObstacle, distanceM: number): number {
  const remaining = obstacle.startM - distanceM;
  const settledAt = 6;
  const slide = Math.max(0, Math.min(1, (remaining - settledAt) / (DINO_BOULDER_ROLL_M - settledAt)));
  const side = obstacle.lane || (obstacle.id % 2 ? 1 : -1);
  return slide * (side * 3.8 - dinoObstacleCenterX(obstacle));
}

function nextObstacle(seed: number, previous?: DinoObstacle): DinoObstacle {
  const id = previous ? previous.id + 1 : 0;
  const mixed = Math.imul((seed + id) ^ 0x9e3779b9, 0x85ebca6b);
  const random = (mixed ^ (mixed >>> 16)) >>> 0;
  const startM = previous
    ? Math.ceil(previous.startM + previous.lengthM) + 22 + (id < OBSTACLE_KINDS.length ? 1 : random % 12)
    : 24;
  const kind = OBSTACLE_KINDS[id % OBSTACLE_KINDS.length];
  const lane = id < OBSTACLE_KINDS.length ? 0 : (LANES[(random >>> 4) % LANES.length] ?? 0);
  switch (kind) {
    case "gap": return { id, kind, startM, lengthM: 1.8, clearanceM: 0.3 };
    case "log": return { id, kind, startM, lengthM: 0.9, clearanceM: 0.55, lane: lane < 0 ? -1 : 0 };
    case "pillar": return { id, kind, startM, lengthM: 1.05, clearanceM: 2.4, lane };
    default: return { id, kind: "boulder", startM, lengthM: 1.2, clearanceM: 0.75, lane };
  }
}

function itemBefore(obstacle: DinoObstacle): DinoItem {
  const item = ITEMS[obstacle.id % ITEMS.length] ?? ITEMS[0];
  return { id: obstacle.id, ...item, atM: obstacle.startM - 12 };
}

export function createDinoRun(seed: number): DinoRun {
  let next = nextObstacle(seed);
  const obstacles = [next];
  while (next.startM < 120) {
    next = nextObstacle(seed, next);
    obstacles.push(next);
  }
  return {
    seed, distanceM: 0, speedMps: 8, lane: 0, xM: 0,
    heightM: 0, verticalSpeedMps: 0, status: "running", obstacles,
    items: obstacles.map(itemBefore), speedEffect: null, evolutionTicks: 0,
    hasFire: false, fireBurst: null, hasArmor: false, absorbedObstacleId: null, armorFlashTicks: 0,
  };
}

export function stepDinoRun(run: DinoRun, jumpPressed: boolean, move: DinoLane = 0, firePressed = false): DinoRun {
  if (run.status === "crashed") return run;

  const dt = DINO_STEP_SECONDS;
  const speedMps = Math.min(16, run.speedMps + 0.25 * dt);
  const multiplier = run.speedEffect?.kind === "speed-up" ? 1.3 : run.speedEffect?.kind === "slow-down" ? 0.75 : 1;
  const actualSpeed = speedMps * multiplier;
  const distanceM = run.distanceM + actualSpeed * dt;
  const lane = (Math.min(1, Math.max(-1, run.lane + move))) as DinoLane;
  const targetX = lane * DINO_LANE_WIDTH;
  const shift = LANE_CHANGE_METERS_PER_SECOND * dt;
  const xM = run.xM + Math.max(-shift, Math.min(shift, targetX - run.xM));
  const xPerMeter = (xM - run.xM) / (distanceM - run.distanceM);
  const launchSpeed = jumpPressed && run.heightM === 0
    ? (run.evolutionTicks > 0 ? 9.2 : 7)
    : run.verticalSpeedMps;
  const verticalSpeedMps = launchSpeed - 20 * dt;
  const heightAt = (distance: number) => {
    const time = (distance - run.distanceM) / actualSpeed;
    return Math.max(0, run.heightM + launchSpeed * time - 10 * time * time);
  };
  const heightM = heightAt(distanceM);
  let obstacles = run.obstacles;
  let { hasFire, hasArmor, absorbedObstacleId } = run;
  let armorFlashTicks = Math.max(0, run.armorFlashTicks - 1);
  let fireBurst = run.fireBurst && run.fireBurst.ticksLeft > 1
    ? { ...run.fireBurst, ticksLeft: run.fireBurst.ticksLeft - 1 }
    : null;
  if (firePressed && hasFire) {
    let hit: DinoFireBurst["hit"] = null;
    const target = obstacles.find((obstacle) => {
      const remaining = obstacle.startM - run.distanceM;
      if (obstacle.kind !== "boulder" || obstacle.broken || remaining < 0 || remaining > DINO_FIRE_RANGE_M) return false;
      if ((obstacle.lane ?? 0) !== lane) return false;
      const rockX = dinoObstacleCenterX(obstacle) + dinoBoulderOffsetM(obstacle, run.distanceM);
      return Math.abs(rockX - run.xM) <= BOULDER_SIDE_CLEARANCE + 0.18;
    });
    if (target) {
      hit = {
        atM: target.startM + target.lengthM / 2,
        xM: dinoObstacleCenterX(target) + dinoBoulderOffsetM(target, run.distanceM),
      };
      obstacles = obstacles.map((obstacle) => obstacle === target ? { ...obstacle, broken: true } : obstacle);
    }
    fireBurst = { atM: run.distanceM, ticksLeft: DINO_FIRE_BURST_TICKS, hit };
    hasFire = false;
  }

  for (const obstacle of obstacles) {
    if (obstacle.broken || obstacle.id === absorbedObstacleId) continue;
    let from = Math.max(run.distanceM, obstacle.startM);
    let to = Math.min(distanceM, obstacle.startM + obstacle.lengthM);
    if (obstacle.kind !== "gap") {
      const offsetX = dinoObstacleCenterX(obstacle) - run.xM;
      const sideClearance = obstacle.kind === "log" ? 1.83 : BOULDER_SIDE_CLEARANCE;
      if (xPerMeter === 0) {
        if (Math.abs(offsetX) > sideClearance) continue;
      } else {
        const edgeA = run.distanceM + (offsetX - sideClearance) / xPerMeter;
        const edgeB = run.distanceM + (offsetX + sideClearance) / xPerMeter;
        from = Math.max(from, Math.min(edgeA, edgeB));
        to = Math.min(to, Math.max(edgeA, edgeB));
      }
    }
    if (from > to) continue;
    const entryHeight = heightAt(from);
    const exitHeight = heightAt(to);
    if (Math.min(entryHeight, exitHeight) >= obstacle.clearanceM) continue;
    if (hasArmor && obstacle.kind !== "gap") {
      hasArmor = false;
      absorbedObstacleId = obstacle.id;
      armorFlashTicks = DINO_ARMOR_FLASH_TICKS;
      continue;
    }
    const crashDistance = entryHeight < obstacle.clearanceM ? from : to;
    return {
      ...run, speedMps, lane, obstacles, hasFire, fireBurst, hasArmor, absorbedObstacleId, armorFlashTicks,
      xM: run.xM + xPerMeter * (crashDistance - run.distanceM),
      status: "crashed", distanceM: crashDistance, heightM: heightAt(crashDistance), verticalSpeedMps: 0,
    };
  }

  let speedEffect = run.speedEffect && run.speedEffect.ticksLeft > 1
    ? { ...run.speedEffect, ticksLeft: run.speedEffect.ticksLeft - 1 }
    : null;
  let evolutionTicks = Math.max(0, run.evolutionTicks - 1);
  let items = run.items;
  const item = items.find(({ atM }) => atM - 0.45 <= distanceM);
  if (item) {
    const lateralDistance = Math.abs(xM - item.lane * DINO_LANE_WIDTH);
    if (distanceM <= item.atM + 0.45 && lateralDistance <= 0.57 && heightM <= 0.75) {
      switch (item.kind) {
        case "fire": hasFire = true; break;
        case "armor": hasArmor = true; break;
        case "evolution": evolutionTicks = 600; break;
        default: speedEffect = { kind: item.kind, ticksLeft: 360 };
      }
      items = items.slice(1);
    } else if (distanceM > item.atM + 0.45) {
      items = items.slice(1);
    }
  }

  const first = obstacles[0];
  if (!first || first.startM + first.lengthM < distanceM - 12) {
    obstacles = obstacles.filter(({ startM, lengthM }) => startM + lengthM >= distanceM - 12);
  }
  const last = obstacles.at(-1);
  if (last && last.startM < distanceM + 120) {
    const next = nextObstacle(run.seed, last);
    obstacles = [...obstacles, next];
    items = [...items, itemBefore(next)];
  }
  return {
    ...run, distanceM, speedMps, lane, xM, heightM, obstacles, items, speedEffect, evolutionTicks,
    hasFire, fireBurst, hasArmor, absorbedObstacleId, armorFlashTicks,
    verticalSpeedMps: heightM > 0 ? verticalSpeedMps : 0,
  };
}
