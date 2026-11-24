# Vườn Hoa

Vào **Nhà Chơi → Chơi Vườn Hoa**. Chọn **Chơi một ván** hoặc **Khám phá khu vườn**. Không cần máy chủ, tài khoản hay tải ảnh ngoài.

## Chơi

- Kéo một hoa sang ô cạnh bên theo bốn hướng. Có thể nhấp lần lượt hai ô, hoặc tập trung vào ô và dùng Shift + phím mũi tên. Phím mũi tên di chuyển tiêu điểm; Enter/Space chọn ô, Escape hủy chọn.
- Ghép từ ba hoa theo hàng ngang/dọc. Nước không tạo hàng ghép quay về, không mất lượt. Một nước hợp lệ tốn một lượt, có thể tạo nhiều combo sau khi hoa rơi.
- Chơi nhanh có 20 lượt để đạt 1.500 điểm. Hành trình có 12 màn với mục tiêu điểm, thu hoạch từng loài, dọn cỏ, phá đá hoặc làm nở nụ lớn. Phải đạt tất cả mục tiêu; nước cuối vẫn có thể thắng.
- Cỏ được dọn khi hoa ngay trên nó bị ghép. Mỗi hoa ghép sát cạnh gây một sát thương cho đá/nụ lớn. Đá có hai sức bền, nụ lớn có bốn; chúng chặn đổi chỗ và chia đoạn rơi trong cột.
- Mỗi lần thử màn Hành trình có một Xẻng và một Bình tưới, không tốn lượt. Xẻng thu hoạch một hoa hoặc gây một sát thương cho vật cản. Bình tưới làm nở một hoa và các hoa cùng loại ngay sát nó.
- Hoàn thành màn mở màn kế tiếp. Còn ít nhất 40%/20% số lượt được ba/hai sao; còn ít hơn được một sao. Chơi lại giữ số sao và điểm cao nhất độc lập.

## Lưu và khôi phục

Khóa localStorage `nha-choi-flower-offline-v1` giữ tiến độ 12 màn và một ván cho mỗi chế độ. Không dùng khóa của Caro/Cờ tỷ phú. Chỉ lưu trạng thái bàn đã giải quyết xong; hiệu ứng phát sau khi ghi bản cuối. Rời giao diện hay tải lại giữa hiệu ứng không làm mất nước đã chấp nhận.

Bản lưu được kiểm tra cấu trúc, phiên bản, vị trí và sức bền vật cản, số lượt/vật phẩm, trạng thái thắng/thua, nước còn đi được và tiến độ mở màn. Bản hỏng không tự bị ghi đè khi mở game. Bắt đầu mới cần xác nhận nếu có ván dở hoặc lỗi đọc bản lưu.

Nếu thiết bị không ghi được, trò chơi giữ ván trong bộ nhớ, báo lỗi và có nút Thử lưu lại. Ván vẫn ở bộ nhớ khi quay về Nhà Chơi trong cùng lần mở ứng dụng; đóng hoặc tải lại trước khi lưu thành công sẽ mất phần chưa ghi được. Hai tab thay đổi cùng bản lưu sẽ dừng thao tác cho tới khi chọn Tải bản lưu mới hoặc xác nhận dùng ván của trang hiện tại.

## Phạm vi kỹ thuật

Lõi luật ở `packages/game-core/src/flower.ts`; cấu hình cả 12 màn nằm trong `FLOWER_LEVELS`. UI ở `apps/web/src/flower/`, dùng chung web/PWA và native. Hoa có phong cách 3D bằng cánh nhiều lớp, ánh sáng, bóng và chuyển động CSS; không tải mô hình/ảnh từ mạng. Tôn trọng prefers-reduced-motion.

Sinh/xáo bàn dùng số lần thử hữu hạn và nguồn dự phòng xác định cho nguồn ngẫu nhiên hằng. Một nước giới hạn 30 đợt combo, sau đó làm mới hoa thường và giữ vật cản/cỏ. Game không tạo vật phẩm đặc biệt từ hàng 4/5 hoa và không có dịch vụ online.

## Kiểm chứng

Kiểm tra ngày 22/11/2026:

- `npm test`: 171 passed, 1 skipped (kiểm tra database thật có điều kiện từ trước).
- `npm run typecheck`, `npm run lint`, `npm run build`: thành công.
- Chromium: 17/17 luồng Vườn Hoa, Caro, Cờ tỷ phú offline và accessibility thành công.
- WebKit: 6/6 luồng Vườn Hoa thành công.
- Mô phỏng tự động: hoàn thành được cả 12 màn. Đây là kiểm tra có thể hoàn thành, không phải bảo đảm mọi bàn ngẫu nhiên đều thắng.

Bằng chứng và các quyết định triển khai ở `docs/superpowers/plans/2026-11-21-flower-garden.md`.

Chưa nghiệm thu hiệu năng trên điện thoại Android/iOS thật hoặc phát hành Store. Bàn sinh ngẫu nhiên có nước đi nhưng không bảo đảm mọi ván đều có thể đạt mục tiêu; độ khó từng màn cần tiếp tục cân bằng qua chơi thử.

## Vườn khóa bí ẩn — thêm ngày 24/11/2026

Trong Vườn Hoa, chọn **Chơi Vườn khóa bí ẩn**. Chế độ này có bản lưu riêng, 20 lượt và mục tiêu 1.500 điểm. Mỗi ván khóa ngẫu nhiên 4–6 ô; mỗi ô nhận ngẫu nhiên một điều kiện và bộ đếm từ 2–4:

- **Khóa xanh, biểu tượng đồng hồ:** giảm một sau mỗi nước đổi hợp lệ, vào cuối lượt sau khi các combo đã xong. Nước sai, gợi ý hoặc thao tác bị hủy không giảm bộ đếm.
- **Khóa vàng, biểu tượng tia nổ:** giảm một khi một đợt ghép có hoa sát cạnh khóa theo hàng/cột. Ghép chéo không tính. Nhiều hoa cùng chạm khóa trong một đợt vẫn chỉ tính một; các đợt combo tiếp theo được tính riêng.

Ô khóa đứng cố định, chặn đổi chỗ, ghép và hoa rơi. Cả khóa lẫn màu hoa phía dưới được giữ khi xáo bàn. Hết bộ đếm thì khóa mở, không thưởng điểm trực tiếp; hoa lộ ra có thể tạo hàng ghép mới và tiếp tục combo. Khóa lượt chỉ giảm một lần trong cả nước, kể cả các combo sau khi mở khóa. Chế độ này không có vật phẩm hỗ trợ.

Bản lưu v1 cũ tự nhận ô lưu `mystery: null` khi đọc, không bị ghi lại chỉ vì mở game. Ván Chơi nhanh/Hành trình và tiến độ 12 màn được giữ khi thêm ván mới. Nút **Tiếp tục Vườn khóa bí ẩn** khôi phục đúng vị trí, màu hoa, loại khóa và bộ đếm. Nhãn đọc màn hình gồm tọa độ, loại khóa, số còn lại và tên hoa phía dưới.

Kiểm chứng bổ sung ngày 24/11/2026: toàn repo 244 kiểm thử đạt, một kiểm thử DB có điều kiện được bỏ qua; 8/8 luồng Vườn Hoa trên Chromium và 8/8 trên WebKit đạt. Typecheck, lint và build đạt. Có kiểm thử riêng cho khóa cố định khi xáo, nổ nhiều đợt, mở khóa gây combo, bộ đếm chỉ giảm một lần mỗi lượt và tương thích bản lưu cũ.

Bản chuẩn bị đưa lên `main` ngày 24/11/2026 được tích hợp trên nền `71ed054`, giữ các cập nhật quản trị, Caro, Lò Gốm và Dino đã có. Kiểm tra trên cây phát hành: 257 kiểm thử đạt, 4 kiểm thử tích hợp có điều kiện được bỏ qua; typecheck/lint/build đạt. Trang Vườn Hoa dùng loại màn `game` trong telemetry hiện có. Nhãn menu Dino dùng nội dung hiển thị làm tên truy cập để qua kiểm tra accessibility; kiểm thử kết quả Vườn Hoa chờ tối đa thời lượng combo được cho phép.

Bản phát hành được kiểm tra lại với 22/22 luồng Chromium (Vườn Hoa, Caro, Cờ tỷ phú offline, accessibility) và 8/8 luồng Vườn Hoa trên WebKit.
