# Vườn Hoa — thiết kế đã duyệt

Người dùng yêu cầu thêm trò chơi lấy cảm hứng từ Blossom Blast Saga, chọn cả chế độ gọn và mở rộng, yêu cầu hoa có khối 3D/hiệu ứng rồi chốt thao tác kéo đổi chỗ kiểu Candy Crush. Bản xem trước ghép 3 đã được duyệt ngày 21/11/2026. Tài liệu này thay thế đề xuất kéo nối hoa trước đó.

## Cách xây dựng

Một lõi luật phục vụ hai chế độ, cùng giao diện web/PWA và native hiện có. Dùng lại Dialog, Icon, navigation và thư viện đã cài; không thêm dependency/backend, tài khoản, tiền tệ, quảng cáo hoặc mua vật phẩm.

Bản gọn riêng có thể đưa vào chơi sớm nhưng sẽ trùng logic với bản mở rộng. Người dùng chọn cả hai, nên chúng nằm trong cùng trò chơi Vườn Hoa và giữ bản lưu độc lập.

## Vòng chơi được duyệt

Bàn 7 × 7, năm loài hoa khác màu và hình cánh. Kéo một hoa sang ô liền kề theo bốn hướng; cũng có thể nhấp/chọn hai ô hoặc dùng bàn phím. Kéo chéo, kéo ra ngoài và hủy pointer không tạo nước đi. Ghép ít nhất ba hoa cùng loại theo hàng ngang hoặc dọc; đổi không tạo hàng ghép được trả về và không mất lượt.

Một nước hợp lệ mất một lượt. Hoa ghép nổ; hoa phía trên rơi trong từng đoạn cột bị chia bởi vật cản, bổ sung hoa mới và giải quyết các hàng ghép phát sinh. Mỗi hoa thường được thu hoạch tính 30 điểm nhân số đợt combo trong nước; mục tiêu thu hoạch tính từng hoa một lần trong mỗi đợt. Thắng được xét trước hết lượt. Hết nước hợp lệ thì xáo hoa thường, giữ vật cản/cỏ và không tiêu lượt.

Không dùng luật phát triển/nối chuỗi trong đề xuất ban đầu. Tạo vật phẩm đặc biệt từ hàng 4/5 hoa nằm ngoài phạm vi hiện tại.

## Hai chế độ

**Chơi nhanh:** 20 lượt, mục tiêu 1.500 điểm; không vật cản/vật phẩm. Chơi lại và tiếp tục ván dở độc lập với Hành trình.

**Hành trình:** bản đồ 12 màn, mở lần lượt. Mỗi màn có mục tiêu và cấu hình vị trí cỏ/đá/nụ cố định, hoa thường sinh ngẫu nhiên.

| Màn | Lượt | Mục tiêu | Vật cản |
| --- | --- | --- | --- |
| 1 | 20 | 800 điểm | Không |
| 2 | 20 | 18 hoa hồng | Không |
| 3 | 22 | 15 hoa hồng và 15 cúc vàng | Không |
| 4 | 22 | 1.500 điểm | 4 cỏ |
| 5 | 24 | Dọn 6 cỏ | 6 cỏ |
| 6 | 24 | 24 lưu ly | 6 cỏ |
| 7 | 25 | Phá 4 đá | 4 đá |
| 8 | 25 | 2.000 điểm | 4 cỏ, 4 đá |
| 9 | 26 | Làm nở 2 nụ lớn | 2 nụ lớn |
| 10 | 26 | Dọn 4 cỏ và phá 4 đá | 4 cỏ, 4 đá |
| 11 | 28 | Làm nở 3 nụ lớn | 3 nụ lớn, 4 cỏ |
| 12 | 30 | Làm nở 3 nụ lớn và 2.500 điểm | 3 nụ lớn, 4 cỏ, 4 đá |

Cỏ là lớp dưới hoa, được dọn khi hoa trên ô bị thu hoạch, thưởng 50 điểm. Đá hai sức bền và nụ lớn bốn sức bền, không đổi chỗ được, chặn rơi. Mỗi hoa ghép thật sự ở ô sát cạnh gây một sát thương cho chúng; các ô ghép khác nhau được tính riêng. Phá đá/nụ thưởng 100/200 điểm rồi ô trở thành hoa thường.

Hành trình cấp một Xẻng và một Bình tưới mỗi lần thử màn, không tiêu lượt. Xẻng thu hoạch một hoa hoặc gây một sát thương trực tiếp lên một vật cản. Bình tưới thu hoạch một hoa cùng các hoa cùng loại ngay sát cạnh. Thu hoạch trực tiếp bằng vật phẩm không tự gây sát thương lên vật cản cạnh bên; các hàng ghép phát sinh sau khi hoa rơi vẫn gây sát thương bình thường. Chỉ thực hiện vật phẩm khi thả/chọn ô hợp lệ; có thể hủy trước khi dùng.

Đạt tất cả mục tiêu được một sao; còn ít nhất 20%/40% lượt được hai/ba sao. Điểm tốt nhất và số sao tốt nhất được giữ độc lập, không giảm khi chơi lại. Hoàn thành màn 12 hiện trạng thái hoàn tất và tiếp tục cho chơi lại.

## Giao diện

Giữ nền giấy, chữ và phong cách xanh Nhà Chơi. Hoa có nhiều lớp cánh, nhụy nổi, ánh sáng/bóng và góc nghiêng để tạo cảm giác 3D. Hiệu ứng phản hồi lúc nhấc hoa, đổi chỗ, nổ, rơi và combo; tôn trọng prefers-reduced-motion. Không cần tải ảnh/font/mô hình từ mạng.

Trang chủ/thanh trò chơi có Vườn Hoa. Màn vào có Chơi nhanh, Hành trình, Tiếp tục cho mỗi chế độ khi có bản lưu và hướng dẫn. Bản đồ có trạng thái khóa, sao và điểm tốt nhất. Bàn chơi có mục tiêu, lượt, điểm, vật phẩm, gợi ý và trạng thái lưu. Kết quả có chơi lại, màn tiếp và về bản đồ/chọn chế độ. Vào bàn chơi và Back dùng luồng điều hướng hiện có.

Bàn vừa màn 375px, không tràn ngang; mục tiêu ở bên cạnh trên desktop và phía trên trên điện thoại. Nhãn ô gồm tọa độ, loài hoặc sức bền vật cản. Có focus rõ, chọn bằng Enter/Space, di chuyển bằng mũi tên, Shift+mũi tên đổi ô, Escape hủy. Thông báo nước đi và kết quả qua vùng live; dùng Dialog hiện có cho thay thế bản lưu và luật chơi.

## Lưu và tích hợp

Lõi luật ở `packages/game-core/src/flower.ts`, export qua index. Giao diện/lưu riêng ở `apps/web/src/flower/`. Cập nhật App, Home, kiểm thử và README; không thay protocol/server.

Khóa `nha-choi-flower-offline-v1` có phiên bản, tiến độ 12 màn và một ván mỗi chế độ. Kiểm tra schema và tính nhất quán của bàn, vật cản, mục tiêu, số lượt/vật phẩm, trạng thái và tiến độ khi đọc/ghi. Bản hỏng không tự bị ghi đè. Xác nhận rõ toàn bộ bản ghi sẽ được đặt lại nếu người dùng bắt đầu mới từ dữ liệu hỏng.

Lưu trạng thái cuối sau mỗi nước/vật phẩm trước khi chạy hiệu ứng; tải lại hoặc rời màn giữa hiệu ứng giữ được nước đã chấp nhận. Nếu ghi lỗi, giữ ván trong bộ nhớ, hiện lỗi và cho thử lưu lại; điều hướng nội bộ giữ màn Vườn Hoa đã mở. Tải lại/đóng ứng dụng khi chưa ghi thành công vẫn có thể mất phần chưa lưu.

Một giao dịch IndexedDB readwrite tuần tự hóa so sánh/ghi localStorage giữa các tab. Khi nhận thay đổi từ tab khác, dừng thao tác và các lần ghi cũ chờ người dùng tải bản mới hoặc xác nhận thay thế bằng ván trên trang này. Bản lưu của trò khác không bị sửa.

## Kiểm chứng và giới hạn

Kiểm thử core cho ghép, đổi ô, cascade, sát thương, rơi theo đoạn, goals, lượt cuối, vật phẩm, sinh bàn/xáo hữu hạn và bất biến input. Kiểm thử storage cho schema, lỗi quota, dữ liệu hỏng, tiến độ và ghi đồng thời. UI/browser kiểm tra các điểm vào, thắng/thua/tiếp tục, thay thế bản lưu, chuột/cảm ứng/bàn phím, viewport nhỏ, offline và khả năng tiếp cận. Kiểm tra hồi quy Caro/Cờ tỷ phú.

Một nước giới hạn 30 đợt cascade trước khi làm mới hoa thường; không treo với nguồn ngẫu nhiên hằng. Bàn có nước đi không bảo đảm mọi ván ngẫu nhiên có thể đạt mục tiêu. Cần cân bằng qua chơi thử. Không tuyên bố đã nghiệm thu máy Android/iOS thật hoặc phát hành Store chỉ từ kiểm tra trình duyệt.

## Bổ sung đã duyệt ngày 24/11/2026: Vườn khóa bí ẩn

Thêm chế độ riêng `mystery`, cùng mục tiêu Chơi nhanh (20 lượt/1.500 điểm) và ô lưu độc lập. Đầu ván, 4–6 ô thường được chọn ngẫu nhiên để khóa; mỗi khóa nhận ngẫu nhiên loại và bộ đếm 2–4. Khóa theo lượt chỉ giảm một lần sau nước đổi hợp lệ đã giải quyết hết combo. Khóa theo nổ giảm một lần mỗi đợt ghép có ít nhất một hoa sát cạnh theo bốn hướng; nhiều hoa cùng đợt không trừ nhiều lần.

Khóa và màu hoa bên dưới đứng cố định, chặn đổi chỗ/ghép/rơi và được giữ khi xáo bàn. Mở khóa không tự thu hoạch hoa hoặc thưởng điểm; hoa vừa lộ có thể tạo ghép và combo tự nhiên. Không có vật phẩm trong chế độ này. Hướng dẫn, nhãn đọc màn hình và chú giải phân biệt rõ hai cách mở; ô khóa hiển thị số còn lại và hiệu ứng khi mở. Ván cũ được nạp với `mystery: null`, không sửa bản lưu chỉ vì đọc.
