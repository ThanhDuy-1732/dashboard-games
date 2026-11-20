import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TOKEN_NAMES } from "../src/components/TokenArt.js";
import type { Token } from "@nha-choi/game-core";
async function setup(page: Page, name: string, token: Token, code?: string) {
  await page.goto(code ? `/?room=${code}` : "/");
  const onlineConnection = page.waitForEvent("websocket", {
    predicate: (socket) => socket.url().includes("/socket.io/"),
    timeout: 5000,
  });
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("button", { name: /^Chơi online/ }).click();
  await expectNoHorizontalOverflow(page);
  await onlineConnection;
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill(name);
  await page
    .getByRole("button", {
      name: `Chọn quân ${TOKEN_NAMES[token]}`,
      exact: true,
    })
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
      if (count === 6)
        await pages[0]!.setViewportSize({ width: 375, height: 812 });
      else await pages[1]!.setViewportSize({ width: 320, height: 800 });
      const tokens = ["rocket", "bike", "hat", "ship", "dog", "plane"] as const;
      await setup(pages[0]!, "Chủ phòng", tokens[0]!);
      const code = (
        await pages[0]!.getByTestId("room-code").textContent()
      ).trim();
      await Promise.all(
        pages
          .slice(1)
          .map((page, index) =>
            setup(
              page,
              count === 2 ? "W".repeat(20) : `Bạn ${index + 1}`,
              tokens[index + 1]!,
              code,
            ),
          ),
      );
      if (count === 2) await expectNoHorizontalOverflow(pages[1]!);
      for (const page of pages) {
        await page
          .getByRole("button", { name: "Sẵn sàng", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Hủy sẵn sàng", exact: true }),
        ).toBeEnabled();
      }
      await pages[0]!
        .getByRole("button", { name: "Bắt đầu ván", exact: true })
        .click();
      for (const page of pages) {
        await expect(page.locator(".board-cell")).toHaveCount(40);
        await expectNoHorizontalOverflow(page);
        const corner = (await page
          .locator(".board-cell")
          .nth(0)
          .boundingBox())!;
        const edge = (await page.locator(".board-cell").nth(1).boundingBox())!;
        expect(corner.width).toBeGreaterThan(edge.width * 1.5);
        const pawns = page.locator(".cell-pawns");
        await expect(pawns).toHaveCount(1);
        await expect(pawns.locator(".board-pawn")).toHaveCount(count);
        const ownPawn = pawns.locator(".own-pawn");
        await expect(ownPawn).toHaveCount(1);
        expect((await ownPawn.boundingBox())!.width).toBeGreaterThanOrEqual(20);
        await expect(ownPawn.locator("img")).toHaveJSProperty(
          "naturalWidth",
          96,
        );
      }
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
      for (const page of pages) {
        await expect(page.locator(".dice-rolling")).toHaveCount(1);
        await expect(page.locator(".dice-rolling")).toHaveAttribute(
          "aria-label",
          /^Xúc xắc [1-6] và [1-6]$/,
        );
      }
      if (count === 2) {
        await expect(actor.locator(".die-face")).toHaveCount(12);
        const timings = await actor
          .locator(".own-pawn")
          .evaluate((pawn) =>
            pawn
              .getAnimations()
              .map((animation) => animation.effect?.getTiming()),
          );
        expect(timings).toContainEqual(
          expect.objectContaining({ delay: 820, fill: "backwards" }),
        );
        await expect
          .poll(() =>
            actor.locator(".die-cube").evaluateAll((cubes) =>
              cubes.every((cube) => {
                const face = cube.querySelector(
                  `[data-face="${cube.getAttribute("data-result")}"]`,
                )!;
                const cubeMatrix = new DOMMatrix(
                  getComputedStyle(cube).transform,
                );
                const faceMatrix = new DOMMatrix(
                  getComputedStyle(face).transform,
                );
                return (
                  cube
                    .getAnimations()
                    .every((animation) => animation.playState === "finished") &&
                  cubeMatrix.multiply(faceMatrix).m33 > 0.8
                );
              }),
            ),
          )
          .toBe(true);
      }
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

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}
