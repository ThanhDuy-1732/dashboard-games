# Chạy Nhà Chơi web/PWA

## Máy phát triển

Node >=24.11, npm. `npm ci`, rồi mở hai cửa sổ:

```sh
npm run dev:server
npm run dev:web
```

Mở http://127.0.0.1:5173. Cờ tỷ phú chơi với 1–5 máy, hoặc tạo phòng online 2–6 người. Tên và quân cờ được chọn trước khi tạo/vào phòng; tất cả sẵn sàng, chủ phòng bắt đầu. Link mời chỉ chứa mã phòng, không chứa quyền điều khiển. Bluetooth chỉ dành cho giai đoạn mobile, không có trên web.

## Bản production và PWA

```sh
npm run build
npm run start --workspace @nha-choi/server
npm run preview --workspace @nha-choi/web
```

Preview để kiểm tra cục bộ, không dùng Vite làm máy chủ production công khai. Phục vụ `apps/web/dist` bằng static server có HTTPS, fallback navigation về index.html và reverse proxy `/socket.io/` tới backend (HTTP + WebSocket). Đặt `Cache-Control: no-cache` cho index.html, sw.js và manifest; assets có hash có thể cache immutable. HTTPS/WSS cần cho PWA và bảo vệ phiên online. Không cache API hoặc socket ở CDN/service worker.

Backend: HOST (mặc định 127.0.0.1), PORT (3001), ALLOWED_ORIGINS (danh sách origin đầy đủ, phân tách dấu phẩy). Không tin X-Forwarded-For mặc định; rate limit tại backend dùng địa chỉ kết nối, nên khi reverse proxy nhiều người dùng chung giới hạn IP. Cần thêm giới hạn tại proxy nếu đưa ra công khai. Không chạy nhiều backend process hoặc load balance: phòng hiện nằm trong bộ nhớ một process.

Web mặc định kết nối cùng origin; Vite dev/preview proxy `/socket.io` tới 127.0.0.1:3001 (đổi bằng BACKEND_PROXY_URL khi khởi động Vite). Nếu backend khác origin, đặt VITE_SERVER_URL trong `apps/web/.env.local` trước build và thêm origin web vào allowlist backend. Biến VITE_* là dữ liệu công khai trong gói; không đặt khóa bí mật ở đây. Root `.env.example` là hướng dẫn. Scripts backend tự nạp root `.env` nếu có; biến môi trường hosting được ưu tiên. Cấu hình DATABASE_URL chỉ ở backend, xem neon.md.

Chỉ ngắt mạng sau thông báo đã sẵn sàng offline. Toàn bộ 26 ảnh, credits và luật đã được đóng gói; chỉ chế độ với máy hoạt động khi offline. Trình duyệt có thể thu hồi dữ liệu website nếu người dùng xóa hoặc thiếu dung lượng; bản lưu nằm trên thiết bị, không đồng bộ tài khoản.

Cập nhật: xuất bản bản build mới cùng tất cả assets. Không xóa assets của bản đang dùng ngay lập tức. Ứng dụng thông báo có bản mới, chặn cập nhật khi còn trong phiên chơi; lưu/rời ván rồi bấm cập nhật. IndexedDB độc lập cache PWA. Cache bản cũ được giữ để các tab cũ tiếp tục hoạt động; hiện chưa tự dọn theo tuổi, có thể tăng dung lượng qua nhiều bản cập nhật. Không yêu cầu người dùng xóa dữ liệu website để cập nhật vì sẽ xóa ván lưu.

## Mất kết nối và dừng máy chủ

Mất mạng của người còn chơi làm cả ván online tạm dừng. Cùng tab có thể tải lại hoặc vào Chơi online → Kết nối lại phòng trước. Phiên lưu trong sessionStorage; đóng tab có thể mất khả năng lấy lại ghế. Kết nối mới dùng cùng phiên sẽ thay kết nối cũ. Sau 120 giây, người còn lại có quyền kết thúc không người thắng. Không tự thay bằng máy hoặc tính phá sản.

Phòng chờ trống xóa ngay; ghế lobby mất mạng giữ 120 giây rồi chuyển chủ; lobby không hoạt động 30 phút sẽ đóng. Ván có người kết nối không tự hết hạn; ván toàn bộ offline đóng sau 30 phút. Ván kết thúc giữ 10 phút. Nếu có DATABASE_URL, ván online được lưu và khôi phục sau restart; cùng phiên/proof cũ cần kết nối lại. Nếu không cấu hình DB ở chế độ phát triển, restart vẫn mất ván online. Bản offline trên thiết bị giữ nguyên.

Trước bảo trì, ngừng nhận phòng mới ở reverse proxy, thông báo người đang chơi và chờ ván hoàn tất khi có thể. SIGINT/SIGTERM với Neon giữ checkpoint và ngắt kết nối để người chơi resume sau restart. Không có chuyển phòng trực tiếp qua process khác; chỉ một backend được quyền ghi. Không DB thì vẫn đóng/mất ván như chế độ phát triển. Health check: GET /health, trả 503 nếu lưu trữ gặp lỗi. Hướng dẫn database và lease: [neon.md](neon.md).

## Kiểm tra

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Đảm bảo cổng 3001/5173/5174 trống; bộ kiểm tra tự chạy backend và hai production preview, không dùng dev server. Kiểm tra PWA tự build bản thứ hai để thử cập nhật; chỉ thay đổi output dist. Có thể dùng PLAYWRIGHT_CHROMIUM_EXECUTABLE để chọn Chrome có sẵn. WebKit desktop không phải bằng chứng trên iPhone thật.

Kiểm tra phụ thuộc: runtime `npm audit --omit=dev` không báo lỗ hổng ở lần kiểm tra gần nhất. Full audit còn 19 báo cáo dev-only qua glob (GHSA-3g3m-2fjr-6pw4), minimatch (GHSA-g3hv-75wg-m249), picomatch (GHSA-fc5q-39xc-vjpf). Chưa force-downgrade toàn toolchain hoặc ép major override; glob build không nhận dữ liệu người chơi. Cần theo dõi bản vá trước khi đưa toolchain vào môi trường build nhận đầu vào không tin cậy.

Bằng chứng trình duyệt và trạng thái WEB-PASS ghi trong `docs/runbooks/web-verification.md` sau nghiệm thu. Chưa tự đăng ký hosting hoặc triển khai công khai.

## Dashboard quản trị

Dashboard nằm tại `https://<tên-miền-web>/admin`. Backend cần PostgreSQL và sẽ tự chạy migration `002_admin_metrics.sql`. Triển khai cả frontend lẫn backend cùng phiên bản và đóng gói cả hai file migration.

Trên backend, đặt `ADMIN_ORIGIN` bằng origin chính xác của trang web (ví dụ `https://nha-choi.example`, không có dấu / cuối) và `ADMIN_PASSWORD_HASH` bằng chuỗi salt và hash. Dùng một mật khẩu dài, riêng cho admin. Lệnh sau đọc mật khẩu từ terminal và chỉ in giá trị hash để cấu hình.

```zsh
read -rs 'admin_password?Mật khẩu admin: '
printf '%s' "$admin_password" | node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { randomBytes, scryptSync } from "node:crypto";
  const password = readFileSync(0, "utf8");
  if (password.length < 16 || password.length > 256) process.exit(1);
  const salt = randomBytes(16).toString("hex");
  console.log(salt + ":" + scryptSync(password, salt, 64).toString("hex"));
'
unset admin_password
```

Ở máy chủ web hoặc Vercel, chuyển tiếp `/api/admin/*` và `/api/telemetry` đến backend **trước** quy tắc fallback `/index.html`. Giữ `Origin`, `Cookie` và `Set-Cookie` qua proxy. Tắt cache cho hai API. Mở trực tiếp `/admin` hoặc các trang con phải tải ứng dụng web. Vite dev/preview đã có proxy cho `/api`. Thêm origin web và origin native đã triển khai vào `ALLOWED_ORIGINS` của backend để nhận thống kê.

Dashboard bắt đầu thu dữ liệu từ lúc bật thu thập. Thiết bị đồng bộ sự kiện offline khi ứng dụng mở và có mạng. Sự kiện quá 30 ngày hết hạn. Dữ liệu có thể thiếu nếu người dùng xóa dữ liệu cục bộ, hàng đợi 5.000 mục đầy hoặc Caro online chưa ghi được sự kiện trước khi backend khởi động lại. Các cột p50/p95 là ước lượng theo nhóm độ trễ. Dung lượng DB là tổng kích thước các bảng Nhà Chơi, có cả chỉ mục, và không đại diện hạn mức Neon. Sau khi xóa, PostgreSQL có thể giữ phần không gian đã cấp phát để tái sử dụng.

Để kiểm tra chức năng dọn, chọn loại và mốc thời gian, xem trước rồi xác nhận từng lô. Chạy kiểm thử PostgreSQL trên một instance thử qua Unix socket ở cổng 55474. Không dùng socket dữ liệu thật.

```sh
ADMIN_TEST_PG_SOCKET=/path/to/test/socket npm run test:admin-database
```

Nếu reverse proxy gom lưu lượng về cùng địa chỉ kết nối, giới hạn `/api/telemetry` theo từng client tại proxy và đặt `TELEMETRY_PEER_LIMIT` phù hợp với lưu lượng từ proxy (mặc định 30 yêu cầu/phút, tối đa 1.000). Backend dùng địa chỉ kết nối trực tiếp, không tin header IP do client gửi.
