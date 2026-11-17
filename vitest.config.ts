import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({resolve:{alias:{"@nha-choi/game-core":fileURLToPath(new URL("./packages/game-core/src/index.ts",import.meta.url)),"@nha-choi/protocol":fileURLToPath(new URL("./packages/protocol/src/index.ts",import.meta.url))}},test:{include:["packages/**/test/**/*.test.ts","apps/**/test/**/*.test.{ts,tsx}"]}});
