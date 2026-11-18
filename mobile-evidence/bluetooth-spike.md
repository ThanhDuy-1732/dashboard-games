# B2 — Bluetooth chưa được kiểm chứng

Người dùng xác nhận ngày 18/11/2026 chưa có thiết bị thật để thử. Môi trường hiện có Android emulator và iOS simulator, không thể dùng để nghiệm thu BLE peripheral/GATT hoặc Bluetooth giữa hai hệ điều hành.

## Đã thực hiện độc lập với radio

Codec nhị phân version 1, messageId uint32, chunkIndex/chunkCount uint16, totalLength uint32; network byte order, header 13 byte. Caller cung cấp giới hạn payload thực của kết nối, không giả MTU 512. Một message tối đa 32 KiB; mỗi peer tối đa 2 message dở dang, hạn 10 giây. Tối đa 6 peer; dropPeer/clear giải phóng khi rời phòng/dừng. Cache ID hoàn tất có giới hạn để không giao message hai lần trong cửa sổ retry.

7 kiểm tra codec: giới hạn frame theo payload 20/64/182/244/512, đảo thứ tự, trùng chunk/message, thiếu frame, quá cỡ, hết hạn, cách ly peer, header sai, xung đột chunk và giải phóng tài nguyên. Đây là kiểm tra dữ liệu, **không phải bằng chứng radio**. Chỉ dùng codec cho control messages/projections, không truyền ảnh. Adapter tương lai chỉ nhận peer đã được xác thực/chấp thuận.

## Chưa làm / chưa đạt

Chưa tích hợp plugin BLE hoặc bật chế độ Bluetooth trong app. Việc chọn MTU, backpressure, bảo vệ phiên và topology cần được đo bằng spike thực tế trước khi trở thành tính năng chơi game. Không tự thay BLE bằng Wi-Fi/internet, không giảm mục tiêu còn 2 người.

Cần thiết bị: Android↔Android, iOS↔iOS, Android↔iOS; luân phiên host khi phần cứng cho phép. Thử 2 người trước, 3 người hỗn hợp rồi 6 người. Tắt Wi-Fi/internet, gửi 100 commands/snapshots mỗi peer, reconnect 10 lần; ghi model/OS/host, MTU, permission, lỗi, p95 và thời gian snapshot. Tiêu chí đề xuất command/view p95 <2s, snapshot <=32 KiB <10s chưa có số đo.

B3 và MOBILE-PASS giữ chưa đạt. Các kiểm tra vòng đời native không phụ thuộc radio có thể tiếp tục riêng; không suy diễn từ mô phỏng thành Bluetooth hoạt động.
