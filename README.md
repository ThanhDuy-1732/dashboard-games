# Nhà Chơi

Dashboard game với Cờ tỷ phú truyền thống, web/PWA trước rồi Android/iOS dùng chung lõi luật và giao diện.

Web/PWA đã đạt WEB-PASS (A1–A10): luật truyền thống đầy đủ, offline với 1–5 máy, tự lưu/tiếp tục, phòng online 2–6 người và cài PWA. Android/iOS là giai đoạn tiếp theo; Bluetooth chưa nghiệm thu.

Triển khai theo `docs/superpowers/plans/2026-11-17-game-hub-implementation.md`. `design/` là bản mẫu tương tác, không phải game hoàn chỉnh. Workspace sản phẩm ở `apps/` và `packages/`.

## Phát triển

Node 24, npm workspaces. Sau khi checkout: `npm ci`.

- `npm run dev:web`: giao diện web ở cổng 5173.
- `npm run dev:server`: backend online ở cổng 3001.
- `npm test`: kiểm thử core/protocol và các phần đã hoàn thành.
- `npm run typecheck`, `npm run lint`, `npm run build`: kiểm tra và build các workspace.

Bộ luật: `docs/rules/classic-v1.md`. Các phase chưa hoàn thành không được coi là tính năng đã hoạt động.

Hướng dẫn chạy, cấu hình và giới hạn: [web runbook](docs/runbooks/web.md). Bằng chứng nghiệm thu: [WEB-PASS](docs/runbooks/web-verification.md). Runtime audit không báo lỗ hổng; full audit còn cảnh báo ở công cụ phát triển, ghi cụ thể trong runbook.
