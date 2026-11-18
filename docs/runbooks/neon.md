# Neon — lưu bền phòng online

Backend dùng PostgreSQL/pg qua kết nối SSL xác minh chứng chỉ, bật channel binding. Web/PWA/mobile không kết nối database trực tiếp. Không cần ORM, Redis hoặc tài khoản người chơi cho phạm vi hiện tại.

## Cấu hình

Đặt DATABASE_URL trong biến môi trường của **backend**, hoặc root `.env` khi chạy cục bộ. Scripts dev:server/start tự nạp root .env bằng Node; biến đã đặt trên hosting được ưu tiên. `.env` bị gitignore và file local đặt quyền 0600. Không dùng tên VITE_DATABASE_URL, không đưa URL DB vào Vercel frontend hoặc mã nguồn.

```sh
npm ci
npm run build
npm run start --workspace @nha-choi/server
```

Backend tự tạo hai bảng riêng của ứng dụng bằng migration cộng thêm `apps/server/migrations/001_online_rooms.sql`: `nha_choi_room_checkpoints` và `nha_choi_backend_leases`. Không xóa/sửa bảng của ứng dụng khác. Role cần quyền tạo bảng lần đầu và đọc/ghi hai bảng này. Nếu chỉ triển khai dist, phải copy thư mục migrations bên cạnh dist. Không để PostgreSQL port/credential truy cập từ trình duyệt.

`NODE_ENV=production` yêu cầu DATABASE_URL; thiếu thì dừng thay vì âm thầm mất lưu bền. Chế độ phát triển/test không có DATABASE_URL vẫn dùng bộ nhớ, giữ giới hạn mất ván khi restart. `HOST=0.0.0.0`, PORT do hosting cung cấp; ALLOWED_ORIGINS chứa domain frontend. VITE_SERVER_URL là URL HTTPS của backend, **không phải URL PostgreSQL**.

## Dữ liệu và tính nhất quán

Mỗi phòng lưu một checkpoint version 1 gồm thành viên, hash của proof khôi phục, đầy đủ state/decks phía server và cache phản hồi tối đa 1.024 lệnh/người. Không lưu proof gốc. Các view công khai vẫn loại bỏ bài úp và thông tin khôi phục.

Hành động/đổi phòng được xếp hàng; chỉ trả thành công và phát trạng thái sau khi giao dịch PostgreSQL commit. Lưu chỉ các phòng thay đổi. Lỗi trước commit hoàn tác bộ nhớ. Mất phản hồi sau commit sẽ đọc lại DB cùng cache lệnh trước khi retry, không gieo lại hoặc thanh toán thêm. Gửi thông báo socket lỗi sau commit không được hoàn tác checkpoint đã lưu.

Mất DB: health trả 503, client bị tạm dừng, không nhận trạng thái chưa commit; server thử đọc lại dữ liệu và nối lại khi DB phục hồi. Client giữ proof qua lỗi tạm thời. Khôi phục lobby cũng bật lại trạng thái kết nối; không bắt đầu ván trên dữ liệu chưa xác nhận.

SIGINT/SIGTERM trong chế độ Neon lưu trạng thái mất kết nối và giữ ván để mở lại; không tự đóng ván không người thắng. Sau restart mọi người đều cần xác thực lại proof đang có. Người sống chưa trở lại làm ván tạm dừng; tính lại thời gian chờ từ lúc backend khôi phục để thời gian bảo trì không làm mất ván ngay. Ghế lobby 120s, game toàn bộ offline 30 phút, phòng kết thúc 10 phút vẫn áp dụng sau đó. Không tạo kho lịch sử vĩnh viễn trong giai đoạn này.

Proof hiện ở sessionStorage của tab; database không tạo khả năng lấy lại ghế nếu người dùng xóa/mất proof. Giữ cùng tab/phiên khi reconnect. Offline vẫn lưu IndexedDB tại thiết bị, không tải bản lưu offline lên DB.

## Một backend có quyền ghi

Lease PostgreSQL dùng thời gian database, hạn 45 giây, gia hạn tối đa mỗi 10 giây hoặc khi có thay đổi. Mỗi giao dịch kiểm tra đúng owner còn hạn trước khi ghi. Backend thứ hai cùng kho phòng bị từ chối; đây không phải hệ thống nhiều instance. Sau SIGKILL/mất điện có thể cần chờ lease cũ tối đa 45 giây trước khi khởi động lại; shutdown bình thường nhả lease ngay.

Heartbeat chạy khi còn phòng hoặc backend đang phục hồi sau lỗi. Khi không có phòng, backend ngừng truy vấn định kỳ để Neon có thể tự ngủ; lần thao tác tiếp theo đọc lại dữ liệu và quyền ghi. Phòng đang hoạt động vẫn giữ compute có truy vấn, cần theo dõi quota Neon. Không dùng session advisory lock hoặc SET phụ thuộc session, tương thích URL pooler. Không tự chọn provider hay triển khai backend trong tích hợp này.

Vercel có thể chạy frontend. Đưa nguyên trạng backend này vào Functions nhiều instance vẫn không phù hợp: cần thiết kế ownership/pub-sub và runtime riêng trước khi thay đổi mô hình. Database lưu bền không tự giải quyết định tuyến WebSocket.

## Kiểm tra

```sh
npm test
npm run test:database
```

Suite mặc định không dùng credential hoặc ghi Neon; live test chỉ chạy khi gọi test:database. Live test dùng scope UUID riêng, kiểm tra lưu/khôi phục qua hai lần khởi tạo backend độc lập, proof/receipt, từ chối writer thứ hai và dữ liệu sai; chỉ xóa chính dữ liệu test theo scope đó khi kết thúc. Không TRUNCATE/DROP hoặc thay đổi dữ liệu phòng thật. Credential không được in trong log/test report. Đã kiểm tra thêm tiến trình backend thật: tạo lobby, dừng bằng SIGINT, mở tiến trình mới, xác thực lại cùng ghế và rời phòng thử thành công.

Không dùng DATABASE_URL thật cho Preview Deploy frontend. Khi chạy bộ trình duyệt, Playwright đặt backend vào chế độ bộ nhớ riêng để không ghi dữ liệu thử lên DB thật.
