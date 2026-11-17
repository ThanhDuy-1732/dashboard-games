# Nhà Chơi

Dashboard game với Cờ tỷ phú truyền thống, web/PWA trước rồi Android/iOS dùng chung lõi luật và giao diện.

Đang triển khai theo `docs/superpowers/plans/2026-11-17-game-hub-implementation.md`. `design/` là bản mẫu tương tác, không phải game hoàn chỉnh. Workspace sản phẩm ở `apps/` và `packages/`.

## Phát triển

Node 24, npm workspaces. Sau khi checkout: `npm ci`.

- `npm run dev:web`: giao diện web ở cổng 5173.
- `npm run dev:server`: backend (được triển khai ở phase A7).
- `npm test`: kiểm thử core/protocol và các phần đã hoàn thành.
- `npm run typecheck`, `npm run lint`, `npm run build`: kiểm tra và build các workspace.

Bộ luật: `docs/rules/classic-v1.md`. Các phase chưa hoàn thành không được coi là tính năng đã hoạt động.
