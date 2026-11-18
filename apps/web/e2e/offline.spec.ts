import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { makeState } from "../../../packages/game-core/test/fixtures/state-factory.js";
import { makeSavedGame } from "../src/storage/save-schema.js";
async function readSave(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        gameId: string;
        revision: number;
        state: { players: { cash: number; position: number }[] };
      }>((resolve, reject) => {
        const r = indexedDB.open("nha-choi", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("offline", "readonly");
          const q = tx.objectStore("offline").get("current");
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
test("saves_a_real_game_leaves_and_resumes_it_after_reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill("Bạn chơi");
  await page.getByRole("spinbutton", { name: "Số đối thủ máy" }).fill("1");
  await page.getByRole("button", { name: "Bắt đầu ván", exact: true }).click();
  await page.getByRole("button", { name: /^Gieo/ }).waitFor();
  await page.getByRole("button", { name: /^Gieo/ }).click();
  await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
  await page.getByRole("button", { name: "Rời bàn chơi" }).click();
  await page.getByRole("button", { name: "Lưu và rời ván" }).click();
  await page
    .getByRole("button", { name: "Tiếp tục ván", exact: true })
    .waitFor();
  const before = await readSave(page);
  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục ván", exact: true }).click();
  await page.locator(".board").waitFor();
  await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
  const after = await readSave(page);
  expect(after.gameId).toBe(before.gameId);
  expect(after.revision).toBe(before.revision);
  expect(after.state.players).toEqual(before.state.players);
});
test("restores_saved_debt_auction_jail_and_bot_turn", async ({ page }) => {
  for (const phase of [
    "debt",
    "auction",
    "jail-choice",
    "awaiting-roll",
  ] as const) {
    await page.goto("/");
    const state = makeState();
    state.phase = phase;
    if (phase === "debt") {
      state.players[0]!.cash = 0;
      state.debt = { payer: "p1", payee: "bank", amount: 50 };
    }
    if (phase === "auction")
      state.auction = {
        kind: "property",
        spaceId: 6,
        bid: 0,
        bidder: null,
        participants: ["p1", "p2"],
      };
    if (phase === "jail-choice") {
      state.players[0]!.position = 10;
      state.players[0]!.jail = { turns: 1 };
    }
    if (phase === "awaiting-roll") state.turn.playerId = "p2";
    const save = makeSavedGame(state, "p1");
    await page.evaluate(async (value) => {
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("nha-choi", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("offline");
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("offline", "readwrite");
          tx.objectStore("offline").put(value, "current");
          tx.objectStore("offline").delete("previous");
          tx.objectStore("offline").delete("lease");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      });
    }, save);
    await page.reload();
    await page
      .getByRole("button", { name: "Tiếp tục ván", exact: true })
      .click();
    await page.locator(".board").waitFor();
    if (phase === "debt")
      await expect(
        page.getByRole("heading", { name: "Cần thanh toán 50" }),
      ).toBeVisible();
    if (phase === "auction")
      await expect(
        page.getByRole("heading", { name: /Đấu giá Phố Hàng Buồm/ }),
      ).toBeVisible();
    if (phase === "jail-choice")
      await expect(
        page.getByRole("button", { name: "Trả 50 để ra tù" }),
      ).toBeVisible();
    if (phase === "awaiting-roll")
      await page.getByRole("button", { name: /^Gieo/ }).waitFor();
    await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
    expect((await readSave(page)).gameId).toBe("game-1");
    await page.getByRole("button", { name: "Rời bàn chơi" }).click();
    await page.getByRole("button", { name: "Lưu và rời ván" }).click();
    await page
      .getByRole("button", { name: "Tiếp tục ván", exact: true })
      .waitFor();
  }
});
test("another_tab_cannot_open_the_same_save_as_a_second_writer", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill("Chủ ván");
  await page.getByRole("button", { name: "Bắt đầu ván", exact: true }).click();
  await page.locator(".board").waitFor();
  const other = await context.newPage();
  await other.goto("/");
  await other
    .getByRole("button", { name: "Tiếp tục ván", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText("tab khác");
  await expect(other.locator(".board")).toHaveCount(0);
  await expect(page.locator(".board")).toBeVisible();
});
