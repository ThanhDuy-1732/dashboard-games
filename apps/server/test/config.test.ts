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
