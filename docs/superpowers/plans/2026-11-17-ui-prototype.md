# Game Hub UI Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Tạo bản mẫu giao diện tiếng Việt có thể bấm thử trên desktop và mobile, không triển khai game thật.

**Architecture:** Một trang HTML độc lập, CSS responsive và JavaScript thuần điều khiển các màn hình. Dữ liệu mẫu nằm trong bản mẫu; các thao tác online, Bluetooth, bot và xúc xắc đều là mô phỏng thiết kế, được thông báo rõ.

**Tech Stack:** HTML, CSS, JavaScript; không thêm dependency sản phẩm.

**Spec:** docs/superpowers/specs/2026-11-17-game-hub-design.md. Người dùng đã duyệt thiết kế và yêu cầu thực hiện design ứng dụng; kế hoạch này chỉ thực hiện phần UI có thể xem và tương tác.

## Global Constraints

- Website/PWA và Android/iOS dùng chung hướng giao diện; bản mẫu có bộ chọn nền tảng để xem trạng thái Bluetooth tương ứng.
- Luật truyền thống; 2–6 người; offline với 1–5 bot.
- Không mô phỏng như thể kết nối hay lưu ván thật đã hoàn thành.
- Không tài khoản, bảng xếp hạng hoặc thẻ game giả.
- Có bàn phím, focus rõ, reduced motion, thông báo trạng thái và không tràn ngang trên mobile.

## Visual direction

- Tên làm việc: **Nhà Chơi**. Thương hiệu tạm do người thiết kế đề xuất.
- Màu: giấy #F6F7F2, mực #203B35, xanh bàn #0D6758, bạc hà #D9EAE2, vàng xúc xắc #F0CD75, tím quân cờ #8372B5.
- Chữ: system sans cho tiếng Việt; tiêu đề nặng, bo nhẹ; số dễ đọc. Không tải font từ mạng.
- Dashboard: sidebar nhỏ, vùng giới thiệu ở trái và bàn cờ phối cảnh ở phải; danh mục thật chỉ có Cờ tỷ phú; hướng dẫn bắt đầu phía dưới.
- Chọn chế độ: ba lựa chọn rõ mục đích, setup ngắn bên cạnh; Bluetooth giới hạn mobile.
- Phòng chờ: mã phòng và ghế người chơi, trạng thái sẵn sàng, CTA bắt đầu xem bàn cờ.
- Bàn cờ: bàn 40 ô và khu vực hành động/người chơi; trên mobile bàn cờ ở trên, thao tác bên dưới.
- Điểm khác biệt: bàn cờ minh họa tự dựng và quân cờ như đồ chơi; không hero ảnh stock, không thống kê người chơi giả.

## Review Focus

- Ở 360px: bàn cờ và nhãn không làm trang tràn ngang.
- Bluetooth trên web: giải thích giới hạn, không giả vờ tìm thiết bị thật.
- Nhập mã trống/sai: có lỗi cạnh ô nhập, focus giữ trong form.
- Chuyển chế độ/màn hình: focus và hành động chính nhất quán; bản mẫu không tạo cảm giác đã có multiplayer thật.
- Giảm chuyển động: tắt animation; dùng được bằng bàn phím.

### Task 1: Dashboard và hệ thống hình ảnh

**Files:** Create `design/index.html`, `design/styles.css`, `design/app.js`.
**Interfaces:** `showScreen(name)` chuyển giữa `home`, `setup`, `lobby`, `game`; trạng thái UI gồm mode và platform.
- [x] Tạo layout, token, icon SVG nội tuyến, minh họa bàn cờ, nội dung tiếng Việt.
- [x] Kiểm tra dashboard ở desktop và mobile; không tràn ngang, CTA mở setup.

### Task 2: Luồng tương tác

**Files:** Modify ba file trên.
**Interfaces:** DOM dùng `data-screen`, `data-go`, `data-mode`; form tên và mã phòng dùng validation chuẩn HTML kèm lỗi dễ hiểu.
- [x] Thêm chọn online/offline/Bluetooth, số bot và chọn quân cờ.
- [x] Thêm phòng chờ mô phỏng; mã mẫu chỉ dùng cho preview, không tạo phòng thật.
- [x] Dựng bàn cờ 40 ô, người chơi, tài sản, nhật ký, minh họa gieo xúc xắc/mua đất và hộp luật ngắn.
- [x] Kiểm tra mã phòng sai, Bluetooth trên web/mobile và quay lại các màn.

### Task 3: Kiểm tra và bàn giao

**Files:** Create `design/check.mjs`, `design/README.md`, ảnh preview desktop/mobile nếu trình duyệt khả dụng.
**Interfaces:** Check chạy bằng Node và trình duyệt kiểm thử sẵn có; không thêm dependency sản phẩm.
- [x] Assert đủ 40 ô, điều hướng, giới hạn 1–5 bot, lỗi mã phòng, modal và overflow ở desktop/360px.
- [x] Chụp và xem lại giao diện, sửa vấn đề bố cục tìm thấy.
- [x] Ghi cách mở bản mẫu và giới hạn; mở preview cho người dùng.

## Kết quả kiểm tra

Đã chạy `node --check design/app.js` và kiểm tra trình duyệt bằng `design/check.mjs`: PASS. Đã xem ảnh dashboard desktop, setup desktop và home/game mobile. Thêm chuyển màn theo hash và chạm ô cờ xem chi tiết để điều hướng trực tiếp đúng và đọc được nội dung trên mobile. Không khởi tạo Git, cài dependency sản phẩm hoặc phát hành ứng dụng.

Rà soát độc lập phát hiện nhãn truy cập bị ẩn ở sidebar tablet và tên dialog còn thiếu. Đã thêm kiểm tra tái hiện: FAIL với 3 nút và 4 dialog thiếu tên; sửa aria-label/aria-labelledby và chạy lại toàn bộ kiểm tra.
