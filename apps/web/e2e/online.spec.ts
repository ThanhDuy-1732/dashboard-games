import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function setup(page: Page, name: string, token: string, code?: string) {
  await page.goto(code ? `/?room=${code}` : "/");
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("button", { name: /^Chơi online/ }).click();
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill(name);
  await page
    .getByRole("button", { name: `Chọn quân ${token}`, exact: true })
    .click();
  if (code) {
    await page.getByLabel("Phòng chơi", { exact: true }).selectOption("join");
    await page.getByRole("textbox", { name: "Mã phòng" }).fill(code);
  }
  await page
    .getByRole("button", {
      name: code ? "Vào phòng" : "Tạo phòng",
      exact: true,
    })
    .click();
  await page.getByTestId("room-code").waitFor();
}
for (const count of [2, 6])
  test(`online_${count}_players_share_board_and_resume_after_reload`, async ({
    browser,
  }) => {
    test.setTimeout(count === 6 ? 60000 : 30000);
    const contexts = await Promise.all(
      Array.from({ length: count }, () => browser.newContext()),
    );
    try {
      const pages = await Promise.all(
        contexts.map((context) => context.newPage()),
      );
      const tokens = ["car", "cat", "hat", "ship", "dog", "plane"];
      await setup(pages[0]!, "Chủ phòng", tokens[0]!);
      const code = (
        await pages[0]!.getByTestId("room-code").textContent()
      ).trim();
      await Promise.all(
        pages
          .slice(1)
          .map((page, index) =>
            setup(page, `Bạn ${index + 1}`, tokens[index + 1]!, code),
          ),
      );
      await Promise.all(
        pages.map((page) =>
          page.getByRole("button", { name: "Sẵn sàng", exact: true }).click(),
        ),
      );
      await pages[0]!
        .getByRole("button", { name: "Bắt đầu ván", exact: true })
        .click();
      for (const page of pages)
        await expect(page.locator(".board-cell")).toHaveCount(40);
      const actor = (
        await Promise.all(
          pages.map(async (page) =>
            (await page.getByRole("button", { name: /^Gieo/ }).count()) > 0
              ? page
              : null,
          ),
        )
      ).find(Boolean)!;
      const before = Number(
        await pages[0]!
          .locator("[data-revision]")
          .getAttribute("data-revision"),
      );
      await actor.getByRole("button", { name: /^Gieo/ }).click();
      for (const page of pages)
        await expect(page.locator("[data-revision]")).toHaveAttribute(
          "data-revision",
          String(before + 1),
        );
      const ids = await Promise.all(
        pages.map((page) =>
          page.locator("[data-viewer-id]").getAttribute("data-viewer-id"),
        ),
      );
      expect(new Set(ids).size).toBe(count);
      for (const page of pages)
        await expect(page.locator(".activity-panel ol")).toHaveText(
          await pages[0]!.locator(".activity-panel ol").textContent(),
        );
      await pages[1]!.reload();
      await pages[1]!.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
      await pages[1]!.getByRole("button", { name: /^Chơi online/ }).click();
      await pages[1]!
        .getByRole("button", { name: "Kết nối lại phòng trước" })
        .click();
      await expect(pages[1]!.locator(".board-cell")).toHaveCount(40);
      await expect(pages[1]!.locator(".activity-panel ol")).toHaveText(
        await pages[0]!.locator(".activity-panel ol").textContent(),
      );
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
