import { scryptSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
const testSalt = "00000000000000000000000000000000";
export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "npm run preview --workspace @nha-choi/web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
    {
      command: "npm run preview --workspace @nha-choi/web -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
    },
    {
      command: "npm run start --workspace @nha-choi/server",
      env: {
        DATABASE_URL: "", NODE_ENV: "test", ADMIN_ORIGIN: "http://127.0.0.1:5173",
        ADMIN_PASSWORD_HASH: testSalt + ":" + scryptSync("fixture-only", testSalt, 64).toString("hex"),
      },
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: false,
    },
  ],
});
