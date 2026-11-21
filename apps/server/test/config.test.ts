import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
it("refuses_silent_in_memory_mode_in_production_without_database_credentials", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("../src/main.ts", import.meta.url)),
    ],
    {
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "" },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("DATABASE_URL");
});

it("reports the public deployment revision without changing the health response", async () => {
  const { createGameServer } = await import("../src/server.js");
  const revision = "a".repeat(40);
  const app = await createGameServer({ port: 0, revision });
  try {
    const response = await fetch(app.url + "/health");
    expect(response.headers.get("X-App-Revision")).toBe(revision);
    expect(await response.json()).toEqual({ ok: true });
  } finally {
    await app.close();
  }
});
