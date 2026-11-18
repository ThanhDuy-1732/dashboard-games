# Bằng chứng mobile — 18/11/2026

**B1 đã dựng Android/iOS. MOBILE-PASS chưa đạt.** Người dùng xác nhận hiện chưa có thiết bị thật để thử Bluetooth.

## Đã kiểm tra

- `npm run build:mobile`: đạt; native output có đủ 26 ảnh, không sw.js/manifest PWA, không server.url. Build web và native độc lập.
- `npm run build:android`: đạt, debug APK. SDK 36, JDK 21.0.13, Gradle 8.14.3; Java 25 mặc định gây lỗi ở lần sync đầu, đã chọn JDK 21 riêng cho lệnh build.
- Android emulator `emulator-5554`, sdk_gphone64_arm64, Android 16, WebView Chrome 133.0.6943.137: test actual WebView đạt offline reload, vào bàn 40 ô, cả 26 ảnh giải mã, không đăng ký SW, lưu/rời/force-stop/mở lại, bản lưu giữ nguyên. Screenshot `docs/previews/android-game.png`.
- `npm run build:ios`: đạt với Xcode 27.2; bản simulator, không signing.
- iPhone 16 Pro simulator, iOS 18.0, UUID `928F67C8-50FF-416E-9A30-4C516071D1C8`: XCTest đạt tạo/tiếp tục game, trạng thái đã lưu, terminate/launch và tiếp tục từ bộ asset đóng gói. Không tắt internet của máy chủ để giả lập radio offline; iOS đã chứng minh cold start local, chưa thử airplane mode trên iPhone thật.
- Phát hiện và sửa qua kiểm tra native: input iOS 12px gây autozoom; cold start không lấy được lease còn hạn của tiến trình đã đóng. Native single-window takeover đã có regression, không nới khóa nhiều tab trên web.
- Kiểm tra nền tảng và tương thích: 93 unit/integration đạt, lint/typecheck đạt. Web sau thay đổi đóng gói: **27/27 E2E** trên Chromium159/Firefox159/WebKit27.2, thêm tình huống không có API dialog native. Không suy ra iOS 15 thật từ test API mô phỏng.
- Runtime audit 0; full audit vẫn 19 cảnh báo dev-only, như runbook web.

## Chưa kiểm tra / chưa nghiệm thu

- Thiết bị iOS/Android thật, phiên bản thấp nhất, VoiceOver/TalkBack thật.
- HTTPS backend thật cho chơi online chéo web–Android–iOS; chưa được cung cấp địa chỉ máy chủ. Không cấu hình URL giả trong bản mobile.
- Bluetooth Android↔Android, iOS↔iOS, Android↔iOS, đủ 2/3/6 người, permissions/radio/background và số đo độ trễ.
- App update giữ save trên thiết bị thật; ký iOS thiết bị/TestFlight và bản Android release/store.

Các thiếu hụt trên giữ B2/B3, phần thiết bị của B4 và B5 ở trạng thái chưa đạt. Không đăng store hoặc triển khai công khai trong task này.
