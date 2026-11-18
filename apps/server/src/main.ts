import { createGameServer } from "./server.js";
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be 1–65535");
const origins = (
  process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const app = await createGameServer({
  port,
  host: process.env.HOST ?? "127.0.0.1",
  origins,
});
console.info(`Nhà Chơi server: ${app.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
