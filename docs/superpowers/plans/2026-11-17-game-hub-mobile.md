# Nhà Chơi — Android/iOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sau khi web đạt WEB-PASS, dựng ứng dụng Android/iOS từ cùng UI và lõi luật; hỗ trợ offline, online chơi chéo web và Bluetooth không internet.

**Architecture:** Capacitor đóng gói build `native` của `apps/web`, cùng `game-core` và `protocol` từ giai đoạn A. Một plugin BLE cục bộ cung cấp peripheral/central trên Kotlin và Swift; host chạy GameAuthority TypeScript, native chỉ truyền byte và thông báo vòng đời/quyền.

**Tech Stack:** React/Vite/TypeScript đã có; Capacitor core/cli/android/ios/app cùng major 8, bản ổn định >=8.5; Android BLE GATT APIs, iOS CoreBluetooth, JUnit/XCTest và bộ test web hiện có. Không dùng Bluetooth Classic riêng Android hoặc MultipeerConnectivity riêng Apple làm giao thức chéo nền tảng.

**Spec:** [Thiết kế](../specs/2026-11-17-game-hub-design.md), [kế hoạch tổng và hợp đồng](2026-11-17-game-hub-implementation.md), [giai đoạn A phải hoàn thành trước](2026-11-17-game-hub-web.md).

## Global Constraints

Áp dụng Global Constraints của kế hoạch tổng. **Không tạo `apps/mobile/ios` hoặc `android` trước WEB-PASS.** Android và iOS đều nằm trong scope, cùng dữ liệu luật/ảnh; không viết lại UI hoặc bot. Mục tiêu Bluetooth 2–6 người với ba cặp Android↔Android, iOS↔iOS, Android↔iOS; số người tối đa phải qua thử nghiệm thật, không coi là bảo đảm của API.

## Review Focus

- Quyền bị từ chối, Bluetooth tắt hoặc phần cứng không quảng bá được: B2/B4.
- Frame thiếu/trùng/sai thứ tự/quá cỡ hoặc peer chưa được chấp nhận: B2/B3.
- Host và guest đổi nền/khóa màn/radio ngắt: B3/B4, pause và đồng bộ lại, không tự bầu host.
- Phiên bản protocol/rules khác nhau, token/ID bị giả: B2/B3.
- App update, cold start offline và mobile chơi chung web: B1/B4/B5.

## Bản đồ file

```text
apps/mobile/{package.json,capacitor.config.ts,README.md}
apps/mobile/ios/App/{App.xcodeproj,App/{Info.plist,AppDelegate.swift,SceneDelegate.swift},AppTests/}
apps/mobile/android/{gradlew,settings.gradle,app/src/main/AndroidManifest.xml,app/src/test/}
apps/mobile/plugins/local-game/{package.json,src/{index,definitions}.ts,Package.swift}
apps/mobile/plugins/local-game/ios/Sources/LocalGame/{LocalGamePlugin,BleHost,BleGuest}.swift
apps/mobile/plugins/local-game/android/src/main/java/dev/nhachoi/localgame/{LocalGamePlugin,BleHost,BleGuest}.kt
apps/mobile/plugins/local-game/android/src/test/java/dev/nhachoi/localgame/BleLifecycleTest.kt
apps/web/src/session/{bluetooth,bluetooth-host}.ts
apps/web/src/platform.ts, apps/web/src/platform-lifecycle.ts
packages/protocol/src/ble-frames.ts
packages/protocol/test/ble-frames.test.ts
apps/web/test/{native-platform,bluetooth,lifecycle}.test.ts
mobile-evidence/{bluetooth-spike,release-checks}.md
```

Tên file Swift/Kotlin không phải lý do tách lớp thừa: host và guest chỉ tách khi cùng plugin đủ lớn để cần rõ trách nhiệm. Giữ plugin types tại `definitions.ts`, không sao chép TS types sang giao diện web.

### Task 1: B1 — Dựng hai app từ web đã nghiệm thu

**Files:** Mobile package/config, ios/android generated project, `web/vite.config.ts`, `web/src/platform.ts`, `web/test/native-platform.test.ts`; mobile README.

**Interfaces:** `getPlatform():'web'|'android'|'ios'` và `isNative():boolean`; native gọi Capacitor.getPlatform, web không có bộ chọn giả nền tảng. `capacitor.config.ts`: appName `Nhà Chơi`, appId thử nghiệm `dev.nhachoi.app`, webDir `../web/dist-native`; không đặt server.url cho bản đóng gói. Hai app đều dùng output của `npm run build:mobile`.

- [ ] **RED:** `native_build_does_not_register_service_worker`; `native_assets_resolve_without_network`; `web_never_enables_bluetooth`; `native_online_requires_configured_https_backend`. Run: `npx vitest run apps/web/test/native-platform.test.ts`.
- [ ] **Implement:** tạo `apps/mobile`, thêm Capacitor packages cùng phiên bản, sinh cả ios/android; Vite mode `native` xuất `dist-native`, giữ bản web `dist` riêng. Khóa deployment target theo template được chọn (Capacitor 8: iOS 15+, Android minSdk 24), sau đó kiểm tra target JS/CSS cho WKWebView thấp nhất; không lấy target mặc định Vite làm bảo đảm tương thích iOS 15. Backend URL native là env HTTPS do build cung cấp; không hardcode localhost. Offline không phụ thuộc backend URL.
- [ ] **Kiểm tra công cụ/build:** Node/Xcode hiện có đã nêu ở kế hoạch tổng; phát hiện Android SDK, chọn JDK Gradle tương thích mà không đổi JDK toàn máy. Dùng template UIScene tương thích Xcode 27, safe-area CSS; không dùng template cũ rồi bỏ qua cảnh báo. Root `build:mobile` chạy web native build rồi `npm exec --workspace @nha-choi/mobile -- cap sync`; `build:android` chạy Gradle assembleDebug, `build:ios` chạy xcodebuild simulator build không cần signing.
- [ ] **GREEN:** `npm run build:web`, `npm run build:mobile`, `npm run build:android`, `npm run build:ios`; khởi động emulator/simulator offline, vào dashboard và tiếp tục ván lưu bằng chính asset đóng gói. Ghi simulator ID thực tế, Android SDK/JDK và commands trong mobile README; không tự tải/install toolchain lớn nếu chưa thực sự cần cho bước build.
- [ ] **Checkpoint:** commit `feat: package shared web game for Android and iOS`.

### Task 2: B2 — Spike Bluetooth hai vai trò và bằng chứng thiết bị thật

**Files:** Plugin `local-game/` và permissions native; `protocol/src/ble-frames.ts`, test codec; `mobile-evidence/bluetooth-spike.md`; một màn debug nội bộ chỉ có trong build development.

**Interfaces:** Plugin `LocalGame` có `getAvailability():Promise<{supported:boolean,canHost:boolean,enabled:boolean,permission:'prompt'|'granted'|'denied'}>`, `requestPermissions()`, `startHost({roomName:string})`, `startScan()`, `join({peerId:string})`, `approvePeer({peerId:string,allow:boolean})`, `send({peerId:string,data:string})`, `stop()`. `data` là base64 bytes, không phải GameState. Events `peerFound`, `peerConnected`, `peerDisconnected`, `dataReceived`, `availabilityChanged` đều kèm peerId khi thích hợp; `stop()` giải phóng listener/scan/advertising/GATT, gọi lặp không lỗi.

- [ ] **RED codec:** `fragments_respect_negotiated_payload_limit`; `reassembly_handles_reordered_duplicates`; `incomplete_or_oversized_messages_are_rejected`; `expired_partial_messages_are_discarded`; `different_peer_cannot_complete_another_peers_message`. Run: `npx vitest run packages/protocol/test/ble-frames.test.ts`. Dùng binary frame version/messageId/chunkIndex/chunkCount, tối đa message 32 KiB, tối đa 2 message dở dang/peer và hết hạn sau 10 giây. Không truyền ảnh qua BLE.
- [ ] **Implement thử nghiệm:** host là BLE peripheral/GATT server, guests là centrals; cả hai nền tảng đều làm được host hoặc báo `canHost:false` có lý do. Dùng một service UUID riêng, write-with-response cho commands và notify cho replies/views; lấy giới hạn payload thực từ mỗi platform/connection, không giả MTU 512. Xử lý native backpressure trước khi gửi chunk tiếp. Peer cần được chủ phòng chấp nhận, proof của phiên mới được gắn vào playerId; chưa chấp nhận thì không đọc snapshot/gửi game command. Chọn và ghi lại cơ chế ghép cặp/bảo vệ phiên đã thử nghiệm, không quảng bá secrets qua advertisement hoặc log.
- [ ] **Permission/lifecycle tests:** Android khai báo scan/connect/advertise runtime permissions theo OS; máy cũ xử lý quyền location cần thiết, không dùng quét để suy vị trí. iOS có usage description. Unit test từ chối quyền/tắt radio/stop hai lần không crash, không tự hiện prompt quyền khi mở dashboard. Build/test plugin qua Gradle `test:android` và XCTest `test:ios`; hai script xác định đúng target/simulator từ project đã sinh, không dùng radio simulator làm bằng chứng.
- [ ] **Gate radio:** thiết bị thật cho Android↔Android, iOS↔iOS, Android↔iOS; mỗi phía luân phiên host khi phần cứng hỗ trợ. Trước hết 2 máy, sau đó 3 máy hỗn hợp, cuối cùng đủ 6 người; internet/Wi-Fi tắt, chỉ Bluetooth bật. Gửi 100 commands và snapshot tới từng peer, ngắt rồi kết nối lại 10 lần: không sai thứ tự áp dụng, không duplicate effect, không trộn peer. Đo thời gian gửi command/view và snapshot; mục tiêu command/view p95 <2 giây, snapshot <=32 KiB <10 giây ở các cấu hình đã thử. Các con số là tiêu chí thử nghiệm đề xuất, không phải tính năng đã chứng minh.
- [ ] **Kết luận spike:** ghi model/OS, host, số peer, protocol, MTU, latency, permissions, lỗi và giới hạn. Chỉ sang B3 khi chứng minh được topology và số người đã cam kết; nếu chưa có đủ thiết bị hoặc không đạt, ghi rõ phần chưa chứng minh, dừng riêng tích hợp Bluetooth và báo người dùng, không tự đổi sang Wi-Fi/Internet hay giảm còn 2 người.
- [ ] **Checkpoint:** commit `feat: validate cross-platform Bluetooth transport` với bằng chứng thật; không viết “PASS” cho phần chỉ mock.

### Task 3: B3 — Gắn Bluetooth vào cùng luật và giao diện

**Files:** `web/src/session/{bluetooth,bluetooth-host}.ts`, setup/lobby/game screens; `web/test/bluetooth.test.ts`; plugin nếu cần sửa kết quả spike.

**Interfaces:** `createBluetoothSession({role:'host'|'guest',roomId:string,peerId?:string,selfId:PlayerId}):RoomSession`; host dùng `createAuthority` từ A5, guests chỉ giữ PlayerView của mình. Handshake gồm protocolVersion/rulesVersion, roomId và proof phiên; không tin actor do guest gửi.

- [ ] **RED:** `guest_and_host_apply_same_command_once`; `reconnect_gets_view_without_hidden_deck`; `unknown_peer_and_spoofed_actor_rejected`; `old_revision_cannot_buy_twice`; `protocol_mismatch_stops_before_join`; `host_loss_pauses_without_migration`. Run: `npx vitest run apps/web/test/bluetooth.test.ts packages/protocol/test/ble-frames.test.ts`.
- [ ] **Implement:** host tạo phòng, nhận/duyệt người vào và start khi 2–6 người ready; authority/session dùng đúng CommandEnvelope/CommandReply của web online. Native transport chỉ đóng/mở/kết nối/frame; không tính rent/dice hoặc copy luật vào Swift/Kotlin. Phân phối view riêng cho từng guest. Commands/acks có ID; mất link làm pause, gửi snapshot mới nhất khi resume, không tiếp tục hàng đợi cũ trái revision.
- [ ] **GREEN:** fake transport chạy cùng scenario fixture A2–A4 cho online và Bluetooth, kết quả public state giống nhau. Sau đó chạy ván trên thiết bị thật đi qua mua, đấu giá, xây, trade, jail và bankruptcy; đủ 6 người theo gate spike, không internet. Host offline đóng vai trò người chơi thông thường, không có quyền chọn dice/deck thông qua UI.
- [ ] **Checkpoint:** commit `feat: connect Bluetooth rooms to shared game authority`.

### Task 4: B4 — Vòng đời mobile, lưu ván và chơi chéo web

**Files:** `web/src/platform-lifecycle.ts`, session adapters, `storage/save.ts` nếu test phát hiện khác biệt WebView; native app integration tests; `web/test/lifecycle.test.ts`; `mobile-evidence/release-checks.md`.

**Interfaces:** `attachPlatformLifecycle(session:GameSession):()=>void` dùng Capacitor App events trên native; cleanup idempotent. Không đổi database name, WebView origin hoặc appId giữa update để giữ save; không bổ sung native storage adapter trừ khi kiểm thử chứng minh IndexedDB không đáp ứng yêu cầu đã ghi.

- [ ] **RED:** `background_pauses_remote_session`; `resume_resyncs_before_enabling_actions`; `offline_save_finishes_per_action_not_only_on_pause`; `permission_revoke_is_recoverable`; `unsubscribe_does_not_duplicate_events`. Run: `npx vitest run apps/web/test/lifecycle.test.ts` + toàn bộ web/core/transport suite.
- [ ] **Implement:** đổi nền/khóa màn Bluetooth coi như có thể mất link, pause và cho kết nối lại khi foreground; không hứa duy trì ván dưới nền. Offline đã lưu sau mỗi action, cold start chọn tiếp tục; back Android có xác nhận khi đang ván, không tự tạo ván mới; safe area/notch/keyboard không che nút chính. Lỗi quyền/phần cứng có hướng dẫn bật/cấp lại và vẫn dùng được online/offline.
- [ ] **GREEN thiết bị:** iOS + Android + browser tham gia cùng phòng online, mất mạng/reconnect không nhân đôi thanh toán. Cài app, ngắt mạng, chơi/lưu/đóng/mở lại; nâng build giữ nguyên appId và tiếp tục save cũ. Test Bluetooth khi guest/host ra nền, tắt radio, từ chối quyền và mở lại; không tự chuyển internet. Ghi những OS thấp nhất thực sự đã thử, không suy ra toàn bộ support matrix từ compile target.
- [ ] **Checkpoint:** commit `fix: preserve sessions across native lifecycle changes`.

### Task 5: B5 — Gate MOBILE-PASS và gói thử nghiệm

**Files:** Mobile README, evidence, native signing/build settings và icons/splash gốc của dự án; CI mobile nếu có runner phù hợp.

**Interfaces:** Root `build:android`, `build:ios`, `test:android`, `test:ios` phải chạy được từ clean checkout theo README, cùng lockfile với web.

- [ ] **Kiểm tra đủ:** web vẫn đạt WEB-PASS; Android/iOS đều cài/mở được, offline và online chơi chéo đạt B4; Bluetooth đủ cặp và số người đạt B2/B3; ảnh/credits đóng gói đầy đủ, không debug screen hoặc mock player trong bản phân phối. Làm kiểm tra touch, TalkBack/VoiceOver cho điều hướng/form/modal/thông báo lượt trên thiết bị thật.
- [ ] **Build và ghi bằng chứng:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:web`, `npm run build:mobile`, native tests/builds. Debug APK có thể bàn giao để thử; build iOS simulator không thay cho signed device build. Khi có signing, tạo bản iOS chạy thiết bị/TestFlight và Android internal testing; tên/bundleId release và tài khoản là đầu vào phát hành, không cần để làm web.
- [ ] **Gate:** chỉ đánh dấu MOBILE-PASS khi có bằng chứng Android/iOS thật và Bluetooth thật. Thiếu thiết bị/signing ghi đúng phần có thể build/đã test và phần chưa làm, tiếp tục các kiểm tra độc lập còn lại. Không công bố store, mua tài khoản hoặc gửi review store chỉ vì kế hoạch có task này.
- [ ] **Checkpoint:** commit `chore: prepare Android and iOS test releases`; bàn giao đường dẫn artifact, commands, evidence và giới hạn đã đo.

## Nguồn kỹ thuật cho các quyết định mobile

- [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow): build web rồi sync vào native project.
- [Capacitor 8 prerequisites](https://capacitorjs.com/docs/updating/8-0), [8.5 và UIScene/Xcode 27](https://capacitorjs.com/docs/updating/8-5): đối chiếu lại phiên bản lock khi tạo project.
- [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions): scan, advertise và connect có quyền runtime theo phiên bản OS.
- [Apple background Bluetooth](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html): nền/suspended không có cùng hành vi như foreground; thiết kế pause/resume thay vì hứa kết nối liên tục.
- [Community BLE plugin](https://github.com/capacitor-community/bluetooth-le#introduction): central-only; không đủ để làm cả host và guest theo topology này.
