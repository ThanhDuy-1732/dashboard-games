# Nhà Chơi

**Lò Gốm** có ba màn xếp khối và chế độ **Vô tận**, với bàn 8 × 8, 9 × 9 hoặc 10 × 10. Trong Vô tận, hoàn thành các đơn hàng luân phiên để nhận điểm thưởng. Chế độ này chơi đến khi hết chỗ đặt và lưu ván riêng với ba màn. Chọn **Chơi Lò Gốm** ở trang Khám phá để bắt đầu hoặc tiếp tục. Bản PWA chơi offline sau khi đã tải đủ dữ liệu lần đầu.

Dashboard game với Cờ tỷ phú truyền thống, web/PWA trước rồi Android/iOS dùng chung lõi luật và giao diện.

Web/PWA đã đạt WEB-PASS (A1–A10): luật truyền thống đầy đủ, offline với 1–5 máy, tự lưu/tiếp tục, phòng online 2–6 người và cài PWA. Android/iOS đã dựng và chạy thử trên giả lập (B1), có lưu/tiếp tục, xử lý Back và chuyển nền. Bluetooth và chơi online mobile qua HTTPS chưa nghiệm thu.

Triển khai theo `docs/superpowers/plans/2026-11-17-game-hub-implementation.md`. `design/` là bản mẫu tương tác, không phải game hoàn chỉnh. Workspace sản phẩm ở `apps/` và `packages/`.

## Phát triển

Node 24, npm workspaces. Sau khi checkout: `npm ci`.

- `npm run dev:web`: giao diện web ở cổng 5173.
- `npm run dev:server`: backend online ở cổng 3001.
- `npm test`: kiểm thử core/protocol và các phần đã hoàn thành.
- `npm run typecheck`, `npm run lint`, `npm run build`: kiểm tra và build các workspace.

Bộ luật: `docs/rules/classic-v1.md`. Các phase chưa hoàn thành không được coi là tính năng đã hoạt động.

Hướng dẫn chạy, cấu hình và giới hạn: [web runbook](docs/runbooks/web.md). Bằng chứng nghiệm thu: [WEB-PASS](docs/runbooks/web-verification.md). Runtime audit không báo lỗ hổng; full audit còn cảnh báo ở công cụ phát triển, ghi cụ thể trong runbook.

## Mobile và trạng thái phase

- A1–A10: WEB-PASS, web/PWA online 2–6 người và offline với máy.
- B1: Android/iOS đã build và kiểm tra trên giả lập. Xem [hướng dẫn mobile](apps/mobile/README.md).
- B2: codec frame đã có kiểm tra; chưa tích hợp/kiểm chứng radio vì người dùng chưa có thiết bị thật.
- B3: chưa bắt đầu, chờ gate Bluetooth.
- B4: xử lý vòng đời native và Back đã có, kiểm tra giả lập; chơi chéo mobile–web chờ máy chủ HTTPS, chưa có kiểm tra Bluetooth nền.
- B5: chưa MOBILE-PASS, chưa ký/phát hành Store.

Build: `npm run build:mobile`, `npm run build:android`, `npm run build:ios`. APK debug ở `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`; iOS simulator app ở `apps/mobile/build/ios/Build/Products/Debug-iphonesimulator/App.app`.

[Bằng chứng và phần chưa kiểm tra](mobile-evidence/release-checks.md), [gate Bluetooth](mobile-evidence/bluetooth-spike.md), [các quyết định khi triển khai](docs/runbooks/implementation-decisions.md).

## Lưu online với Neon

Đã thêm lưu bền phòng/trạng thái online, proof dạng hash và phản hồi lệnh để khôi phục sau khi backend restart. Đặt DATABASE_URL ở backend hoặc root .env (không commit). Khi NODE_ENV=production, thiếu DATABASE_URL sẽ dừng. Backend chỉ chạy một instance; frontend vẫn deploy Vercel riêng.

[Hướng dẫn Neon](docs/runbooks/neon.md). `npm run test:database` chạy kiểm tra tích hợp thật bằng scope test riêng; suite mặc định không ghi vào database thật.
