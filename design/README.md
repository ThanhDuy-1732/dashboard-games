# Nhà Chơi — bản mẫu giao diện

Bản thiết kế tương tác cho dashboard game và Cờ tỷ phú, tiếng Việt, responsive cho desktop và mobile. “Nhà Chơi” là tên đề xuất tạm.

## Xem bản mẫu

Mở `index.html` trực tiếp bằng trình duyệt, hoặc từ thư mục gốc dự án chạy:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Sau đó mở http://127.0.0.1:4173/design/ . Các màn hình có địa chỉ `#home`, `#setup`, `#lobby`, `#game`.

- Dashboard → chọn chế độ → offline vào bàn mẫu; online vào phòng mẫu rồi xem bàn chơi.
- Bộ chọn Web/PWA, Android, iOS ở thanh trên dùng để xem trạng thái UI của nền tảng. Nó không mô phỏng hệ điều hành hoặc biến trang web thành ứng dụng mobile.
- Bluetooth trên Web/PWA giải thích cần ứng dụng mobile; trên Android/iOS mở được phòng minh họa.
- Chọn 1–5 máy, tên và quân cờ; xem lỗi mã phòng, sao chép mã minh họa, đọc luật.
- Gieo lần đầu tới Phố Hàng Buồm, xem mua đất hoặc đấu giá. Các lần sau chỉ mô phỏng di chuyển.
- 22 ô phố và 4 nhà ga có ảnh thật trên bàn cờ. Chạm để xem ảnh lớn, tên, giá và nguồn ảnh; ô chức năng dùng biểu tượng. Màn mua đất và đấu giá cũng có ảnh địa điểm.

## Giới hạn

Không có luật game đầy đủ, AI, kết nối online/Bluetooth, lưu ván, service worker/PWA cài đặt hoặc gói ứng dụng Android/iOS. Mã phòng và các người chơi khác là dữ liệu mẫu. Thao tác không gửi dữ liệu tới dịch vụ bên ngoài. Không dùng thư viện sản phẩm hoặc font tải từ mạng. Có 26 ảnh địa điểm lưu cục bộ (khoảng 1,8 MB); nguồn Wikimedia Commons, tác giả và giấy phép hiển thị trong chi tiết địa điểm và được lưu tại `assets/locations/credits.json`. Ảnh Thanh Niên là ảnh tư liệu đường Cổ Ngư; một số ô dùng ảnh khu vực hoặc công trình gắn với địa danh, có chú thích cụ thể.

## Kiểm tra

`check.mjs` dùng Playwright đã có sẵn trong runtime, không phải dependency sản phẩm. Cần Google Chrome hoặc đặt `BROWSER_EXECUTABLE` trỏ tới Chromium tương thích. Nếu dùng runtime Codex trên máy hiện tại:

```sh
NODE_PATH=/Users/thankz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node design/check.mjs
```

Kiểm tra đủ 26 ảnh cục bộ tải thành công, nguồn ảnh, modal ảnh trên mobile và không giữ ảnh cũ ở ô chức năng; 40 ô; bot 1–5; Bluetooth theo nền tảng; mã phòng; tên nhập vào được hiển thị như văn bản; phòng chờ; gieo/mua/đấu giá mẫu; dialog; bàn phím; 4 màn hình ở 360/390/768/1024/1440px; không lỗi JavaScript. Ảnh preview lưu trong `previews/`. Đây là kiểm tra Chrome headless, chưa thay thế kiểm tra thiết bị iOS/Android thật hoặc đánh giá đầy đủ bằng screen reader.
