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

Web mặc định kết nối cùng origin; Vite dev/preview proxy `/socket.io` tới 127.0.0.1:3001 (đổi bằng BACKEND_PROXY_URL khi khởi động Vite). Nếu backend khác origin, đặt VITE_SERVER_URL trong `apps/web/.env.local` trước build và thêm origin web vào allowlist backend. Biến VITE_* là dữ liệu công khai trong gói; không đặt khóa bí mật ở đây. Root `.env.example` là hướng dẫn, server đọc biến từ môi trường, không tự nạp root .env.

Chỉ ngắt mạng sau thông báo đã sẵn sàng offline. Toàn bộ 26 ảnh, credits và luật đã được đóng gói; chỉ chế độ với máy hoạt động khi offline. Trình duyệt có thể thu hồi dữ liệu website nếu người dùng xóa hoặc thiếu dung lượng; bản lưu nằm trên thiết bị, không đồng bộ tài khoản.

Cập nhật: xuất bản bản build mới cùng tất cả assets. Không xóa assets của bản đang dùng ngay lập tức. Ứng dụng thông báo có bản mới, chặn cập nhật khi còn trong phiên chơi; lưu/rời ván rồi bấm cập nhật. IndexedDB độc lập cache PWA. Cache bản cũ được giữ để các tab cũ tiếp tục hoạt động; hiện chưa tự dọn theo tuổi, có thể tăng dung lượng qua nhiều bản cập nhật. Không yêu cầu người dùng xóa dữ liệu website để cập nhật vì sẽ xóa ván lưu.

## Mất kết nối và dừng máy chủ

Mất mạng của người còn chơi làm cả ván online tạm dừng. Cùng tab có thể tải lại hoặc vào Chơi online → Kết nối lại phòng trước. Phiên lưu trong sessionStorage; đóng tab có thể mất khả năng lấy lại ghế. Kết nối mới dùng cùng phiên sẽ thay kết nối cũ. Sau 120 giây, người còn lại có quyền kết thúc không người thắng. Không tự thay bằng máy hoặc tính phá sản.

Phòng chờ trống xóa ngay; ghế lobby mất mạng giữ 120 giây rồi chuyển chủ; lobby không hoạt động 30 phút sẽ đóng. Ván có người kết nối không tự hết hạn; ván toàn bộ offline đóng sau 30 phút. Ván kết thúc giữ 10 phút. Khởi động lại backend mất ván online; bản offline trên thiết bị giữ nguyên.

Trước bảo trì, ngừng nhận phòng mới ở reverse proxy, thông báo người đang chơi và chờ ván hoàn tất khi có thể. SIGINT/SIGTERM gửi thông báo đóng ván không người thắng rồi đóng kết nối. Không có lưu bền online hoặc chuyển phòng qua process khác; không hứa khôi phục ván sau restart. Health check: GET /health.

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
