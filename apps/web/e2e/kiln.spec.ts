import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const kiln = (page: Page) => page.getByRole("region", { name: "Lò Gốm" });
const cell = (page: Page, index: number) => kiln(page).locator(`[data-kiln-cell="${index}"]`);
const piece = (page: Page, name: string) => kiln(page).getByRole("button", { name, exact: true });
const score = (page: Page) => kiln(page).locator("[data-kiln-score]");
const turns = (page: Page) => kiln(page).locator("[data-kiln-left]");

async function enter(page: Page) {
  await page.getByRole("button", { name: "Chơi Lò Gốm", exact: true }).click();
  await expect(kiln(page)).toBeVisible();
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Không thấy mảnh hoặc ô của bàn chơi.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: Locator, to: Locator, preview?: { cleared: number; pots: number }) {
  await from.scrollIntoViewIfNeeded();
  await to.scrollIntoViewIfNeeded();
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  if (preview) {
    await expect(kiln(page).locator(".kiln-clear")).toHaveCount(preview.cleared);
    await expect(kiln(page).locator(".kiln-pickup")).toHaveCount(preview.pots);
  }
  await page.mouse.up();
}

async function scan(page: Page) {
  const result = await new AxeBuilder({ page }).include(".kiln-screen").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(violation => ({
    id: violation.id,
    nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  }))).toEqual([]);
}

test("drags pieces, previews harvests and wins all three levels across an offline reload", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await enter(page);
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false })).toBeVisible();
  await scan(page);
  await kiln(page).screenshot({ path: testInfo.outputPath("kiln-desktop.png") });

  await drag(page, piece(page, "Hai ô ngang"), piece(page, "Ba ô ngang"));
  await expect(turns(page)).toHaveText("12");
  await expect(kiln(page).locator(".kiln-clear")).toHaveCount(0);
  await drag(page, piece(page, "Hai ô ngang"), cell(page, 14), { cleared: 8, pots: 1 });
  await expect(score(page)).toHaveText("62");
  await expect(turns(page)).toHaveText("11");
  await drag(page, piece(page, "Ba ô chữ L"), cell(page, 24));
  await drag(page, piece(page, "Ba ô ngang"), cell(page, 43));
  await expect(score(page)).toHaveText("188");
  await expect(kiln(page).getByRole("status")).toHaveText("Mẻ gốm thành công!");
  await scan(page);
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await enter(page);
  await expect(score(page)).toHaveText("188");

  await piece(page, "Màn tiếp theo").click();
  await expect(kiln(page).getByRole("heading", { name: "Đợi đúng lửa" })).toBeVisible();
  await piece(page, "Một ô").click();
  await cell(page, 1).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, 0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(score(page)).toHaveText("1");
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await enter(page);
  await expect(score(page)).toHaveText("1");
  await cell(page, 30).click();
  await expect(score(page)).toHaveText("63");
  await piece(page, "Màn tiếp theo").click();
  await expect(kiln(page).getByRole("heading", { name: "Hai bình một mẻ" })).toBeVisible();
  await cell(page, 0).click();
  await drag(page, piece(page, "Một ô"), cell(page, 27), { cleared: 15, pots: 2 });
  await expect(score(page)).toHaveText("148");
  await expect(kiln(page).getByRole("status")).toHaveText("Mẻ gốm thành công!");
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("supports touch at 320px and 375px and cancels a gesture cleanly", async ({ page, context, browserName }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await enter(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    const domino = piece(page, "Hai ô ngang");
    const lift = kiln(page).locator(".kiln-lift");
    if (browserName === "chromium") {
      const cdp = await context.newCDPSession(page);
      await domino.scrollIntoViewIfNeeded();
      const start = await center(domino);
      const end = await center(cell(page, 14));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] });
      await expect(lift).toHaveAttribute("data-drop", "fit");
      const liftedFirstTile = await center(lift.locator(".kiln-mini").first());
      expect(liftedFirstTile.y).toBeLessThan(end.y - 8);
      await expect(kiln(page).locator(".kiln-clear")).toHaveCount(8);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await expect(kiln(page).locator(".kiln-clear")).toHaveCount(0);
      await expect(lift).toHaveCount(0);
      await expect(turns(page)).toHaveText("12");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] });
      await expect(lift).toHaveAttribute("data-drop", "fit");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(lift).toHaveCount(0);
    } else {
      await domino.tap();
      await cell(page, 14).tap();
    }
    await expect(turns(page)).toHaveText("11");
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await piece(page, "Ba ô chữ L").tap();
    await cell(page, 24).tap();
    await expect(turns(page)).toHaveText("10");
    await scan(page);
    await kiln(page).screenshot({ path: testInfo.outputPath("kiln-mobile.png") });
  });
});

test("requires an explicit reload when a second tab changes the save", async ({ page, context }) => {
  await page.goto("/");
  await enter(page);
  const other = await context.newPage();
  await other.goto("/");
  await enter(other);
  await cell(page, 14).click();
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await cell(other, 0).click();
  await expect(kiln(other).getByRole("alert")).toHaveText(/Bản lưu đã thay đổi/);
  await expect(score(other)).toHaveText("2");
  await piece(other, "Tải bản lưu mới").click();
  await expect(score(other)).toHaveText("62");
  await expect(kiln(other).getByRole("alert")).toHaveCount(0);
});

test("shows ceramic shards after a clear and persists the selected board size", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await enter(page);
  await piece(page, "10 × 10").click();
  const board = kiln(page).getByRole("group", { name: "Bàn xếp khối 10 × 10" });
  await expect(board.getByRole("button")).toHaveCount(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await board.evaluate(element => {
    element.addEventListener("animationstart", event => {
      const animation = (event as AnimationEvent).animationName;
      if (animation === "kiln-shard-flight") element.setAttribute("data-verified-shards", "");
    });
  });
  await cell(page, 18).click();
  await expect(board).toHaveAttribute("data-verified-shards", "");
  await expect(board.locator(".kiln-burst")).toHaveCount(0);
  await expect(score(page)).toHaveText("62");
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await enter(page);
  await expect(board).toBeVisible();
  await expect(piece(page, "10 × 10")).toHaveAttribute("aria-pressed", "true");
  await expect(score(page)).toHaveText("62");
  await expect(board.locator(".kiln-burst")).toHaveCount(0);
  await scan(page);
});

test("uses a brief stationary highlight with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await enter(page);
  const board = kiln(page).getByRole("group", { name: "Bàn xếp khối 8 × 8" });
  await board.evaluate(element => {
    element.addEventListener("animationstart", event => {
      if ((event as AnimationEvent).animationName !== "kiln-burst-fade") return;
      const shard = (event.target as Element).querySelector(".kiln-shard")!;
      element.setAttribute("data-verified-highlight", getComputedStyle(shard).display);
    });
  });
  await cell(page, 14).click();
  await expect(board).toHaveAttribute("data-verified-highlight", "none");
  await expect(board.locator(".kiln-burst")).toHaveCount(0);
});

test("shows a moving piece, distinguishes blocked drops and marks the landed cells", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await enter(page);
  const domino = piece(page, "Hai ô ngang");
  const blocked = cell(page, 8);
  const target = cell(page, 0);
  await target.evaluate(element => {
    element.addEventListener("animationstart", event => {
      if ((event as AnimationEvent).animationName === "kiln-landing") element.setAttribute("data-verified-landing", "");
    });
  });
  await domino.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const start = await center(domino);
  const invalid = await center(blocked);
  const valid = await center(target);
  const lift = kiln(page).locator(".kiln-lift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 15);
  await expect(lift).toBeVisible({ timeout: 800 });
  const moving = await lift.boundingBox();
  await page.mouse.move(invalid.x, invalid.y, { steps: 5 });
  await expect(lift).toHaveAttribute("data-drop", "blocked");
  await expect(blocked).toHaveClass(/kiln-blocked-target/);
  expect((await lift.boundingBox())?.y).not.toBe(moving?.y);
  await page.mouse.move(valid.x, valid.y, { steps: 4 });
  await expect(lift).toHaveAttribute("data-drop", "fit");
  await expect(kiln(page).locator(".kiln-ghost")).toHaveCount(2);
  await expect(target).toHaveClass(/kiln-anchor/);
  await page.mouse.up();
  await expect(lift).toHaveCount(0);
  await expect(target).toHaveAttribute("data-verified-landing", "");
  await expect(target.locator(".kiln-landed")).toHaveCount(0);
  await expect(turns(page)).toHaveText("11");
});

test("plays endless offline and resumes each mode at its own size and score", async ({ page, context }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false })).toBeVisible();
  await cell(page, 14).click();
  await expect(score(page)).toHaveText("62");
  await piece(page, "Vô tận").click();
  await expect(kiln(page).getByRole("heading", { name: "Vô tận" })).toBeVisible();
  await expect(kiln(page).getByText("Lượt đã chơi", { exact: true })).toBeVisible();
  await expect(turns(page)).toHaveCount(0);
  await piece(page, "10 × 10").click();
  await cell(page, 0).click();
  await expect(score(page)).toHaveText("4");
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await enter(page);
  await expect(kiln(page).getByRole("heading", { name: "Vô tận" })).toBeVisible();
  await expect(piece(page, "10 × 10")).toHaveAttribute("aria-pressed", "true");
  await expect(score(page)).toHaveText("4");
  await piece(page, "Màn 1: Mẻ đầu tay").click();
  await expect(piece(page, "8 × 8")).toHaveAttribute("aria-pressed", "true");
  await expect(score(page)).toHaveText("62");
  await expect(turns(page)).toHaveText("11");
});

test("previews an order bonus, celebrates the harvest and saves the next order", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("nha-choi-kiln-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("saves", "readwrite");
      const board = Array.from({ length: 64 }, (_, index) =>
        index < 7 ? { glaze: "clay", placedAt: index === 3 ? 7 : null } : null);
      tx.objectStore("saves").put({
        revision: 1,
        save: {
          version: 1, unlocked: 1, active: { level: 1, moves: [] }, mode: "endless",
          endless: { size: 8, board, turn: 8, score: 120, collected: 1, used: [0, 1],
            order: { kind: "pots", progress: 1, remaining: 1 },
          },
        },
      }, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await enter(page);
  const contract = kiln(page).getByRole("region", { name: "Đơn hàng hiện tại" });
  await expect(contract.getByRole("heading")).toHaveText("Hai bình đúng hẹn");
  await expect(contract).toContainText("Còn 1 lượt");

  await cell(page, 7).hover();
  await expect(kiln(page).locator(".kiln-contract-preview")).toHaveText("Lấy 1 bình · Hoàn thành đơn +60");
  await cell(page, 7).click();
  await expect(kiln(page).locator(".kiln-result")).toContainText("Hoàn thành đơn");
  await expect(kiln(page).locator(".kiln-harvest")).toHaveCount(1);
  await expect(score(page)).toHaveText("241");
  await expect(kiln(page).getByRole("status")).toHaveText("Hoàn thành Hai bình đúng hẹn. Thưởng +60 điểm.");
  await expect(contract.getByRole("heading")).toHaveText("Mẻ kép");
  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await enter(page);
  await expect(contract.getByRole("heading")).toHaveText("Mẻ kép");
  await expect(contract).toContainText("Còn 10 lượt");
  await expect(score(page)).toHaveText("241");
  await scan(page);
});

test("opens locks by their own conditions and resumes the same layout offline", async ({ page, context }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false })).toBeVisible();
  await page.evaluate(() => { Math.random = () => 0; });
  await piece(page, "Lò Khóa").click();
  await expect(kiln(page).getByRole("heading", { name: "Lò Khóa" })).toBeVisible();
  await expect(kiln(page).getByText("Bàn 8 × 8", { exact: true })).toBeVisible();
  const locked = kiln(page).locator("[data-kiln-lock]");
  await expect(locked).toHaveCount(5);
  await expect(cell(page, 9)).toHaveAccessibleName(/còn 4 lượt đặt/);
  await expect(cell(page, 10)).toHaveAccessibleName(/còn 1 hàng hoặc cột/);
  await cell(page, 9).click();
  await expect(cell(page, 9)).toHaveAccessibleName(/còn 4 lượt đặt/);
  await expect(score(page)).toHaveText("0");

  for (const index of [0, 2, 5]) await cell(page, index).click();
  await expect(locked).toHaveCount(4);
  await expect(cell(page, 9)).toHaveAccessibleName(/còn 1 lượt đặt/);
  await expect(cell(page, 10)).toHaveAccessibleName(/ô trống/);
  await expect(kiln(page).locator(".kiln-result")).toContainText("Mở 1 ô khóa");
  await expect(kiln(page).locator(".kiln-unlock")).toHaveCount(1);

  await expect(kiln(page).getByText("Đang lưu…")).toBeHidden();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await enter(page);
  await expect(kiln(page).getByRole("heading", { name: "Lò Khóa" })).toBeVisible();
  await expect(locked).toHaveCount(4);
  await expect(cell(page, 9)).toHaveAccessibleName(/còn 1 lượt đặt/);
  await expect(cell(page, 10)).toHaveAccessibleName(/ô trống/);
  await cell(page, 16).click();
  await expect(score(page)).toHaveText("22");
  await expect(locked).toHaveCount(0);
  await expect(kiln(page).getByText("Đã mở tất cả ô")).toBeVisible();
  await piece(page, "Vô tận").click();
  await expect(score(page)).toHaveText("0");
  await piece(page, "Lò Khóa").click();
  await expect(score(page)).toHaveText("22");
});
