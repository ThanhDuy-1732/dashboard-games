import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const game = (page: Page) => page.getByRole("region", { name: "Thằn Lằn Núi Lửa" });
const play = (page: Page) => page.getByRole("button", { name: "Chơi", exact: true });
const score = (page: Page) => game(page).locator(".dino-score strong");

async function openGame(page: Page) {
  await page.getByRole("button", { name: "Chơi Thằn Lằn Núi Lửa" }).click();
}

async function keyAtDistance(page: Page, meters: number, code: string) {
  await score(page).evaluate((meter, input) => {
    const press = () => {
      if (Number.parseInt(meter.textContent ?? "", 10) < input.meters) return;
      meter.dispatchEvent(new KeyboardEvent("keydown", { code: input.code, bubbles: true }));
      watch.disconnect();
    };
    const watch = new MutationObserver(press);
    watch.observe(meter, { childList: true, characterData: true, subtree: true });
    press();
  }, { meters, code });
}

test("a held jump and a camera switch share one desktop run", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The 3D suite uses the Chromium WebGL test runner.");
  await page.goto("/");
  await openGame(page);
  await play(page).click();
  await page.keyboard.press("ArrowLeft");
  await expect(game(page)).toHaveAttribute("data-view", "third");

  await game(page).evaluate((stage) => {
    const watch = new MutationObserver(() => {
      if (stage.getAttribute("data-airborne") !== "true") return;
      if (stage.getAttribute("data-view") === "first") {
        stage.setAttribute("data-test-switched-in-air", "true");
        watch.disconnect();
      } else {
        stage.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV", bubbles: true }));
      }
    });
    watch.observe(stage, { attributes: true, attributeFilter: ["data-airborne", "data-view"] });
  });
  await page.keyboard.down("Space");
  await expect(game(page)).toHaveAttribute("data-view", "first");
  await expect(game(page)).toHaveAttribute("data-test-switched-in-air", "true");
  const afterSwitch = await score(page).innerText();
  await expect(score(page)).not.toHaveText(afterSwitch);
  await expect(game(page)).toHaveAttribute("data-airborne", "false");
  const airborneAgain = await game(page).evaluate((stage) => {
    let jumped = false;
    const watch = new MutationObserver(() => {
      if (stage.getAttribute("data-airborne") === "true") jumped = true;
    });
    watch.observe(stage, { attributes: true, attributeFilter: ["data-airborne"] });
    stage.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, repeat: true }));
    return new Promise<boolean>((resolve) => {
      window.setTimeout(() => { watch.disconnect(); resolve(jumped); }, 250);
    });
  });
  expect(airborneAgain).toBe(false);
  await page.keyboard.up("Space");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  const paused = await score(page).innerText();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  await expect(score(page)).toHaveText(paused);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(score(page)).not.toHaveText(paused);
  await page.getByRole("button", { name: "Tạm dừng" }).click();
  await page.getByRole("button", { name: "Về Nhà Chơi" }).click();
  await expect(page.getByRole("button", { name: "Chơi Thằn Lằn Núi Lửa" })).toBeVisible();
});

test("jump and camera controls work on a touch viewport", async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "The 3D suite uses the Chromium WebGL test runner.");
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await openGame(page);
    await play(page).tap();
    const fire = page.getByRole("button", { name: "Phun lửa" });
    await expect(fire).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Nhảy", exact: true }).tap();
    await expect(game(page)).toHaveAttribute("data-airborne", "true");
    await page.getByRole("button", { name: "Đổi góc nhìn" }).tap();
    await expect(game(page)).toHaveAttribute("data-view", "first");
    await page.getByRole("button", { name: "Sang phải" }).tap();
    await expect(game(page)).toHaveAttribute("data-lane", "1");
    await page.getByRole("button", { name: "Sang trái" }).tap();
    await expect(game(page)).toHaveAttribute("data-lane", "0");
    await expect(fire).toHaveAttribute("aria-disabled", "false");
    await fire.tap();
    await expect(fire).toHaveAttribute("aria-disabled", "true");
  } finally {
    await context.close();
  }
});

test("offline fire needs a pickup and armor absorbs one collision", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "The 3D suite uses the Chromium WebGL test runner.");
  await page.goto("/");
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await openGame(page);
  await play(page).click();
  const fire = page.getByRole("button", { name: "Phun lửa" });
  await expect(fire).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("f");
  await page.keyboard.press("v");
  await expect(game(page)).toHaveAttribute("data-view", "first");
  await keyAtDistance(page, 18, "KeyF");
  await keyAtDistance(page, 46, "Space");
  await expect(fire).toHaveAttribute("aria-disabled", "false");
  await expect(fire).toHaveAttribute("aria-disabled", "true");
  await expect.poll(async () => Number.parseInt(await score(page).innerText(), 10)).toBeGreaterThan(25);
  await expect(game(page)).toHaveAttribute("data-armor", "ready");
  await game(page).evaluate((stage) => {
    const watch = new MutationObserver(() => {
      if (stage.getAttribute("data-armor") !== "absorbed") return;
      stage.setAttribute("data-test-armor-absorbed", "true");
      watch.disconnect();
    });
    watch.observe(stage, { attributes: true, attributeFilter: ["data-armor"] });
  });
  await expect(game(page)).toHaveAttribute("data-test-armor-absorbed", "true", { timeout: 12000 });
  await expect(game(page).getByRole("heading", { name: "Kết thúc lượt" })).toBeVisible();
  await expect(game(page).getByText("98 m", { exact: true })).toHaveCount(2);
});

test("changing lanes offline collects a speed boost that stays active across camera views", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "The 3D suite uses the Chromium WebGL test runner.");
  await page.goto("/");
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await openGame(page);
  await play(page).click();
  await page.keyboard.press("ArrowLeft");
  await keyAtDistance(page, 46, "Space");
  await expect(game(page)).toHaveAttribute("data-lane", "-1");
  const power = game(page).getByText("Tăng tốc", { exact: true });
  await expect(power).toBeVisible({ timeout: 12000 });
  await page.keyboard.press("v");
  await expect(game(page)).toHaveAttribute("data-view", "first");
  await expect(power).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  const timer = game(page).locator(".dino-effect span").last();
  const remaining = await timer.innerText();
  await page.waitForTimeout(1100);
  await expect(timer).toHaveText(remaining);
});

test("the first visit to the 3D game and a replay work offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Production service-worker offline run.");
  await page.goto("/");
  await expect(page.getByText("Đã sẵn sàng chơi với máy khi offline.")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await openGame(page);
  await play(page).click();
  await expect(game(page)).toHaveAttribute("data-phase", "running");
  await page.keyboard.press("v");
  await expect(game(page)).toHaveAttribute("data-view", "first");
  await expect(page.getByRole("heading", { name: "Kết thúc lượt" })).toBeVisible({ timeout: 15_000 });
  await expect(game(page).getByText("24 m", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Chơi lại" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "running");
  await expect(game(page)).toHaveAttribute("data-view", "first");
  await page.reload();
  await openGame(page);
  await play(page).click();
  await expect(game(page).getByText("Kỷ lục 24 m")).toBeVisible();
});

test("gives a way back when WebGL 2 is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (String(args[0]) === "webgl2") return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await openGame(page);
  await expect(game(page).getByRole("heading", { name: "Không mở được cảnh 3D" })).toBeVisible();
  await page.getByRole("button", { name: "Về Nhà Chơi" }).click();
  await expect(page.getByRole("button", { name: "Chơi Thằn Lằn Núi Lửa" })).toBeVisible();
});
