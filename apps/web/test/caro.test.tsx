// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { CaroScreen } from "../src/caro/Screen.js";
import { readCaroSave } from "../src/caro/save.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

it("opens Caro from Nhà Chơi, confirms a move and restores the saved position", () => {
  const app = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Chơi Cờ Caro" }));
  fireEvent.click(screen.getByRole("button", { name: /Hai người cùng máy/ }));
  const board = within(screen.getByRole("group", { name: /Bàn cờ Caro/ }));
  const center = board.getByRole("button", { name: "H8 trống" });
  expect(center.tabIndex).toBe(0);
  fireEvent.keyDown(center, { key: "ArrowRight" });
  const next = board.getByRole("button", { name: "I8 trống" });
  expect(next).toBe(document.activeElement);
  fireEvent.click(next);
  expect(readCaroSave()?.game.moves).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Đánh ô I8" }));
  expect(
    board.getByRole("button", { name: "I8 X, nước vừa đánh" }),
  ).toBeTruthy();
  app.unmount();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Mở ván Caro đã lưu" }));
  expect(
    screen.getByRole("heading", { name: "Lượt O · Người chơi 2" }),
  ).toBeTruthy();
});

it.each(["easy", "hard", "expert"])("plays and persists a %s bot reply", (mode) => {
  vi.useFakeTimers();
  render(
    <CaroScreen
      startSaved={false}
      onHome={() => {}}
      onRules={() => {}}
      onInGame={() => {}}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Độ khó" }), {
    target: { value: mode },
  });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  fireEvent.click(screen.getByRole("button", { name: "H8 trống" }));
  fireEvent.click(screen.getByRole("button", { name: "Đánh ô H8" }));
  expect(screen.getByRole("heading", { name: "Lượt O · Máy" })).toBeTruthy();
  act(() => vi.advanceTimersByTime(400));
  const saved = readCaroSave();
  expect(saved?.mode).toBe(mode);
  expect(saved?.game.moves).toHaveLength(2);
  expect(saved?.game.turn).toBe("X");
});

it("shows the blocked five as a win when reopening an older Caro save", () => {
  const moves = [1, 0, 2, 6, 3, 20, 4, 40, 5, 41];
  localStorage.setItem(
    "nha-choi-caro-offline-v1",
    JSON.stringify({ version: 1, mode: "local", firstMark: "X", moves }),
  );
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Mở ván Caro đã lưu" }));
  expect(screen.getByRole("heading", { name: "Người chơi 1 thắng!" })).toBeTruthy();
  const board = within(screen.getByRole("group", { name: /Bàn cờ Caro/ }));
  expect(
    board.getAllByRole("button", { name: /nằm trong hàng thắng/ }),
  ).toHaveLength(5);
});
