import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { chromium, expect } from "@playwright/test";
const adb = join(
  process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk"),
  "platform-tools/adb",
);
const args = process.env.ANDROID_SERIAL
  ? ["-s", process.env.ANDROID_SERIAL]
  : [];
const run = (...values) =>
  execFileSync(adb, [...args, ...values], { encoding: "utf8" }).trim();
const app = "dev.nhachoi.app";
let port, browser;
async function attach() {
  const pid = run("shell", "pidof", app);
  port = run(
    "forward",
    "tcp:0",
    `localabstract:webview_devtools_remote_${pid}`,
  );
  await expect
    .poll(async () =>
      fetch(`http://127.0.0.1:${port}/json/version`)
        .then((r) => r.ok)
        .catch(() => false),
    )
    .toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
    noDefaults: true,
  });
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(15000);
  return page;
}
async function detach() {
  await browser?.close();
  browser = undefined;
  if (port) run("forward", "--remove", `tcp:${port}`);
  port = undefined;
}
async function saved(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("nha-choi", 1);
        request.onsuccess = () => {
          const db = request.result,
            q = db
              .transaction("offline", "readonly")
              .objectStore("offline")
              .get("current");
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}
try {
  run("install", "-r", "android/app/build/outputs/apk/debug/app-debug.apk");
  run("shell", "am", "force-stop", app);
  run("shell", "am", "start", "-W", "-n", `${app}/.MainActivity`);
  let page = await attach();
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Chơi Cờ tỷ phú" }),
  ).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Tiếp tục ván", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Tiếp tục ván", exact: true })
      .click();
  else {
    await page.getByRole("button", { name: "Chơi Cờ tỷ phú" }).click();
    await page
      .getByRole("textbox", { name: "Tên của bạn" })
      .fill("Thử Android");
    await page.getByRole("spinbutton", { name: "Số đối thủ máy" }).fill("1");
    await page
      .getByRole("button", { name: "Bắt đầu ván", exact: true })
      .click();
  }
  await expect(page.locator(".board-cell")).toHaveCount(40);
  const roll = page.getByRole("button", { name: /^Gieo/ });
  if (await roll.count()) await roll.click();
  await expect(page.locator(".save-indicator")).toHaveText("Đã lưu");
  const local = await page.evaluate(async () => {
    const images = [...document.querySelectorAll(".location-thumbnail")];
    return {
      photos: images.length,
      decoded: images.every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
      workers:
        "serviceWorker" in navigator
          ? (await navigator.serviceWorker.getRegistrations()).length
          : 0,
    };
  });
  expect(local).toEqual({ photos: 26, decoded: true, workers: 0 });
  await page.getByRole("button", { name: "Rời bàn chơi" }).click();
  await page.getByRole("button", { name: "Lưu và rời ván" }).click();
  const before = await saved(page);
  await detach();
  run("shell", "am", "force-stop", app);
  run("shell", "am", "start", "-W", "-n", `${app}/.MainActivity`);
  page = await attach();
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tiếp tục ván", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Tiếp tục ván", exact: true }).click();
  await expect(page.locator(".board-cell")).toHaveCount(40);
  await page.screenshot({
    path: resolve("../../docs/previews/android-game.png"),
    fullPage: true,
  });
  console.log(
    "PASS Android native: offline reload, 26 photos, no SW, save + cold start",
  );
} finally {
  await detach();
}
