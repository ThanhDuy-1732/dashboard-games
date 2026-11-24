// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { createFlowerGame, swapFlower } from "@nha-choi/game-core";
import { FLOWER_SAVE_KEY, emptyFlowerSave, flowerUnlocked, readFlowerSave, recordFlowerGame, writeFlowerSave } from "../src/flower/save.js";
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});
it("keeps quick and campaign saves separate and round-trips a completed turn",async()=>{
  let save=recordFlowerGame(emptyFlowerSave(),createFlowerGame("quick"));
  save=recordFlowerGame(save,createFlowerGame("journey",1));
  const raw=await writeFlowerSave(save,null);
  const loaded=readFlowerSave();
  expect(loaded.problem).toBeNull();expect(loaded.raw).toBe(raw);
  expect(loaded.save.quick?.mode).toBe("quick");expect(loaded.save.journey?.level).toBe(1);
  expect(flowerUnlocked(loaded.save)).toBe(1);
});
it("rejects malformed, incompatible and semantically inconsistent records without writing",()=>{
  for(const raw of ['{',JSON.stringify({version:9}),JSON.stringify({...emptyFlowerSave(),quick:{...createFlowerGame("quick"),movesLeft:99}})]){
    localStorage.setItem(FLOWER_SAVE_KEY,raw);
    expect(readFlowerSave().problem).toMatch(/bản lưu/i);
    expect(localStorage.getItem(FLOWER_SAVE_KEY)).toBe(raw);
  }
});
it("rejects impossible game states including blockers, goals, revisions and unstable boards",()=>{
  const game=createFlowerGame("journey",1);
  const invalid=[{...game,status:"won"},{...game,revision:10},{...game,grass:[0]},{...game,board:game.board.map(()=>({color:0,obstacle:null}))}];
  for(const quick of invalid){const data={...emptyFlowerSave(),journey:quick};localStorage.setItem(FLOWER_SAVE_KEY,JSON.stringify(data));expect(readFlowerSave().problem).not.toBeNull();}
});
it("rejects stale writes and reports quota errors, preserving the existing saved position",async()=>{
  const before=await writeFlowerSave(emptyFlowerSave(),null);
  await expect(writeFlowerSave(emptyFlowerSave(),null)).rejects.toThrow(/trang khác/);
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("full","QuotaExceededError");});
  await expect(writeFlowerSave(emptyFlowerSave(),before)).rejects.toThrow();
  expect(localStorage.getItem(FLOWER_SAVE_KEY)).toBe(before);
});
it("records stars and high scores monotonically and opens the next campaign level",()=>{
  let game=createFlowerGame("journey",1);
  game={...game,score:790};
  const hint=[16,23] as const;
  game=swapFlower(game,...hint)!.game;
  expect(game.status).toBe("won");
  let save=recordFlowerGame(emptyFlowerSave(),game);
  expect(save.levels[0]!.stars).toBe(3);expect(flowerUnlocked(save)).toBe(2);
  const lower={...game,movesLeft:0,score:800};
  save=recordFlowerGame(save,lower);
  expect(save.levels[0]!.stars).toBe(3);expect(save.levels[0]!.score).toBeGreaterThanOrEqual(880);
  save.levels=save.levels.map(()=>({stars:3,score:3000}));expect(flowerUnlocked(save)).toBe(12);
});
it("serializes simultaneous tab writes so only one accepts the same base record",async()=>{
  const first=recordFlowerGame(emptyFlowerSave(),createFlowerGame("quick"));
  const second=recordFlowerGame(emptyFlowerSave(),createFlowerGame("journey",1));
  const results=await Promise.allSettled([writeFlowerSave(first,null),writeFlowerSave(second,null)]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
});
it("rejects a saved campaign win with missing or lower recorded best results",()=>{
  const game={...createFlowerGame("journey",1),score:900,status:"won" as const};
  for(const best of [{stars:0,score:0},{stars:1,score:900},{stars:3,score:800}]){
    const data={...emptyFlowerSave(),journey:game};data.levels[0]=best;
    localStorage.setItem(FLOWER_SAVE_KEY,JSON.stringify(data));expect(readFlowerSave().problem).not.toBeNull();
  }
});
it("loads legacy v1 saves without a mystery slot and preserves both existing games",async()=>{
  const legacy=recordFlowerGame(recordFlowerGame(emptyFlowerSave(),createFlowerGame("quick")),createFlowerGame("journey",1));
  const old:Partial<typeof legacy>={...legacy};delete old.mystery;
  localStorage.setItem(FLOWER_SAVE_KEY,JSON.stringify(old));
  const loaded=readFlowerSave();expect(loaded.problem).toBeNull();expect(loaded.save.mystery).toBeNull();
  const save=recordFlowerGame(loaded.save,createFlowerGame("mystery"));await writeFlowerSave(save,loaded.raw);
  const restored=readFlowerSave();expect(restored.problem).toBeNull();
  expect(restored.save.quick).toEqual(legacy.quick);expect(restored.save.journey).toEqual(legacy.journey);
  expect(restored.save.mystery).toEqual(save.mystery);
});
it("rejects wrong-mode locks and impossible mystery counters",()=>{
  const invalid=[
    {...createFlowerGame("quick"),board:createFlowerGame("mystery").board},
    {...createFlowerGame("mystery"),board:createFlowerGame("mystery").board.map(c=>c.obstacle?{...c,obstacle:{...c.obstacle,hp:5}}:c)},
    {...createFlowerGame("mystery"),movesLeft:16,revision:4},
  ];
  invalid[2]!.board[0]!.obstacle={kind:"turn-lock",hp:1};
  for(const game of invalid){const save=recordFlowerGame(emptyFlowerSave(),game);localStorage.setItem(FLOWER_SAVE_KEY,JSON.stringify(save));expect(readFlowerSave().problem).not.toBeNull();}
});
