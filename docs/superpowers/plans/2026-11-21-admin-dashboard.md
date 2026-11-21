# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Đưa dashboard quản trị Nhà Chơi vào hoạt động tại `/admin`, với thống kê truy cập, Caro và Cờ tỷ phú online/offline, sức khỏe hệ thống và dọn chi tiết quá 30 ngày.

**Architecture:** Dùng ứng dụng web và backend hiện tại. PostgreSQL lưu sự kiện và số liệu ngày, backend cung cấp API quản trị cùng origin với web, thiết bị giữ hàng đợi offline đến khi đồng bộ. Giữ các số liệu kỹ thuật tách khỏi đường ghi trạng thái ván, trừ sự kiện Cờ tỷ phú online cần lưu cùng checkpoint.

**Tech Stack:** TypeScript, React/Vite, IndexedDB, Node HTTP, Socket.IO, PostgreSQL/pg, Zod, Vitest và Playwright.

**Spec:** [Thiết kế dashboard quản trị](../specs/2026-11-21-admin-dashboard-design.md).

## Global Constraints

- Một tài khoản quản trị. HTTPS, cookie phiên có hạn, xác thực tại backend, chống yêu cầu dọn từ origin khác, không cache API quản trị.
- Khoảng xem hôm nay, 7 ngày, 30 ngày theo `Asia/Ho_Chi_Minh`. Phiên hết sau 30 phút không hoạt động, hoạt động gần đây tính trong 5 phút.
- Chỉ dọn thủ công chi tiết quá 30 ngày, giữ số liệu ngày, checkpoint, lease, dữ liệu ứng dụng khác và bản lưu thiết bị.
- Trình duyệt báo sự kiện truy cập, ván offline và độ trễ đầu cuối. Backend tự ghi sự kiện ván online và thời gian xử lý. Không đưa nội dung ván, tên người chơi, IP, mã phòng công khai hoặc URL vào sự kiện.
- Dùng PostgreSQL thử biệt lập để nghiệm thu. Chỉ chạy thử xóa trên dữ liệu fixture. Không đo định kỳ khi Neon đang rảnh.

## Review Focus

- Commit checkpoint hoàn tất nhưng phản hồi bị mất, client gửi lại lệnh. Bộ đếm online vẫn tăng một lần (việc 3).
- Ván offline lưu từ phiên bản cũ, tiếp tục trên bản mới và kết thúc trong lúc mất mạng. Chỉ ghi mốc vừa quan sát, giữ mốc đến khi có xác nhận (việc 4).
- Trang admin mở trực tiếp khi service worker đời cũ đang điều khiển. API không bị fallback thành HTML, phiên vẫn do backend kiểm tra (việc 2 và 6).
- Hai lần xác nhận dọn chạy đồng thời hoặc kết nối đứt giữa các lô. Báo số thực xóa, có nhật ký từng lô và có thể thử lại (việc 5).
- Không có mẫu hoặc sự kiện đến ở hai phía của nửa đêm Việt Nam. Hiện đúng khoảng ngày và trạng thái thiếu mẫu, không hiển thị tốc độ giả bằng 0 (việc 1 và 6).

## 1. Kho thống kê và API nhận sự kiện

**Files:** Tạo `packages/protocol/src/telemetry.ts`, `apps/server/migrations/002_admin_metrics.sql`, `apps/server/src/metrics.ts`, `apps/server/test/metrics.live.test.ts`. Sửa phần export trong `packages/protocol/src/index.ts`, khởi tạo migration/pool từ `apps/server/src/database.ts`, gắn handler trong `apps/server/src/server.ts`. Bổ sung lệnh kiểm tra DB biệt lập trong `package.json`.

**Interfaces:** `TelemetryEvent` gồm `id`, `occurredAt` dạng ISO UTC và một trong các biến thể `view`, `session_started`, `activity`, `game_started`, `game_completed`, `latency`. Sự kiện truy cập có `sessionId` ngẫu nhiên và `platform`; view có thêm `screen` thuộc danh sách cố định. Sự kiện độ trễ có `metric: "backend" | "database" | "device"`, `durationMs` và `technicalError`. Sự kiện game có `game: "caro" | "ty-phu"` và `mode: "online" | "offline"`. `recordEvents(db, scope, source, events): Promise<void>` nhận một truy vấn PostgreSQL hoặc client trong giao dịch. `POST /api/telemetry` nhận `{ events: TelemetryEvent[] }` và trả `{ accepted: string[], expired: string[] }` theo ID, kể cả sự kiện đã nhận trước đó.

- [ ] Viết test PostgreSQL cho lô gửi lặp, rollback giữa chi tiết và tổng hợp, hai sự kiện trước/sau 17:00 UTC thuộc hai ngày Việt Nam khác nhau, sự kiện quá 30 ngày và nguồn thiết bị cố gửi mốc online.
- [ ] Chạy bộ test mới trên DB fixture để thấy lỗi do chưa có schema/handler.
- [ ] Tạo kho chi tiết khóa theo scope, nguồn và ID, kho tổng hợp theo ngày và nhóm, sổ báo hoạt động gần nhất dùng dữ liệu chi tiết. Dùng kết quả `INSERT … ON CONFLICT DO NOTHING RETURNING` làm nguồn tăng bộ đếm trong cùng giao dịch. Đếm phiên một lần theo sự kiện mở phiên và quy ngày theo thời điểm mở. Giữ nhóm độ trễ cố định để gộp nhiều ngày rồi tính p50/p95, hiển thị dạng ước lượng.
- [ ] Thêm handler nhận lô, từ chối trường dư, mốc online và mẫu backend/DB từ thiết bị, kiểm tra origin web/native, áp giới hạn body 32 KiB, 50 sự kiện/lô, 30 lô/phút theo nguồn kết nối, ưu tiên hạn mức ở proxy khi dùng chung địa chỉ. Cho phép lệch đồng hồ tối đa 5 phút về tương lai, lấy 30 ngày theo đồng hồ DB để xét mốc quá hạn. Lỗi tạm thời trả 503 để thiết bị giữ lô.
- [ ] Chạy test kho thống kê và suite giao thức. Commit phần migration, hợp đồng và ingest cùng nhau.

## 2. Phiên admin và đường dẫn web

**Files:** Tạo `apps/server/src/admin.ts`, `apps/server/test/admin.test.ts`, `apps/web/src/admin/AdminApp.tsx`. Sửa `apps/server/src/main.ts`, `apps/server/src/server.ts`, `.env.example`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, `apps/web/src/pwa/sw.ts` và `docs/runbooks/web.md`.

**Interfaces:** `POST /api/admin/login` nhận `{ password: string }`, `GET /api/admin/session` trả trạng thái đăng nhập, `POST /api/admin/logout` kết thúc phiên. `createAdminHandler(options)` trả handler Node HTTP để đăng ký các endpoint admin phía sau cùng phép kiểm quyền.

- [ ] Viết test HTTP cho thiếu phiên, hết hạn, logout, origin sai, giới hạn đăng nhập và phản hồi `Cache-Control: no-store`. Thêm test trình duyệt truy cập thẳng từng URL admin khi chưa đăng nhập.
- [ ] Chạy các test mới và kiểm tra chúng thất bại do chưa có phiên/route.
- [ ] Cấu hình mật khẩu dạng hash và origin từ backend. Bật admin khi có cấu hình hợp lệ, giữ phiên ngẫu nhiên phía server với hạn 8 giờ, làm mất hiệu lực khi logout, dùng cookie HttpOnly, Secure trên HTTPS và SameSite=Strict. Giới hạn thử đăng nhập cả tại backend và proxy khi cần. Với POST admin, so origin chính xác trước khi xử lý. Mọi API quản trị dùng chung nhánh xác thực.
- [ ] Chọn `AdminApp` từ entry web trên `/admin` và đường dẫn con. Mount khu chơi như cũ cho đường dẫn khác. Proxy HTTP API tại Vite và cấu hình triển khai, ưu tiên proxy trước fallback React. Thêm denylist cho API và navigation admin trong service worker, duy trì tương thích với lần cập nhật từ service worker cũ qua kiểm tra API JSON. Tài liệu hướng dẫn truy cập trực tiếp và tạo thông tin đăng nhập.
- [ ] Chạy test admin HTTP, PWA và test trình duyệt mới. Commit tuyến đường và phiên.

## 3. Số liệu online, hiệu năng và dung lượng

**Files:** Sửa `apps/server/src/{server,rooms,caro-rooms,database,metrics,admin}.ts`. Bổ sung `apps/server/test/{persistence,caro,metrics.live}.test.ts`.

**Interfaces:** Mở rộng `RoomStore.save(rooms, events?)` với danh sách sự kiện Cờ tỷ phú online có khóa cố định theo ID nội bộ của phòng và mốc. `GET /api/admin/system?range=today|7d|30d` trả nhóm bảng cùng bytes/số bản ghi, RAM tiến trình, ảnh chụp dung lượng theo ngày và số mẫu, p50, p95, lỗi theo nguồn đo.

- [ ] Viết test mốc bắt đầu Cờ tỷ phú sau commit, lỗi trước commit không tăng đếm, mất phản hồi sau commit và gửi lại chỉ tăng một lần. Với Caro, kiểm tra chờ phòng, nước đầu, kết quả, chơi lại, nối lại và retry ghi. Kiểm tra từ chối theo luật không tăng tỷ lệ lỗi và cấu hình không có mẫu trả `null` ở percentile.
- [ ] Chạy các test mới và xác nhận phần bổ sung thất bại trước triển khai.
- [ ] Thu mốc bắt đầu/kết thúc do luật xác nhận từ `Rooms.start` và `Rooms.command`. Chuyển mốc qua mutation hiện có sang giao dịch cùng lease, checkpoint và receipt. Nếu rollback, bỏ mốc đang chờ. Tránh phát mốc khi phục hồi hoặc phát lại receipt.
- [ ] Gắn mốc vào `CaroRooms` theo mã nội bộ mỗi lần tạo phòng và số vòng. Chỉ ghi nước hợp lệ đầu tiên và chuyển sang có kết quả. Gom đợt ghi Caro trong hàng đợi RAM giới hạn 1.000 sự kiện, giữ ID khi retry và đếm bản ghi bị bỏ. Thêm số ván đang chơi theo trạng thái thật của hai loại phòng.
- [ ] Đo lệnh Socket.IO từ lúc nhận đến trước ACK, thời gian thao tác PostgreSQL riêng, lỗi kỹ thuật riêng. Dồn mẫu kỹ thuật theo lô để tránh tăng truy vấn từng nước. Đọc RAM với `process.memoryUsage().rss`. Chỉ đọc kích thước các bảng ứng dụng từ danh sách cố định, kèm chỉ mục và TOAST, ghi mẫu mỗi ngày khi có truy vấn DB sẵn hoặc khi quản trị viên mở trang. Không chạy lịch polling đánh thức DB.
- [ ] Chạy test persistence, Caro và DB fixture. Commit phần đo server.

## 4. Ghi nhận truy cập và ván offline

**Files:** Tạo `apps/web/src/telemetry.ts`, `apps/web/test/telemetry.test.ts`. Sửa `apps/web/src/App.tsx`, `apps/web/src/storage/{save-schema,save,useOfflineSave}.ts`, `apps/web/src/session/{offline,online}.ts` và `apps/web/src/caro/{Screen.tsx,save.ts,online.ts}`.

**Interfaces:** `track(event: TelemetryEvent): void` giữ dữ liệu trong IndexedDB mà không chặn chơi. `flushTelemetry(): Promise<void>` gửi từng lô qua API việc 1, chỉ xóa ID được xác nhận hoặc đã hết hạn. Bản lưu cũ chấp nhận thiếu mã thống kê và nhận mã ổn định khi tiếp tục.

- [ ] Viết test cho IndexedDB mất mạng rồi mở lại, gửi lô lặp, phản hồi mất, hai lần gọi flush đồng thời, ván cũ hoàn thành sau nâng cấp và bot đánh nước kết thúc. Tách test timeout kỹ thuật khỏi lệnh luật từ chối.
- [ ] Chạy test mới và xác nhận thất bại ở hành vi còn thiếu.
- [ ] Gắn view vào chuyển màn hình trong App và báo hoạt động tối đa mỗi phút khi đang ở tiền cảnh và có mạng. Giữ ID phiên ổn định trong cửa sổ 30 phút, gắn nền tảng từ nhận diện hiện có và đổi phiên khi quá hạn. Đo từ gửi lệnh online đến nhận ACK hoặc timeout trong hai client Socket.IO.
- [ ] Gắn mốc ván Cờ tỷ phú offline vào tạo session mới và lần đầu trạng thái chuyển sang kết thúc. Với Caro offline, dùng chung đường chấp nhận nước đi của người và máy để ghi nước đầu và kết quả. Persist mã trước khi đưa mốc vào hàng đợi. Không ghi lại mốc bắt đầu khi chỉ tải bản lưu lên.
- [ ] Khởi động flush khi app mở, có mạng trở lại hoặc về tiền cảnh. Giới hạn hàng đợi 5.000 sự kiện, ưu tiên giữ mốc ván khi dồn nhiều sự kiện truy cập và ghi rõ giới hạn trong runbook. Dùng đường API cùng origin trên web, backend HTTPS trên native. Chạy test offline và Caro hiện có cùng test mới rồi commit.

## 5. Dọn dữ liệu và nhật ký

**Files:** Sửa `apps/server/src/{metrics,admin}.ts` và migration việc 1 để thêm nhật ký trước phát hành. Tạo `apps/server/test/metrics-cleanup.live.test.ts`.

**Interfaces:** `POST /api/admin/cleanup/preview` nhận `{ kinds, before }`, trả `{ previewToken, count, estimatedBytes, before }`. `POST /api/admin/cleanup` nhận `{ previewToken }`, trả `{ deleted, remaining }`. `GET /api/admin/cleanup` trả 50 mục gần nhất. Token do server cấp, gắn với phiên, phạm vi đã xem và hạn 10 phút.

- [ ] Viết test fixture cho hàng đúng/vượt biên 30 ngày, phạm vi giả, phiên khác, xác nhận song song, đứt giữa lô, tổng hợp không đổi, checkpoint và bảng không thuộc Nhà Chơi còn nguyên.
- [ ] Chạy test DB biệt lập để xác nhận endpoint và thao tác còn thiếu.
- [ ] Chỉ truy vấn bảng chi tiết, so `occurred_at < before` với mốc hợp lệ theo giờ DB. Không nhận tên bảng từ giao diện. Xóa tối đa 1.000 bản ghi/lô, cập nhật số thực xóa và nhật ký cùng giao dịch từng lô. Với phần còn lại, giữ phạm vi cũ trên token còn hạn và cho phép chạy tiếp. Kiểm tra tuổi lại khi xóa và hiển thị bytes ước tính với chú thích dung lượng file vật lý có thể chưa giảm.
- [ ] Chạy test DB biệt lập và test quyền ở việc 2. Commit phần dọn.

## 6. Giao diện dashboard và nghiệm thu

**Files:** Tạo `apps/web/src/admin/{admin.css,api.ts}` và `apps/web/e2e/admin.spec.ts`. Hoàn thiện `apps/web/src/admin/AdminApp.tsx`, `apps/server/src/admin.ts`, `apps/server/src/metrics.ts`, `docs/runbooks/web.md`.

**Interfaces:** `GET /api/admin/summary?range=…` trả `{ days, updatedAt, traffic, games, system }`. Các mục hiển thị dùng cùng range và số liệu nguồn. `GET /api/admin/system` và API cleanup giữ hợp đồng ở việc 3 và 5.

- [ ] Viết kiểm tra trình duyệt đăng nhập và tải lại URL từng trang, lọc khoảng ngày, phân biệt thiếu mẫu với giá trị 0, thao tác xem trước và xác nhận bằng bàn phím, không cho gửi lần hai khi yêu cầu đang chạy. Chuẩn bị dữ liệu fixture có cả hai trò chơi và cả hai chế độ.
- [ ] Chạy kiểm tra trình duyệt trước khi hoàn thiện giao diện để thấy các màn còn thiếu.
- [ ] Tạo tổng quan và điều hướng theo thiết kế. Trang truy cập có biểu đồ ngày, lượt xem, phiên, hoạt động và nền tảng. Trang ván lọc trò chơi/chế độ và ghi rõ độ trễ đồng bộ offline. Trang hệ thống ghi đơn vị, mẫu, độ trễ và thời điểm cập nhật. Trang dọn trình bày rõ phạm vi và số thực xóa. Ưu tiên thành phần HTML hiện có, biểu đồ có bảng số liệu đọc được.
- [ ] Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` và bộ DB ở môi trường biệt lập. Kiểm tra luồng truy cập và API proxy trên cấu hình triển khai thử, gồm nâng cấp từ service worker cũ và mở thẳng URL. Ghi cách cấu hình, cách truy cập và giới hạn đo offline/Caro trong runbook rồi commit.
