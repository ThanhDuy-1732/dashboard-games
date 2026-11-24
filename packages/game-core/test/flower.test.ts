import { describe, expect, it } from "vitest";
import {
  FLOWER_LEVELS, createFlowerGame, flowerGoals, flowerHint, flowerMatches,
  flowerStars, swapFlower, useFlowerTool,
} from "../src/flower.js";
import type { FlowerGame } from "../src/flower.js";

const seeded = (seed = 1) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
function tutorial(game: FlowerGame) {
  const board = game.board.map((cell) => ({ ...cell }));
  for (const [index, color] of [[16, 0], [22, 0], [23, 1], [24, 0]] as const)
    board[index] = { color, obstacle: null };
  return { ...game, board };
}

describe("Vườn Hoa match-three", () => {
  it("creates all twelve playable stable levels even with a constant random source", () => {
    expect(FLOWER_LEVELS).toHaveLength(12);
    for (const random of [seeded(), () => 0, () => 0.999999]) {
      for (let level = 1; level <= 12; level++) {
        const game = createFlowerGame("journey", level, random);
        expect(game.board).toHaveLength(49);
        expect(flowerMatches(game.board)).toEqual([]);
        expect(flowerHint(game.board)).not.toBeNull();
        expect(game.status).toBe("playing");
        expect(game.tools).toEqual({ shovel: 1, water: 1 });
      }
    }
    const quick = createFlowerGame("quick", 0, seeded());
    expect(quick.movesLeft).toBe(20);
    expect(flowerGoals(quick)).toMatchObject([{ target: 1500, current: 0 }]);
    expect(quick.tools).toEqual({ shovel: 0, water: 0 });
    expect(() => createFlowerGame("journey", 13)).toThrow();
  });

  it("rejects diagonal, row-wrap, out of bounds and nonmatching swaps without mutating input", () => {
    const game = createFlowerGame("quick", 0, seeded());
    const original = structuredClone(game);
    for (const [a,b] of [[6,7],[0,8],[-1,0],[49,42],[0,0],[NaN,1]])
      expect(swapFlower(game,a,b,seeded())).toBeNull();
    let rejected = false;
    for (let i=0;i<48;i++) {
      if (i%7===6) continue;
      if (!swapFlower(game,i,i+1,seeded())) { rejected=true; break; }
    }
    expect(rejected).toBe(true);
    expect(game).toEqual(original);
  });

  it("deduplicates crossing matches and never matches through a blocker", () => {
    const game = createFlowerGame("quick",0,seeded());
    game.board.forEach((cell,i)=>{cell.color=(i%5) as 0|1|2|3|4;});
    for (const index of [16,22,23,24,30]) game.board[index]!.color=4;
    game.board[9]!.color=2;
    expect(new Set(flowerMatches(game.board))).toEqual(new Set([16,22,23,24,30]));
    game.board[23]!.obstacle={kind:"rock",hp:2};
    expect(flowerMatches(game.board)).toEqual([]);
  });

  it("resolves a legal swap, cascades and final board, spending exactly one turn", () => {
    const game=tutorial(createFlowerGame("quick",0,seeded()));
    const before=structuredClone(game);
    const result=swapFlower(game,16,23,seeded(9))!;
    expect(result).not.toBeNull();
    expect(result.game.movesLeft).toBe(19);
    expect(result.game.score).toBeGreaterThanOrEqual(90);
    expect(result.game.revision).toBe(1);
    expect(result.game.harvested[0]).toBeGreaterThanOrEqual(3);
    expect(result.frames.some(f=>f.kind==="burst")).toBe(true);
    expect(result.frames.some(f=>f.kind==="fall")).toBe(true);
    expect(flowerMatches(result.game.board)).toEqual([]);
    expect(flowerHint(result.game.board)).not.toBeNull();
    expect(game).toEqual(before);
  });

  it("wins on the final turn before deciding loss, and refuses more actions", () => {
    const game=tutorial(createFlowerGame("quick",0,seeded()));
    game.movesLeft=1;game.score=1490;
    const won=swapFlower(game,16,23,seeded())!.game;
    expect(won.movesLeft).toBe(0);expect(won.status).toBe("won");
    expect(flowerStars(won)).toBe(1);
    expect(swapFlower(won,16,23)).toBeNull();
    expect(useFlowerTool(won,"shovel",0)).toBeNull();
    const lost=swapFlower({...game,score:0},16,23,seeded())!.game;
    expect(lost.status).toBe("lost");
  });

  it("clears grass under matches and damages distinct adjacent rock and bud tiles", () => {
    const game=tutorial(createFlowerGame("journey",5,seeded()));
    game.grass=[22,23,24];
    game.board[15]!.obstacle={kind:"rock",hp:2};
    game.board[31]!.obstacle={kind:"bud",hp:4};
    const result=swapFlower(game,16,23,seeded(5))!.game;
    expect(result.cleared.grass).toBe(3);
    expect(result.grass).toEqual([]);
    expect(result.board[15]!.obstacle?.hp ?? 0).toBeLessThan(2);
    expect(result.board[31]!.obstacle?.hp ?? 0).toBeLessThan(4);
  });

  it("uses each tool once, rejects invalid targets and preserves turns", () => {
    const game=createFlowerGame("journey",7,seeded());
    const rock=game.board.findIndex(cell=>cell.obstacle?.kind==="rock");
    expect(useFlowerTool(game,"water",rock)).toBeNull();
    expect(useFlowerTool(game,"shovel",-1)).toBeNull();
    const next=useFlowerTool(game,"shovel",rock,seeded())!.game;
    expect(next.board[rock]!.obstacle).toEqual({kind:"rock",hp:1});
    expect(next.movesLeft).toBe(game.movesLeft);
    expect(next.tools.shovel).toBe(0);
    expect(useFlowerTool(next,"shovel",rock)).toBeNull();
    const watered=useFlowerTool(next,"water",16,seeded())!.game;
    expect(watered.tools.water).toBe(0);
    expect(watered.movesLeft).toBe(game.movesLeft);
  });

  it("finishes long cascades with a constant random source instead of hanging", () => {
    const game=tutorial(createFlowerGame("quick",0,seeded()));
    const result=swapFlower(game,16,23,()=>0)!;
    expect(result.frames.length).toBeLessThan(100);
    expect(flowerMatches(result.game.board)).toEqual([]);
    expect(flowerHint(result.game.board)).not.toBeNull();
  });
});
it("shoveling a flower never directly damages an adjacent blocker",()=>{
  const game=createFlowerGame("journey",7,seeded(50));
  const index=10;
  const result=useFlowerTool(game,"shovel",index,seeded(3))!;
  const first=result.frames.find(f=>f.kind==="burst")!;
  expect(first.board[11]!.obstacle?.hp).toBe(2);
  expect(first.indices).toEqual([index]);
});
it("keeps gravity on each side of a blocker and refills only the affected column segment",()=>{
  const game=createFlowerGame("journey",7,seeded(81));
  game.board.forEach((cell,i)=>{cell.color=(i%5) as 0|1|2|3|4;});
  for(const i of [16,22,24])game.board[i]!.color=0;
  game.board[23]!.color=1;
  game.board[17]!.obstacle={kind:"rock",hp:2};
  game.board[29]!.obstacle={kind:"rock",hp:2};
  const result=swapFlower(game,16,23,seeded(9))!;
  const fall=result.frames.find(frame=>frame.kind==="fall")!;
  for(const index of [3,10,36,43])expect(fall.board[index]).toEqual(game.board[index]);
  expect(fall.board[17]!.obstacle?.hp).toBe(1);
  expect(fall.board[29]!.obstacle?.hp).toBe(1);
});
it("counts distinct adjacent matched flowers once each when destroying a blocker",()=>{
  const game=createFlowerGame("journey",7,seeded());
  game.board.forEach((cell,i)=>{cell.color=(i%5) as 0|1|2|3|4;cell.obstacle=null;});
  [9,16,22,24,30].forEach(i=>game.board[i]!.color=0);game.board[23]!.color=1;
  game.board[15]!.obstacle={kind:"rock",hp:2};
  expect(flowerMatches(game.board)).toEqual([]);
  const first=swapFlower(game,30,23,seeded())!.frames.find(f=>f.kind==="burst")!;
  expect(first.board[15]!.obstacle).toBeNull();
  expect(first.indices.filter(i=>i===15)).toHaveLength(1);
});
it("can complete all twelve configured campaign levels with a deterministic goal-seeking player",()=>{
  for(let level=1;level<=12;level++){
    const random=seeded(level*137);
    let game=createFlowerGame("journey",level,random);
    const value=(state:FlowerGame)=>flowerGoals(state).reduce((n,g)=>n+Math.min(1,g.current/g.target)*10000,0)+state.score*.001+
      state.board.reduce((n,c)=>n+(c.obstacle?(c.obstacle.kind==="bud"?4:2)-c.obstacle.hp:0),0)*20;
    for(let step=0;step<40&&game.status==="playing";step++){
      let best:FlowerGame|null=null,rank=-Infinity;
      const consider=(candidate:ReturnType<typeof swapFlower>)=>{
        if(candidate&&value(candidate.game)>rank){best=candidate.game;rank=value(candidate.game);}
      };
      for(let i=0;i<49;i++){
        for(const j of [i+1,i+7])consider(swapFlower(game,i,j,random));
        for(const tool of ["shovel","water"] as const)if(game.tools[tool])consider(useFlowerTool(game,tool,i,random));
      }
      expect(best).not.toBeNull();game=best!;
    }
    expect(game.status,`campaign level ${level}`).toBe("won");
    expect(flowerGoals(game).every(goal=>goal.current>=goal.target)).toBe(true);
  }
});

describe("Vườn khóa bí ẩn",()=>{
  it("generates 4–6 anchored random locks with 2–4 counters and always a legal move",()=>{
    const layouts=new Set<string>(),kinds=new Set<string>();
    for(let seed=1;seed<=25;seed++){
      const game=createFlowerGame("mystery",0,seeded(seed));
      const locks=game.board.flatMap((c,i)=>c.obstacle?[{...c.obstacle,index:i}]:[]);
      expect(locks.length).toBeGreaterThanOrEqual(4);expect(locks.length).toBeLessThanOrEqual(6);
      locks.forEach(lock=>{expect(["turn-lock","blast-lock"]).toContain(lock.kind);expect(lock.hp).toBeGreaterThanOrEqual(2);expect(lock.hp).toBeLessThanOrEqual(4);kinds.add(lock.kind);});
      expect(game.movesLeft).toBe(20);expect(game.tools).toEqual({shovel:0,water:0});
      expect(flowerHint(game.board)).not.toBeNull();expect(flowerMatches(game.board)).toEqual([]);
      layouts.add(JSON.stringify(locks));
    }
    expect(layouts.size).toBeGreaterThan(10);expect(kinds.size).toBe(2);
    expect(flowerHint(createFlowerGame("mystery",0,()=>0).board)).not.toBeNull();
  });
  it("ticks turn locks exactly once per accepted swap and rejects locked tiles",()=>{
    const game=createFlowerGame("quick",0,seeded(15));
    game.board[0]!.obstacle={kind:"turn-lock",hp:3};
    expect(swapFlower(game,0,1,seeded())).toBeNull();
    expect(swapFlower(game,6,7,seeded())).toBeNull();
    const before=structuredClone(game);
    const next=swapFlower(game,16,23,()=>0)!.game;
    expect(next.board[0]!.obstacle).toEqual({kind:"turn-lock",hp:2});
    expect(game).toEqual(before);
  });
  it("counts one adjacent blast wave per lock, never each neighboring flower or a distant wave",()=>{
    const game=createFlowerGame("quick",0,seeded());
    game.board.forEach((c,i)=>{c.color=(i%5) as 0|1|2|3|4;c.obstacle=null;});
    [9,16,22,24,30].forEach(i=>game.board[i]!.color=0);game.board[23]!.color=1;
    game.board[15]!.obstacle={kind:"blast-lock",hp:4};
    game.board[0]!.obstacle={kind:"blast-lock",hp:4};
    const burst=swapFlower(game,30,23,seeded(42))!.frames.find(f=>f.kind==="burst")!;
    expect(burst.board[15]!.obstacle?.hp).toBe(3);
    expect(burst.board[0]!.obstacle?.hp).toBe(4);
  });
  it("opens expiring locks without harvesting or scoring their flowers",()=>{
    const game=createFlowerGame("quick",0,seeded(81));
    game.board[0]!.obstacle={kind:"turn-lock",hp:1};
    const result=swapFlower(game,16,23,seeded(9))!;
    const opened=result.frames.find(f=>f.kind==="unlock"&&f.indices.includes(0));
    expect(opened).toBeDefined();expect(opened!.board[0]!.obstacle).toBeNull();
    expect(result.frames.filter(f=>f.kind==="burst").some(f=>f.indices.includes(0))).toBe(false);
    expect(flowerMatches(result.game.board)).toEqual([]);
  });
  it("prevents either booster from directly opening or ticking a lock",()=>{
    const game=createFlowerGame("journey",1,seeded());
    game.board[0]!.obstacle={kind:"turn-lock",hp:2};
    expect(useFlowerTool(game,"shovel",0,seeded())).toBeNull();
    expect(useFlowerTool(game,"water",0,seeded())).toBeNull();
    const next=useFlowerTool(game,"shovel",48,seeded())!.game;
    expect(next.board[0]!.obstacle).toEqual({kind:"turn-lock",hp:2});
  });
});
it("preserves every still-locked flower and counter when the cascade cap reshuffles",()=>{
  const game=createFlowerGame("mystery",0,seeded(2));
  const result=swapFlower(game,16,23,()=>0)!;
  expect(result.frames.some(f=>f.kind==="shuffle")).toBe(true);
  game.board.forEach((cell,index)=>{
    if(!cell.obstacle)return;
    for(const frame of result.frames)if(frame.board[index]!.obstacle)expect(frame.board[index]!.color).toBe(cell.color);
    if(cell.obstacle.kind==="turn-lock")expect(result.game.board[index]!.obstacle?.hp).toBe(cell.obstacle.hp-1);
  });
});
it("counts cascaded blast waves separately and keeps a single turn tick when release creates a match",()=>{
  const blast=createFlowerGame("mystery",0,seeded(3));
  const result=swapFlower(blast,16,23,seeded(4))!;
  const counts=result.frames.filter(f=>f.kind==="burst").map(f=>f.board[17]!.obstacle?.hp);
  expect(counts.slice(0,2)).toEqual([2,1]);
  const timed=createFlowerGame("mystery",0,seeded(36));
  timed.board[5]!.obstacle!.hp=1;
  const next=swapFlower(timed,16,23,seeded(37))!;
  const release=next.frames.findIndex(f=>f.kind==="unlock"&&f.indices.includes(5));
  expect(release).toBeGreaterThan(-1);
  expect(next.frames.slice(release+1).some(f=>f.kind==="burst"&&[5,12,19].every(i=>f.indices.includes(i)))).toBe(true);
  timed.board.forEach((cell,i)=>{if(i!==5&&cell.obstacle?.kind==="turn-lock")expect(next.game.board[i]!.obstacle?.hp).toBe(cell.obstacle.hp-1);});
  expect(flowerMatches(next.game.board)).toEqual([]);
});
