// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.js";
import { KilnScreen } from "../src/kiln/Screen.js";
import { loadKilnSave } from "../src/kiln/save.js";

const props = { active: true, onHome() {}, onRules() {}, onInGame() {} };
const cell = (row: number, column: number) => screen.getByRole("button", { name: new RegExp(`Hàng ${row}, cột ${column},`) });

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value: function (this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value: function (this: HTMLDialogElement) { this.open = false; },
  });
});

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("nha-choi-kiln-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("opens from Home and restores the board after navigating away or remounting", async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Chơi Lò Gốm" }));
  await screen.findByRole("heading", { name: "Mẻ đầu tay" });
  fireEvent.click(cell(2, 7));
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
  expect(screen.getByText("11", { selector: "[data-kiln-left]" })).toBeTruthy();
  await waitFor(async () => expect((await loadKilnSave())?.save.active.moves).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "Về Nhà Chơi" }));
  fireEvent.click(screen.getByRole("button", { name: /Lò Gốm.*Xếp khối/ }));
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cách chơi" }));
  expect(screen.getByRole("dialog", { name: "Luật chơi Lò Gốm" })).toBeTruthy();
  view.unmount();
  render(<KilnScreen {...props} />);
  expect(await screen.findByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
});

it("wins the opening, unlocks once, and preserves unlocked levels after replay", async () => {
  render(<KilnScreen {...props} />);
  await screen.findByRole("heading", { name: "Mẻ đầu tay" });
  const levels = screen.getByRole("group", { name: "Chọn màn" });
  const level2 = within(levels).getByRole("button", { name: "Màn 2: Đợi đúng lửa" }) as HTMLButtonElement;
  expect(level2.disabled).toBe(true);
  fireEvent.click(cell(2, 7));
  fireEvent.click(cell(4, 1));
  fireEvent.click(cell(6, 4));
  expect(screen.getByText("Mẻ gốm thành công!")).toBeTruthy();
  await waitFor(async () => expect((await loadKilnSave())?.save.unlocked).toBe(2));
  fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
  expect(screen.getByText("0", { selector: "[data-kiln-score]" })).toBeTruthy();
  expect(level2.disabled).toBe(false);
  fireEvent.click(level2);
  expect(screen.getByRole("heading", { name: "Đợi đúng lửa" })).toBeTruthy();
  cell(1, 1).focus();
  fireEvent.keyDown(cell(1, 1), { key: "ArrowRight" });
  expect(document.activeElement).toBe(cell(1, 2));
  await waitFor(async () => expect((await loadKilnSave())?.save.active.level).toBe(2));
});

it("keeps the current game playable and warns if storage is unavailable", async () => {
  vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new Error("Storage disabled"); });
  const view = render(<KilnScreen {...props} />);
  await screen.findByRole("alert");
  fireEvent.click(cell(2, 7));
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Chưa lưu"));
  view.rerender(<KilnScreen {...props} active={false} />);
  view.rerender(<KilnScreen {...props} />);
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
});

it("protects an unsaved victory from PWA updates even after leaving the game", async () => {
  const onInGame = vi.fn();
  const view = render(<KilnScreen {...props} onInGame={onInGame} />);
  await screen.findByRole("heading", { name: "Mẻ đầu tay" });
  fireEvent.click(cell(2, 7));
  fireEvent.click(cell(4, 1));
  await waitFor(async () => expect((await loadKilnSave())?.save.active.moves).toHaveLength(2));
  vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new Error("Quota exceeded"); });
  fireEvent.click(cell(6, 4));
  expect(screen.getByText("Mẻ gốm thành công!")).toBeTruthy();
  await screen.findByRole("alert");
  view.rerender(<KilnScreen {...props} active={false} onInGame={onInGame} />);
  expect(onInGame).toHaveBeenLastCalledWith(true);
  view.rerender(<KilnScreen {...props} onInGame={onInGame} />);
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tiến độ chưa lưu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận bỏ tiến độ" }));
  expect(screen.getByText("125", { selector: "[data-kiln-score]" })).toBeTruthy();
});

it("bursts cleared tiles and confirms a size change before replacing the current board", async () => {
  const view = render(<KilnScreen {...props} />);
  const board = await screen.findByRole("group", { name: "Bàn xếp khối 8 × 8" });
  expect(board.querySelectorAll(".kiln-burst")).toHaveLength(0);
  fireEvent.click(cell(2, 7));
  expect(board.querySelectorAll(".kiln-burst")).toHaveLength(8);
  expect(board.querySelectorAll(".kiln-burst.is-gold")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "10 × 10" }));
  const dialog = screen.getByRole("dialog", { name: "Đổi kích thước bàn?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "10 × 10" }));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu lại" }));
  const larger = screen.getByRole("group", { name: "Bàn xếp khối 10 × 10" });
  expect(within(larger).getAllByRole("button")).toHaveLength(100);
  fireEvent.click(cell(2, 9));
  expect(larger.querySelectorAll(".kiln-burst")).toHaveLength(10);
  await waitFor(async () => expect((await loadKilnSave())?.save.active).toMatchObject({ size: 10, moves: [{ slot: 0, anchor: 18 }] }));
  view.unmount();
  render(<KilnScreen {...props} />);
  const restored = await screen.findByRole("group", { name: "Bàn xếp khối 10 × 10" });
  expect(restored.querySelectorAll(".kiln-burst")).toHaveLength(0);
});

it("opens endless play separately and restores both modes", async () => {
  const view = render(<KilnScreen {...props} />);
  await screen.findByRole("heading", { name: "Mẻ đầu tay" });
  fireEvent.click(cell(2, 7));
  fireEvent.click(screen.getByRole("button", { name: "Vô tận" }));
  expect(screen.getByRole("heading", { name: "Vô tận" })).toBeTruthy();
  expect(screen.queryByText("Lượt còn")).toBeNull();
  expect(screen.getByText("Lượt đã chơi")).toBeTruthy();
  fireEvent.click(cell(1, 1));
  await waitFor(async () => expect((await loadKilnSave())?.save).toMatchObject({ mode: "endless", endless: { turn: 1 } }));
  const saved = (await loadKilnSave())!.save;
  const firstRun = { id: saved.endless?.id, startedAt: saved.endless?.startedAt };
  expect(firstRun).toEqual({ id: expect.any(String), startedAt: expect.any(Number) });
  expect(saved.active.id).not.toBe(firstRun.id);
  view.unmount();
  render(<KilnScreen {...props} />);
  expect(await screen.findByRole("heading", { name: "Vô tận" })).toBeTruthy();
  expect(screen.getByText("4", { selector: "[data-kiln-score]" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Màn 1: Mẻ đầu tay" }));
  expect(screen.getByText("62", { selector: "[data-kiln-score]" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Vô tận" }));
  expect(screen.getByText("4", { selector: "[data-kiln-score]" })).toBeTruthy();
  fireEvent.click(cell(1, 3));
  await waitFor(async () => expect((await loadKilnSave())?.save).toMatchObject({
    mode: "endless", active: { id: saved.active.id }, endless: { turn: 2, ...firstRun },
  }));
});
