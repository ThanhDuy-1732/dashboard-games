# Nhà Chơi — Android và iOS

Cùng UI React, lõi luật, bot và ảnh với web. App ID thử nghiệm `dev.nhachoi.app`; không có server.url hoặc service worker trong bản đóng gói. Bluetooth chưa khả dụng; chưa đạt MOBILE-PASS.

## Chuẩn bị và build

Từ root repo: Node >=24.11, `npm ci`.

```sh
npm run build:web
npm run build:mobile
npm run build:android
npm run build:ios
```

`build:mobile` xuất riêng `apps/web/dist-native` rồi đồng bộ cả hai project. Bản web ở `apps/web/dist` giữ riêng. Chạy lại sync sau khi đổi UI/assets/plugin.

Android: SDK 36, build-tools 36.0.0, minSdk 24, Gradle 8.14.3, JDK 21. Trên macOS script chọn JDK 21 cho riêng tiến trình, không sửa Java mặc định (máy hiện có Java 25 không phù hợp Gradle này). Có thể đặt NHA_CHOI_JAVA_HOME; Android SDK lấy từ ANDROID_HOME hoặc ~/Library/Android/sdk. Linux cần đặt JAVA_HOME phù hợp và ANDROID_HOME. Gradle có thể tải dependency ở lần build đầu.

APK thử nghiệm: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Đây là debug APK, không phải bản phát hành store.

Xcode 27.2, Capacitor core/cli/ios/android 8.6.2, project UIScene + Swift Package Manager; deployment target iOS 15.0. `build:ios` tạo bản simulator không cần signing tại `apps/mobile/build/ios/Build/Products/Debug-iphonesimulator/App.app`. Bản này không cài trực tiếp lên iPhone; bản thiết bị/TestFlight cần tài khoản và signing.

## Chạy kiểm tra native

Bật một Android emulator hoặc chọn máy bằng ANDROID_SERIAL, rồi:

```sh
npm run test:android
```

Script chỉ cài/mở `dev.nhachoi.app`, kết nối WebView của app đó, đặt offline trong WebView để kiểm tra reload, 26 ảnh, không SW, lưu và cold start. Giữ nguyên dữ liệu ứng dụng, không reset emulator. Nếu có bản lưu của lần thử trước, tiếp tục ván đó.

Bật iOS simulator rồi chọn UUID:

```sh
xcrun simctl list devices booted
IOS_SIMULATOR_ID=<UUID> npm run test:ios
```

XCTest thao tác UI thật: tạo hoặc tiếp tục ván, kiểm tra lưu, đóng/mở app và tiếp tục. Không dùng simulator radio để kết luận Bluetooth.

## Online trên mobile

Đặt `VITE_SERVER_URL=https://...` trong `apps/web/.env.native.local` trước `build:mobile`, đồng thời thêm origin WebView `capacitor://localhost` (iOS), `https://localhost` (Android) vào ALLOWED_ORIGINS của backend. Không dùng localhost từ máy phát triển làm URL mặc định cho điện thoại. Máy chủ phải có HTTPS/WSS hợp lệ. Nếu chưa cấu hình HTTPS, UI thông báo online chưa khả dụng; offline vẫn chơi bình thường. Không có tài khoản hoặc backend công khai được tự tạo trong giai đoạn này.

## Tương thích và dữ liệu

- Target JS Safari 15/Chrome 100; fallback structuredClone và UUID, tránh các phương thức mảng mới; dialog polyfill khi WebView thiếu showModal. CSS có vh fallback và safe-area, input 16px tránh autozoom iOS.
- Mức iOS 15.0/Android API 24 là compile target, chưa phải bằng chứng đã chạy trên thiết bị thấp nhất. Hiện kiểm tra iOS simulator 18.0 và Android emulator 16/WebView 133.
- Giữ appId, WebView origin và tên IndexedDB `nha-choi` khi nâng bản để giữ ván. iOS tắt multiple scenes, Android dùng singleTask; native cold start có thể tiếp nhận lease cũ của tiến trình đã chết. Web vẫn giữ khóa tab riêng và chặn ghi đè từ lịch sử cũ. Nếu sau này thêm nhiều cửa sổ native phải đổi lại chính sách này.

Bằng chứng: `mobile-evidence/release-checks.md` ở root. Chưa có kiểm chứng Bluetooth, chơi online chéo native qua HTTPS hoặc VoiceOver/TalkBack trên điện thoại thật.
