import { describe, expect, it } from "vitest";
import { createDinoRun, stepDinoRun } from "../src/dino.js";
import type { DinoObstacle, DinoRun } from "../src/dino.js";

function approach(run: DinoRun, distanceM: number) {
  while (run.status === "running" && run.distanceM < distanceM) {
    run = stepDinoRun(run, false);
  }
  return run;
}

const obstacle = (kind: DinoObstacle["kind"]): DinoObstacle =>
  kind === "gap"
    ? { id: 0, kind, startM: 24, lengthM: 1.8, clearanceM: 0.3 }
    : { id: 0, kind, startM: 24, lengthM: 1.2, clearanceM: 0.75 };

function canClear(run: DinoRun, next: DinoObstacle) {
  while (run.status === "running" && run.distanceM < next.startM) {
    if (run.heightM === 0) {
      const jumped = approach(stepDinoRun(run, true), next.startM + next.lengthM);
      if (jumped.status === "running") return jumped;
    }
    run = stepDinoRun(run, false);
  }
  throw Error("No jump can clear the next obstacle");
}

describe("Thằn Lằn Núi Lửa simulation", () => {
  it("advances at a fixed step, increases speed and caps it at 16 m/s", () => {
    const run = { ...createDinoRun(1), speedMps: 15.9999 };
    expect(run.distanceM).toBe(0);
    expect(createDinoRun(1).speedMps).toBe(8);
    expect(stepDinoRun(run, false)).toMatchObject({ speedMps: 16, distanceM: 16 / 60 });
  });

  it("ignores jump requests while airborne", () => {
    const air = stepDinoRun(createDinoRun(9), true);
    expect(air.heightM).toBeGreaterThan(0);
    expect(stepDinoRun(air, true)).toEqual(stepDinoRun(air, false));
  });

  it.each(["gap", "boulder"] as const)("crashes on ground at a %s and freezes the run", (kind) => {
    const run = approach({ ...createDinoRun(9), obstacles: [obstacle(kind)] }, 27);
    expect(run.status).toBe("crashed");
    expect(run.distanceM).toBeCloseTo(24);
    expect(stepDinoRun(run, true)).toBe(run);
  });

  it.each([8, 12, 16])("can clear both obstacles immediately ahead at %i m/s", (speedMps) => {
    for (const kind of ["gap", "boulder"] as const) {
      const next = obstacle(kind);
      const run = canClear({ ...createDinoRun(9), speedMps, obstacles: [next] }, next);
      expect(run.distanceM).toBeGreaterThanOrEqual(next.startM + next.lengthM);
    }
  });

  it("generates repeatable jumpable patterns and recycles passed obstacles", () => {
    for (const seed of [0, 1, 71]) {
      let run = createDinoRun(seed);
      expect(run).toEqual(createDinoRun(seed));
      expect(run.obstacles[0].startM).toBe(24);
      expect(run.obstacles.slice(0, 4).map(({ kind }) => kind)).toEqual(["boulder", "gap", "log", "pillar"]);
      for (let index = 0; index < 30; index++) {
        const next = run.obstacles.find(({ id }) => id === index)!;
        const following = run.obstacles.find(({ id }) => id === index + 1)!;
        expect(following.startM - next.startM - next.lengthM).toBeGreaterThanOrEqual(22);
        if (next.kind === "pillar") {
          if (run.lane === next.lane) run = stepDinoRun(run, false, run.lane === -1 ? 1 : -1);
          run = approach(run, next.startM + next.lengthM);
          expect(run.status).toBe("running");
        } else {
          run = canClear(run, next);
        }
      }
      expect(run.obstacles[0].id).toBeGreaterThan(25);
    }
  });
});

describe("Dino lanes and pickups", () => {
  it("slides one lane per input, accepts input in the air, and clamps to the road", () => {
    let run = stepDinoRun(createDinoRun(1), true, -1);
    expect(run.lane).toBe(-1);
    expect(run.xM).toBeLessThan(0);
    expect(run.xM).toBeGreaterThan(-1.81);
    expect(run.heightM).toBeGreaterThan(0);
    run = stepDinoRun(run, false, -1);
    for (let i = 0; i < 20; i++) run = stepDinoRun(run, false);
    expect(run.xM).toBe(-1.81);
    run = stepDinoRun(run, false, 1);
    expect(run.lane).toBe(0);
  });

  it("can dodge a boulder by changing lanes, but must jump a full-width gap", () => {
    const run = stepDinoRun(createDinoRun(1), false, 1);
    expect(approach({ ...run, obstacles: [obstacle("boulder")] }, 27).status).toBe("running");
    expect(approach({ ...run, obstacles: [obstacle("gap")] }, 27).status).toBe("crashed");
  });

  it.each([["speed-up", 1.3], ["slow-down", 0.75]] as const)(
    "applies %s only on the correct lane and restores base pace when it expires",
    (kind, multiplier) => {
      const item = { id: 1, kind, lane: -1 as const, atM: 1 };
      const start = { ...createDinoRun(1), items: [item] };
      expect(approach(start, 1.6).speedEffect).toBeNull();
      let run = approach(stepDinoRun(start, false, -1), 1.6);
      expect(run.items).toEqual([]);
      expect(run.speedEffect?.kind).toBe(kind);
      const next = stepDinoRun(run, false);
      expect(next.distanceM - run.distanceM).toBeCloseTo(next.speedMps * multiplier / 60);
      run = { ...run, speedEffect: { kind, ticksLeft: 1 } };
      const expired = stepDinoRun(run, false);
      expect(expired.speedEffect).toBeNull();
      const normal = stepDinoRun(expired, false);
      expect(normal.distanceM - expired.distanceM).toBeCloseTo(normal.speedMps / 60);
    },
  );

  it("combines evolution with a speed effect and launches a higher jump", () => {
    const base = createDinoRun(1);
    const item = { id: 1, kind: "evolution" as const, lane: 0 as const, atM: 0.1 };
    const boosted = stepDinoRun({ ...base, items: [item], speedEffect: { kind: "speed-up", ticksLeft: 360 } }, false);
    expect(boosted.evolutionTicks).toBe(600);
    expect(boosted.speedEffect?.kind).toBe("speed-up");
    expect(stepDinoRun(boosted, true).verticalSpeedMps).toBeGreaterThan(stepDinoRun(base, true).verticalSpeedMps);
  });
});

describe("Dino fire breath", () => {
  it("breaks a boulder in the path and clears its collision", () => {
    const run = approach(createDinoRun(3), 20);
    const fired = stepDinoRun(run, false, 0, true);
    expect(run.hasFire).toBe(true);
    expect(fired.hasFire).toBe(false);
    expect(fired.obstacles[0]).toMatchObject({ kind: "boulder", broken: true });
    expect(fired.fireBurst?.hit?.atM).toBeCloseTo(24.6);
    expect(approach(fired, 27).status).toBe("running");
  });

  it("fires past nearby rocks on another lane and cannot fill a lava gap", () => {
    const gap = { ...obstacle("gap"), id: 1 };
    const rock = { ...obstacle("boulder"), lane: 1 as const, startM: 22 };
    const run = approach({ ...createDinoRun(0), obstacles: [rock, gap], hasFire: true }, 20);
    const fired = stepDinoRun(run, false, 0, true);
    expect(fired.fireBurst?.hit).toBeNull();
    expect(fired.obstacles.slice(0, 2)).toEqual([rock, gap]);
    expect(approach(fired, 25).status).toBe("crashed");
  });

  it("requires a pickup before firing and spends it even on a miss", () => {
    const start = stepDinoRun(createDinoRun(3), false, 0, true);
    expect(start.hasFire).toBe(false);
    expect(start.fireBurst).toBeNull();
    const charged = approach(start, 13);
    expect(charged.hasFire).toBe(true);
    const empty = stepDinoRun(charged, false, 0, true);
    expect(empty.hasFire).toBe(false);
    expect(empty.fireBurst?.hit).toBeNull();
    let readyAgain = empty;
    for (let i = 0; i < 30; i++) readyAgain = stepDinoRun(readyAgain, false);
    expect(stepDinoRun(readyAgain, false, 0, true).fireBurst).toBeNull();
  });
});

describe("Dino armor and additional obstacles", () => {
  it("collects armor, absorbs the entire first collision and loses on a second hit", () => {
    const first = obstacle("boulder");
    const second = { ...first, id: 1, startM: 30 };
    const item = { id: 0, kind: "armor" as const, lane: 0 as const, atM: 2 };
    const start = { ...createDinoRun(0), obstacles: [first, second], items: [item] };
    expect(approach(start, 3).hasArmor).toBe(true);
    const saved = approach(start, 24.5);
    expect(saved).toMatchObject({ status: "running", hasArmor: false, absorbedObstacleId: 0 });
    expect(saved.armorFlashTicks).toBeGreaterThan(0);
    expect(approach(saved, 26).status).toBe("running");
    expect(approach(saved, 31)).toMatchObject({ status: "crashed", distanceM: 30 });
  });

  it("leaves a fall fatal even with armor", () => {
    const run = approach({ ...createDinoRun(0), obstacles: [obstacle("gap")], hasArmor: true }, 25);
    expect(run).toMatchObject({ status: "crashed", hasArmor: true });
  });

  it("covers two lanes with a jumpable log and requires dodging a tall column", () => {
    const start = createDinoRun(0);
    const log = { ...obstacle("boulder"), kind: "log" as const, lane: -1 as const, clearanceM: 0.55 };
    expect(approach({ ...start, obstacles: [log] }, 27).status).toBe("crashed");
    expect(canClear({ ...start, obstacles: [log] }, log).status).toBe("running");
    const pillar = { ...obstacle("boulder"), kind: "pillar" as const, lane: 0 as const, clearanceM: 2.4 };
    const before = approach({ ...start, obstacles: [pillar] }, 21);
    expect(approach(stepDinoRun(before, true), 27).status).toBe("crashed");
    for (const hazard of [log, pillar]) {
      const run = approach({ ...start, obstacles: [hazard] }, 20);
      expect(approach(stepDinoRun(run, false, 1), 27).status).toBe("running");
    }
  });
});
