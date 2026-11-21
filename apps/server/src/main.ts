import { adminConfigIssue } from "./admin.js";
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
const telemetryPeerLimit = Number(process.env.TELEMETRY_PEER_LIMIT ?? 30);
if (!Number.isInteger(telemetryPeerLimit) || telemetryPeerLimit < 1 || telemetryPeerLimit > 1000)
  throw new Error("TELEMETRY_PEER_LIMIT must be 1–1000");
const origins = (
  process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
const adminOrigin = process.env.ADMIN_ORIGIN?.trim();
const admin = {
  origin: adminOrigin ?? "",
  passwordHash: adminPasswordHash ?? "",
  secure: process.env.NODE_ENV === "production" || Boolean(adminOrigin?.startsWith("https://")),
};
const adminIssue = adminConfigIssue(admin);
if (adminIssue)
  console.info(`Admin chưa bật: ${adminIssue} thiếu hoặc sai định dạng.`);
let app: Awaited<ReturnType<typeof createGameServer>>;
try {
  const store = process.env.DATABASE_URL
    ? new NeonRoomStore(process.env.DATABASE_URL)
    : undefined;
  app = await createGameServer({
    port,
    host: process.env.HOST ?? "127.0.0.1",
    origins,
    store,
    metrics: store,
    telemetryPeerLimit,
    revision: process.env.RENDER_GIT_COMMIT,
    admin: adminIssue ? undefined : admin,
  });
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  const safeCode = typeof code === "string" &&
    /^(?:[0-9A-Z]{5}|ENOENT|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EADDRINUSE|EACCES|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|ERR_TLS_CERT_ALTNAME_INVALID)$/.test(code)
    ? ` [${code}]` : "";
  console.error(
    error instanceof RoomStoreError
      ? `Không mở được dữ liệu online: ${error.code}`
      : "Không khởi động được backend. Kiểm tra kết nối database, SSL và cấu hình cổng." + safeCode,
  );
  process.exit(1);
}
console.info(`Nhà Chơi server: ${app.url}`);
if (!adminIssue) console.info("Admin đã bật.");
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
