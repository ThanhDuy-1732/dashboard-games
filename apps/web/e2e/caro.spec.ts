import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const caro = (page: Page) => page.locator(".caro-screen");
const matchHeading = (page: Page) =>
  caro(page).locator(".caro-match-panel").getByRole("heading", { level: 2 });

async function mark(page: Page, coordinate: string) {
  await caro(page)
    .getByRole("button", { name: `${coordinate} trống`, exact: true })
    .click();
  await caro(page)
    .getByRole("button", { name: `Đánh ô ${coordinate}`, exact: true })
    .click();
}

test("Caro local shows a blocked winning line, resumes after reload and swaps first player", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chơi Cờ Caro" }).click();
  await caro(page)
    .getByRole("button", { name: /Hai người cùng máy/ })
    .click();
  await expect(page.locator(".caro-cell")).toHaveCount(225);
  const first = caro(page).getByRole("button", {
    name: "B1 trống",
    exact: true,
  });
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await caro(page)
    .getByRole("button", { name: "Đánh ô B1", exact: true })
    .click();
  for (const [o, x] of [
    ["A1", "C1"],
    ["G1", "D1"],
    ["C3", "E1"],
    ["D3", "F1"],
  ]) {
    await mark(page, o!);
    await mark(page, x!);
  }
  await expect(matchHeading(page)).toHaveText("Người chơi 1 thắng!");
  await expect(page.locator(".caro-cell.won")).toHaveCount(5);
  await page.reload();
  await page.getByRole("button", { name: "Mở ván Caro đã lưu" }).click();
  await expect(page.locator(".caro-cell.won")).toHaveCount(5);
  await caro(page).getByRole("button", { name: "Chơi lại" }).click();
  await expect(matchHeading(page)).toHaveText("Lượt X · Người chơi 2");
});

test("Caro plays with a bot in installed offline assets on a small screen", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/");
  await expect(
    page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Chơi Cờ Caro" }).click();
  await caro(page).getByLabel("Độ khó").selectOption("expert");
  await caro(page)
    .getByRole("button", { name: "Bắt đầu", exact: true })
    .click();
  await expect(caro(page).getByText("Đấu máy · Rất khó")).toBeVisible();
  await mark(page, "H8");
  await expect(page.locator('.caro-cell[data-mark="O"]')).toHaveCount(1);
  await caro(page).getByRole("button", { name: "Phóng to bàn" }).click();
  await expect(
    caro(page).getByRole("button", { name: "Vừa màn hình" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(375);
});

test("Caro online shares an invite and resumes the same board after reloading", async ({
  page,
  browser,
}) => {
  const guest = await browser.newPage();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Chơi Cờ Caro" }).click();
    await caro(page).getByRole("button", { name: "Chọn phòng" }).click();
    await caro(page).getByLabel("Tên hiển thị").fill("Duy");
    await caro(page).getByRole("button", { name: "Tạo phòng" }).click();
    await expect(
      caro(page).getByText("Đang chờ người thứ hai vào phòng."),
    ).toBeVisible();
    const code = await page.locator(".caro-room strong").innerText();
    await guest.goto(new URL(`/?caro=${code}`, page.url()).href);
    await expect(caro(guest).getByLabel("Mã phòng")).toHaveValue(code);
    await caro(guest).getByLabel("Tên hiển thị").fill("Bạn chơi");
    await caro(guest).getByRole("button", { name: "Vào phòng" }).click();
    await mark(page, "H8");
    await expect(matchHeading(guest)).toHaveText("Lượt O · Bạn chơi");
    await guest.reload();
    await expect(matchHeading(page)).toHaveText("Đang chờ kết nối");
    await caro(guest)
      .getByRole("button", { name: "Tiếp tục phòng Caro" })
      .click();
    await mark(guest, "H9");
    await expect(
      caro(page).getByRole("button", { name: "H9 O, nước vừa đánh" }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("a legacy Caro game completed offline from Home syncs just its completion", async ({ page, context }) => {
  const events: { id: string; kind: string; game?: string }[] = [];
  await page.route("**/api/telemetry", async (route) => {
    const { events: batch } = route.request().postDataJSON();
    events.push(...batch);
    await route.fulfill({ json: { accepted: batch.map(({ id }: { id: string }) => id), expired: [] } });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("nha-choi-caro-offline-v1", JSON.stringify({
    version: 1, mode: "local", firstMark: "X", moves: [0, 30, 1, 31, 2, 32, 3, 33],
  })));
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Mở ván Caro đã lưu" }).click();
  await mark(page, "E1");
  await expect(matchHeading(page)).toHaveText("Người chơi 1 thắng!");
  expect(events.filter(({ game }) => game === "caro")).toHaveLength(0);
  await context.setOffline(false);
  await expect.poll(() => events.filter(({ game }) => game === "caro").map(({ kind }) => kind)).toEqual(["game_completed"]);
  expect(new Set(events.filter(({ kind }) => kind === "session_started").map(({ id }) => id)).size).toBe(1);
});
