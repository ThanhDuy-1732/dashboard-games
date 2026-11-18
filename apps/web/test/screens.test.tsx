import "fake-indexeddb/auto";
// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
afterEach(cleanup);
beforeAll(() => {
  // jsdom has no native modal dialog implementation; actual dialog behavior is checked in Playwright.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
it("opens_real_offline_setup_and_validates_player_name", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Chơi Cờ tỷ phú/ }));
  expect(
    screen.getByRole("spinbutton", { name: "Số đối thủ máy" }),
  ).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Chọn quân/ })).toHaveLength(6);
  const name = screen.getByRole("textbox", { name: "Tên của bạn" });
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));
  expect(screen.getByRole("alert").textContent).toContain("Nhập tên");
});

it("shows_the_location_photo_and_real_purchase_action", async () => {
  const { Game } = await import("../src/screens/Game.js");
  const { makeState } = await import(
    "../../../packages/game-core/test/fixtures/state-factory.js"
  );
  const { projectGame } = await import("@nha-choi/game-core");
  const state = makeState();
  state.phase = "awaiting-purchase";
  state.purchase = 6;
  const actions: unknown[] = [];
  render(
    <Game
      view={projectGame(state, "p1")}
      pending={false}
      onAction={(action) => actions.push(action)}
      onLeave={() => {}}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Phố Hàng Buồm, Hà Nội" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mua đất · 100" }));
  expect(actions).toEqual([{ type: "buy-property" }]);
  expect(
    screen.getAllByRole("link", { name: "Wikimedia Commons" }),
  ).toHaveLength(1);
});
it("asks_before_replacing_an_unfinished_saved_game", async () => {
  const { createSaveStore } = await import("../src/storage/save.js");
  const { makeSavedGame } = await import("../src/storage/save-schema.js");
  const { makeState } = await import(
    "../../../packages/game-core/test/fixtures/state-factory.js"
  );
  const store = createSaveStore();
  await store.claim();
  await store.replace(makeSavedGame(makeState(), "p1"));
  await store.release();
  render(<App />);
  await screen.findByRole("button", { name: "Tiếp tục ván" });
  fireEvent.click(screen.getByRole("button", { name: "Chơi Cờ tỷ phú" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Tên của bạn" }), {
    target: { value: "Tên mới" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Bắt đầu ván", exact: true }),
  );
  await screen.findByRole("dialog", { name: "Thay thế ván đã lưu?" });
  fireEvent.click(screen.getByRole("button", { name: "Giữ ván đã lưu" }));
  expect((await store.load()).save?.gameId).toBe("game-1");
  await store.remove();
});
