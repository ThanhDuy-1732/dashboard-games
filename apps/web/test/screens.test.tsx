// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
afterEach(cleanup);
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
