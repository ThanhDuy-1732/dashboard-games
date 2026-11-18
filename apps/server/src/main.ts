import { NeonRoomStore, RoomStoreError } from "./database.js";
import { createGameServer } from "./server.js";
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  console.error(
    "Cần cấu hình DATABASE_URL cho backend production; không dùng bộ nhớ tạm.",
  );
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be 1–65535");
const origins = (
  process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
let app: Awaited<ReturnType<typeof createGameServer>>;
try {
  app = await createGameServer({
    port,
    host: process.env.HOST ?? "127.0.0.1",
    origins,
    store: process.env.DATABASE_URL
      ? new NeonRoomStore(process.env.DATABASE_URL)
      : undefined,
  });
} catch (error) {
  console.error(
    error instanceof RoomStoreError
      ? `Không mở được dữ liệu online: ${error.code}`
      : "Không khởi động được backend. Kiểm tra kết nối database, SSL và cấu hình cổng.",
  );
  process.exit(1);
}
console.info(`Nhà Chơi server: ${app.url}`);
console.info(
  process.env.DATABASE_URL
    ? "Đã bật lưu ván online bằng PostgreSQL."
    : "Chế độ phát triển: ván online chỉ lưu tạm trong bộ nhớ.",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app
      .close()
      .then(() => process.exit(0))
      .catch(() => {
        console.error(
          "Backend đã dừng; chưa xác nhận đóng kết nối database. Các lượt đã xác nhận vẫn được giữ.",
        );
        process.exit(1);
      });
  });
