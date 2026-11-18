import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
const url = "http://127.0.0.1:5174";
async function saved(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("nha-choi", 1);
        request.onsuccess = () => {
          const db = request.result;
          const query = db
            .transaction("offline", "readonly")
            .objectStore("offline")
            .get("current");
          query.onsuccess = () => {
            resolve(query.result);
            db.close();
          };
          query.onerror = () => reject(query.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}
test("production_PWA_installs_all_photos_and_opens_a_game_after_offline_reload", async ({
  page,
  context,
}) => {
  await page.goto(url);
  await expect(
    page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false }),
  ).toBeVisible();
  const manifest = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifest).toBeTruthy();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill("Offline PWA");
  await page.getByRole("button", { name: "Bắt đầu ván", exact: true }).click();
  await expect(page.locator(".board-cell")).toHaveCount(40);
  const files = readdirSync("apps/web/public/locations").filter((file) =>
    file.endsWith(".jpg"),
  );
  const decoded = await page.evaluate(
    async (filenames) =>
      Promise.all(
        filenames.map(
          (file) =>
            new Promise<boolean>((resolve) => {
              const image = new Image();
              image.onload = () => resolve(image.naturalWidth > 0);
              image.onerror = () => resolve(false);
              image.src = `/locations/${file}`;
            }),
        ),
      ),
    files,
  );
  expect(decoded).toHaveLength(26);
  expect(decoded.every(Boolean)).toBe(true);
  await page.getByRole("button", { name: /^Gieo/ }).click();
  await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
});
test("update_waits_until_the_game_is_saved_and_does_not_force_reload_when_declined", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto(url);
  await expect(
    page.getByText("Đã sẵn sàng chơi với máy khi offline.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
  await page.getByRole("textbox", { name: "Tên của bạn" }).fill("Giữ ván");
  await page.getByRole("button", { name: "Bắt đầu ván", exact: true }).click();
  await page.locator(".board").waitFor();
  await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
  execFileSync("npm", ["run", "build:web"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await expect(
    page.getByText("Rời và lưu ván trước khi cập nhật.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cập nhật ngay" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Rời bàn chơi" }).click();
  await page.getByRole("button", { name: "Lưu và rời ván" }).click();
  const before = await saved(page);
  await page.getByRole("button", { name: "Để sau", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tiếp tục ván", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Cập nhật ngay" }).waitFor();
  const navigation = page.waitForEvent(
    "framenavigated",
    (frame) => frame === page.mainFrame(),
  );
  await page.getByRole("button", { name: "Cập nhật ngay" }).click();
  await navigation;
  await page
    .getByRole("button", { name: "Tiếp tục ván", exact: true })
    .waitFor();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Tiếp tục ván", exact: true }).click();
  await expect(page.locator(".board-cell")).toHaveCount(40);
});
