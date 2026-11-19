import "fake-indexeddb/auto";
// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { ActionPanel } from "../src/components/ActionPanel.js";
import { AssetsDialog } from "../src/components/AssetsDialog.js";
import { makeState } from "../../../packages/game-core/test/fixtures/state-factory.js";
import { projectGame } from "@nha-choi/game-core";
import { vi } from "vitest";
import { App } from "../src/App.js";
import * as lifecycle from "../src/platform-lifecycle.js";
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
  expect(screen.getAllByRole("button", { name: /Chọn quân/ })).toHaveLength(12);
  const name = screen.getByRole("textbox", { name: "Tên của bạn" });
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));
  expect(screen.getByRole("alert").textContent).toContain("Nhập tên");
});

it("shows_the_location_photo_and_real_purchase_action", async () => {
  const { Game } = await import("../src/screens/Game.js");
  const { makeState } =
    await import("../../../packages/game-core/test/fixtures/state-factory.js");
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
  const { makeState } =
    await import("../../../packages/game-core/test/fixtures/state-factory.js");
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

it("asks_before_liquidating_every_building_in_a_color_group", () => {
  const state = makeState();
  for (const id of [1, 3]) {
    state.board[id]!.owner = "p1";
    state.board[id]!.buildings = 5;
  }
  state.bank.hotels = 10;
  state.bank.houses = 0;
  const send = vi.fn();
  render(
    <AssetsDialog
      view={projectGame(state, "p1")}
      onAction={send}
      onClose={() => {}}
      pending={false}
    />,
  );
  fireEvent.click(
    screen.getAllByRole("button", { name: "Bán công trình", exact: true })[0]!,
  );
  expect(send).not.toHaveBeenCalled();
  expect(
    screen.getByRole("heading", { name: "Thanh lý toàn bộ nhóm màu?" }),
  ).toBeTruthy();
  expect(screen.getByText(/250/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hủy thanh lý" }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Bán công trình", exact: true })[0]!,
  );
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận thanh lý" }));
  expect(send).toHaveBeenCalledWith({ type: "sell-building", spaceId: 1 });
});

it("submits_the_selected_building_auction_street", () => {
  const state = makeState();
  for (const id of [1, 3]) state.board[id]!.owner = "p1";
  for (const id of [6, 8, 9]) state.board[id]!.owner = "p2";
  state.phase = "auction";
  state.auction = {
    kind: "house",
    spaceId: 1,
    bid: 0,
    bidder: null,
    participants: ["p1", "p2"],
    targets: { p1: 1, p2: 6 },
  };
  const send = vi.fn();
  render(
    <ActionPanel
      view={projectGame(state, "p2")}
      onAction={send}
      pending={false}
      onAssets={() => {}}
      onTrade={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Xây công trình tại đây nếu thắng"), {
    target: { value: "9" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Trả giá", exact: true }));
  expect(send).toHaveBeenCalledWith({ type: "bid", amount: 1, spaceId: 9 });
});
it("explains_unconfigured_native_online_before_creating_a_room", async () => {
  const { Capacitor } = await import("@capacitor/core");
  const { Setup } = await import("../src/screens/Setup.js");
  const platform = vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  try {
    render(<Setup onStart={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Chơi online/ }));
    expect(
      (
        screen.getByRole("button", {
          name: "Tạo phòng",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(/Online chưa khả dụng trong bản ứng dụng này/),
    ).toBeTruthy();
  } finally {
    platform.mockRestore();
  }
});
it("reads_the_complete_bundled_rulebook_inside_the_app_without_opening_an_external_window", () => {
  render(<App />);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Luật chơi", exact: true })[0]!,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Đọc bộ luật đầy đủ", exact: true }),
  );
  expect(
    screen.getByRole("region", { name: "Bộ luật đầy đủ" }).textContent,
  ).toContain("Phố Phú Mỹ");
  expect(screen.queryByRole("link", { name: "Đọc bộ luật đầy đủ" })).toBeNull();
});

it("keeps_the_native_back_listener_registered_across_navigation", () => {
  const attach = vi
    .spyOn(lifecycle, "attachAndroidBack")
    .mockReturnValue(() => {});
  try {
    render(<App />);
    const back = attach.mock.calls[0]![0];
    fireEvent.click(
      screen.getByRole("button", { name: "Chơi Cờ tỷ phú", exact: true }),
    );
    expect(attach).toHaveBeenCalledTimes(1);
    let handled = false;
    act(() => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(
      screen.getByRole("button", { name: "Chơi Cờ tỷ phú", exact: true }),
    ).toBeTruthy();
    expect(attach).toHaveBeenCalledTimes(1);
  } finally {
    attach.mockRestore();
  }
});
