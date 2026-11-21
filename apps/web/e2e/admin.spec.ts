import { expect, test } from "@playwright/test";

test("opens protected admin pages directly and shows the cleanup preview before deletion", async ({ page }) => {
  await page.goto("/admin/cleanup");
  await expect(page.getByRole("heading", { name: "Quản trị Nhà Chơi" })).toBeVisible();
  const summary = {
    days: ["2026-11-21"], updatedAt: "2026-11-21T10:00:00Z", traffic: { active: 0, rows: [] },
    games: [
      { day: "2026-11-21", kind: "game_started", dimensions: { game: "caro", mode: "offline" }, count: 2 },
      { day: "2026-11-21", kind: "game_started", dimensions: { game: "ty-phu", mode: "online" }, count: 3 },
    ],
    system: { bytes: 1024, ramBytes: 2048, tables: [], storageHistory: [], latency: [] },
    ongoing: { caro: 0, "ty-phu": 1 }, droppedMetrics: 0, metricWriteErrors: 0,
  };
  await page.route("**/api/admin/summary?*", (route) => route.fulfill({ json: summary }));
  let confirmed = false;
  await page.route("**/api/admin/cleanup", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    confirmed = route.request().postDataJSON().previewToken === "fixture-token";
    return route.fulfill({ json: { deleted: 2, remaining: 0 } });
  });
  await page.route("**/api/admin/cleanup/preview", (route) => route.fulfill({
    json: { count: 2, estimatedBytes: 1024, previewToken: "fixture-token", before: "2026-01-01T17:00:00Z" },
  }));
  await page.getByLabel("Mật khẩu quản trị").fill("fixture-only");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Dọn dữ liệu" })).toBeVisible();
  await page.getByRole("button", { name: "Xem trước" }).click();
  await expect(page.getByText("2 bản ghi đủ điều kiện")).toBeVisible();
  expect(confirmed).toBe(false);
  await page.getByRole("button", { name: "Xác nhận dọn" }).press("Enter");
  await expect(page.getByText("Đã xóa 2 bản ghi.")).toBeVisible();
  expect(confirmed).toBe(true);
  await page.goto("/admin/games");
  await expect(page.getByRole("heading", { name: "Ván chơi" })).toBeVisible();
  await page.getByLabel("Khoảng thời gian").selectOption("30d");
  await expect(page.getByRole("cell", { name: "Caro" }).first()).toBeVisible();
});
