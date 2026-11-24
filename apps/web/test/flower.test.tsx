// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { FlowerScreen } from "../src/flower/Screen.js";
import { FLOWER_SAVE_KEY, emptyFlowerSave, readFlowerSave, recordFlowerGame, writeFlowerSave } from "../src/flower/save.js";
import { createFlowerGame, FLOWER_NAMES } from "@nha-choi/game-core";
beforeAll(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
  Object.defineProperty(window,"matchMedia",{configurable:true,value:()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}})});
});
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
const props={onHome:()=>{},onRules:()=>{},onInGame:()=>{}};
it("opens Vườn Hoa from Home, plays a swap and resumes the completed turn after remount",async()=>{
  const app=render(<App/>);
  fireEvent.click(screen.getByRole("button",{name:"Chơi Vườn Hoa"}));
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  fireEvent.click(screen.getByRole("button",{name:/Hàng 3, cột 3,/}));
  fireEvent.click(screen.getByRole("button",{name:/Hàng 4, cột 3,/}));
  await waitFor(()=>expect(readFlowerSave().save.quick?.movesLeft).toBe(19));
  const saved=readFlowerSave().save.quick!;
  app.unmount();render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Tiếp tục Chơi nhanh"}));
  expect(screen.getByText("19",{selector:".flower-moves"})).toBeTruthy();
  expect(readFlowerSave().save.quick?.board).toEqual(saved.board);
});
it("confirms before replacing an unfinished saved game and leaves it untouched when canceled",async()=>{
  const save=recordFlowerGame(emptyFlowerSave(),createFlowerGame("quick"));
  const raw=await writeFlowerSave(save,null);
  render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  expect(screen.getByRole("dialog",{name:"Thay thế ván Vườn Hoa?"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Giữ ván đã lưu"}));
  expect(localStorage.getItem(FLOWER_SAVE_KEY)).toBe(raw);
});
it("shows twelve levels and keeps later levels locked",()=>{
  render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Khám phá khu vườn"}));
  expect(screen.getByRole("button",{name:/Màn 1,/}).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button",{name:/Màn 2,/}).hasAttribute("disabled")).toBe(true);
  expect(screen.getAllByRole("button",{name:/^Màn \d+,/})).toHaveLength(12);
});
it("stops writes when another tab changes the save and reloads only on request",async()=>{
  const before=await writeFlowerSave(emptyFlowerSave(),null);
  render(<FlowerScreen {...props}/>);
  const next=JSON.stringify(recordFlowerGame(emptyFlowerSave(),createFlowerGame("quick")));
  localStorage.setItem(FLOWER_SAVE_KEY,next);
  fireEvent(window,new StorageEvent("storage",{key:FLOWER_SAVE_KEY,oldValue:before,newValue:next}));
  expect(screen.getByText(/Bản lưu đã thay đổi ở trang khác/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Tải bản lưu mới"}));
  expect(screen.getByRole("button",{name:"Tiếp tục Chơi nhanh"})).toBeTruthy();
  expect(localStorage.getItem(FLOWER_SAVE_KEY)).toBe(next);
});
it("does not overwrite corrupt data just by opening the game",()=>{
  localStorage.setItem(FLOWER_SAVE_KEY,"broken");
  render(<FlowerScreen {...props}/>);
  expect(screen.getByRole("alert").textContent).toMatch(/bản lưu/i);
  expect(localStorage.getItem(FLOWER_SAVE_KEY)).toBe("broken");
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  expect(screen.getByRole("dialog",{name:"Thay thế ván Vườn Hoa?"})).toBeTruthy();
});
it("keeps a completed turn in memory across Home navigation when storage fails",async()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole("button",{name:"Chơi Vườn Hoa"}));
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  const spy=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("quota");});
  fireEvent.click(screen.getByRole("button",{name:/Hàng 3, cột 3,/}));
  fireEvent.click(screen.getByRole("button",{name:/Hàng 4, cột 3,/}));
  await screen.findByText(/Thiết bị chưa lưu được Vườn Hoa/);
  fireEvent.click(screen.getByRole("button",{name:"Nhà Chơi",exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Chơi Vườn Hoa"}));
  expect(screen.getByText("19",{selector:".flower-moves"})).toBeTruthy();
  spy.mockRestore();
  fireEvent.click(screen.getByRole("button",{name:"Thử lưu lại"}));
  await waitFor(()=>expect(readFlowerSave().save.quick?.movesLeft).toBe(19));
});
it("rejects diagonal, long and row-wrapping drag gestures",async()=>{
  const {flowerDragTarget}=await import("../src/flower/Board.js");
  expect(flowerDragTarget(16,50,50,50)).toBeNull();
  expect(flowerDragTarget(16,0,100,50)).toBeNull();
  expect(flowerDragTarget(6,50,0,50)).toBeNull();
  expect(flowerDragTarget(16,3,45,50)).toBe(23);
  expect(flowerDragTarget(16,18,2,50)).toBe(17);
});
it("uses the current-game shortcut to return to the retained flower board from the map and Home",async()=>{
  render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Chơi Vườn Hoa"}));
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  fireEvent.click(screen.getByRole("button",{name:"Hành trình",exact:true}));
  fireEvent.click(screen.getAllByRole("button",{name:"Vào bàn chơi",exact:true})[0]!);
  expect(screen.getByRole("group",{name:"Bàn hoa 7 × 7"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Nhà Chơi",exact:true}));
  fireEvent.click(screen.getAllByRole("button",{name:"Vào bàn chơi",exact:true})[0]!);
  expect(screen.getByRole("group",{name:"Bàn hoa 7 × 7"})).toBeTruthy();
  await waitFor(()=>expect(readFlowerSave().save.quick).not.toBeNull());
});
it("waits for the save attempt before starting the swap animation",async()=>{
  const storage=await import("../src/flower/save.js");
  const original=storage.writeFlowerSave;
  const app=render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Chơi một ván"}));
  await waitFor(()=>expect(readFlowerSave().save.quick).not.toBeNull());
  let release:()=>void=()=>{};
  vi.spyOn(storage,"writeFlowerSave").mockImplementation((save,raw)=>new Promise<string>((resolve,reject)=>{release=()=>{void original(save,raw).then(resolve,reject);};}));
  fireEvent.click(screen.getByRole("button",{name:/Hàng 3, cột 3,/}));
  fireEvent.click(screen.getByRole("button",{name:/Hàng 4, cột 3,/}));
  expect(app.container.querySelectorAll(".swapping")).toHaveLength(0);
  await waitFor(()=>expect(screen.getByText("Đang lưu…")).toBeTruthy());
  release();await waitFor(()=>expect(readFlowerSave().save.quick?.movesLeft).toBe(19));
});
it("opens Mystery mode, labels its locks and resumes their counters without replacing quick play",async()=>{
  const quick=createFlowerGame("quick");await writeFlowerSave(recordFlowerGame(emptyFlowerSave(),quick),null);
  const app=render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Chơi Vườn khóa bí ẩn"}));
  await waitFor(()=>expect(readFlowerSave().save.mystery).not.toBeNull());
  const game=readFlowerSave().save.mystery!;
  expect(app.container.querySelectorAll(".flower-lock").length).toBeGreaterThanOrEqual(4);
  const index=game.board.findIndex(c=>c.obstacle!==null);
  const lock=screen.getByRole("button",{name:new RegExp(`Hàng ${Math.floor(index/7)+1}, cột ${index%7+1}, khóa`)});
  expect(lock.getAttribute("aria-disabled")).toBe("true");
  expect(lock.getAttribute("aria-label")).toContain(FLOWER_NAMES[game.board[index]!.color]);
  fireEvent.click(lock);expect(readFlowerSave().save.mystery?.revision).toBe(0);
  app.unmount();render(<FlowerScreen {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Tiếp tục Vườn khóa bí ẩn"}));
  expect(readFlowerSave().save.mystery?.board).toEqual(game.board);
  expect(readFlowerSave().save.quick).toEqual(quick);
});
