# Dashboard quản trị Nhà Chơi

Dashboard giúp chủ ứng dụng theo dõi lượng truy cập, số ván Caro và Cờ tỷ phú, dung lượng PostgreSQL và tốc độ phản hồi. Chủ ứng dụng có thể xem trước và dọn dữ liệu thống kê chi tiết quá 30 ngày. Bản đầu phục vụ một quản trị viên và nằm trong repo Nhà Chơi.

## Phương án

Tích hợp giao diện vào ứng dụng web và đặt API trong backend hiện tại. Dùng PostgreSQL cho lịch sử thống kê. Phương án này dùng lại hạ tầng hiện có và đặt thống kê trò chơi, sức khỏe hệ thống và công cụ dọn dẹp tại cùng một địa chỉ.

Một công cụ giám sát bên ngoài có thể cung cấp biểu đồ hiệu năng nhanh hơn, nhưng vẫn cần tích hợp sự kiện ván và xây chức năng dọn dẹp riêng. Quyết định cho bản đầu là tích hợp trong repo.

## Truy cập dashboard

Mở trực tiếp `https://<tên-miền-web>/admin` và đăng nhập bằng tài khoản quản trị duy nhất. Các đường dẫn con có thể mở trực tiếp và tải lại trên môi trường triển khai. Khu quản trị dành cho trình duyệt, không cần nhúng vào giao diện chơi hoặc bản cài mobile.

| Trang | Nội dung |
| --- | --- |
| `/admin` | Tổng quan truy cập, ván bắt đầu và hoàn thành, dung lượng và độ trễ |
| `/admin/traffic` | Lượt xem, số phiên, hoạt động trong 5 phút gần nhất và phân bố theo nền tảng |
| `/admin/games` | Bắt đầu, hoàn thành theo trò chơi và chế độ, số ván online đang diễn ra |
| `/admin/system` | Dung lượng và số bản ghi theo nhóm bảng, RAM backend, độ trễ và lỗi |
| `/admin/cleanup` | Xem trước, xác nhận dọn và xem lịch sử thao tác |

Bộ lọc mặc định gồm hôm nay, 7 ngày và 30 ngày. Tính ngày theo múi giờ Việt Nam. Hiển thị thời điểm cập nhật, trạng thái chưa có mẫu và lỗi tải dữ liệu riêng biệt.

Thông tin đăng nhập và khóa phiên chỉ ở backend. Dùng HTTPS và cookie phiên có hạn, gửi cùng origin qua đường dẫn API quản trị. Backend kiểm tra quyền trên mọi API admin, giới hạn lần thử đăng nhập, chống yêu cầu xóa phát sinh từ trang khác và không để cache dữ liệu admin trong PWA. Tải lại trang hay nhập URL trực tiếp vẫn yêu cầu phiên hợp lệ. Thêm chuyển tiếp API cùng origin ở Vite và môi trường triển khai web. Bản cài mobile gửi sự kiện thống kê qua địa chỉ backend HTTPS đã cấu hình, với origin được cho phép và không dùng phiên admin.

## Cách đo

- **Truy cập** — Đếm lượt mở màn hình chính trong khu chơi, loại các trang admin. Tạo mã phiên ngẫu nhiên, bắt đầu phiên mới sau 30 phút không hoạt động. Đếm hoạt động gần đây theo số phiên ẩn danh báo hoạt động trong 5 phút, chỉ báo khi ứng dụng ở tiền cảnh và có mạng. Phân loại web, PWA, Android, iOS khi ứng dụng nhận diện được. Giữ loại màn hình và nền tảng theo danh sách cố định. Không gửi tên người chơi, mã phòng, nội dung bản lưu, địa chỉ IP hoặc URL đầy đủ trong sự kiện.
- **Ván online** — Đếm Cờ tỷ phú khi bắt đầu ván thành công và khi luật xác định kết thúc. Ghi sự kiện cùng giao dịch cập nhật checkpoint để phòng tự hết hạn vẫn còn thống kê. Với Caro, tính lúc vòng nhận nước đi hợp lệ đầu tiên và lúc có kết quả thắng hoặc hòa. Mỗi vòng chơi lại là một ván, dùng mã phòng nội bộ và số vòng để chống đếm trùng. Lưu sự kiện Caro vào kho thống kê qua hàng đợi có giới hạn trong RAM và gửi lại với cùng khóa khi DB tạm lỗi. Caro tiếp tục chơi trong thời gian đó. Có thể mất sự kiện chưa lưu nếu backend khởi động lại hoặc hàng đợi đầy. Theo dõi số lỗi ghi và số sự kiện bị bỏ. Phòng chờ, kết nối lại và đóng phòng do hết hạn không tạo lượt bắt đầu hoặc hoàn thành. Ván đang diễn ra là ảnh chụp trạng thái online tại thời điểm xem.
- **Ván offline** — Gắn mã ổn định vào bản lưu hiện có, giữ nguyên qua lần mở lại. Cờ tỷ phú tính khi khởi tạo ván mới và khi đạt kết quả theo luật. Caro tính ở nước đi hợp lệ đầu tiên và lúc thắng hoặc hòa. Ván đã có từ trước được gắn mã khi tiếp tục và chỉ ghi phần thực sự quan sát được từ lúc bật thống kê. Thiết bị lưu sự kiện theo hàng đợi cục bộ, đồng bộ theo lô khi có mạng và chỉ bỏ sự kiện sau khi backend xác nhận hoặc báo đã ngoài thời hạn. Chống trùng từng mốc bằng khóa ổn định. Dashboard cho biết đây là số liệu do thiết bị báo về và có thể đến muộn.
- **Hiệu năng** — Đo thời gian backend xử lý lệnh chơi, gồm chờ hàng đợi và thao tác lưu nếu có. Đo thời gian DB riêng và thời gian từ gửi lệnh đến nhận phản hồi ở thiết bị. Hiển thị p50, p95, số mẫu và tỷ lệ lỗi kỹ thuật theo nguồn đo. Lệnh bị luật từ chối không tính là lỗi hệ thống. RAM của tiến trình backend hiển thị riêng với dung lượng lưu trữ DB.
- **Database** — Chỉ thống kê các bảng thuộc Nhà Chơi. Tính dung lượng bảng và chỉ mục, bao gồm phần lưu dữ liệu lớn, và ghi rõ số bản ghi dùng ước lượng hay số đếm thực tế. Chụp mốc dung lượng theo ngày khi backend đã hoạt động, để trống ngày thiếu mẫu và tránh đánh thức Neon chỉ để lấy mẫu. Số đo này thể hiện dung lượng trong PostgreSQL, không suy ra quota của nhà cung cấp.

API nhận sự kiện từ thiết bị kiểm tra loại, kích thước, số lượng và thời gian, giới hạn tần suất và dùng khóa chống trùng trước khi tăng bộ đếm. Các lần gửi lỗi không cản thao tác chơi. Tách số liệu do server xác nhận khỏi số liệu tự báo cáo. Lịch sử bắt đầu từ khi triển khai, không suy diễn lượt chơi cũ từ checkpoint.

## Giữ và dọn dữ liệu

Giữ chi tiết ít nhất 30 ngày kể từ thời điểm sự kiện. Sau mốc đó, bản ghi đủ điều kiện để quản trị viên dọn thủ công. Cho phép gửi lại sự kiện offline trong cùng cửa sổ 30 ngày. Backend từ chối mốc ngoài cửa sổ theo đồng hồ server, kiểm tra lệch giờ và duy trì khóa chống trùng trong suốt cửa sổ nhận. Bản lưu thiết bị vẫn chơi được khi sự kiện quá hạn. Nếu ván bắt đầu trước cửa sổ và kết thúc trong cửa sổ, vẫn ghi mốc kết thúc quan sát được.

Khi nhận sự kiện mới, cập nhật chi tiết và tổng hợp ngày trong cùng giao dịch chống trùng. Giữ thống kê ngày lâu dài và dùng nhóm độ trễ để tính p50/p95 trên nhiều ngày. Dọn chi tiết không làm thay đổi tổng hợp. Dữ liệu đo có thể đến muộn trong cửa sổ nhận, nên các ngày gần đây có thể được cập nhật.

Trang Dọn dữ liệu cho chọn nhóm sự kiện và mốc thời gian đủ điều kiện. Xem trước hiển thị phạm vi, số bản ghi và dung lượng ước tính. Khi xác nhận, backend kiểm tra lại tuổi và nhóm dữ liệu, chỉ áp dụng phạm vi đã xem, ghi số bản ghi thực xóa và thời điểm vào nhật ký. Xóa theo lô giới hạn, có thể thử lại và báo rõ nếu mới xử lý một phần. Chỉ cho phép dọn bảng thống kê chi tiết. Vòng đời phòng, checkpoint dùng để khôi phục, lease backend và bản lưu trên thiết bị tiếp tục do cơ chế trò chơi quản lý. Dashboard phân biệt số bản ghi đã xóa với dung lượng PostgreSQL giải phóng thực tế.

## Nghiệm thu

- Các trang admin tải trực tiếp theo URL. Người chưa đăng nhập không đọc dữ liệu hoặc dọn được.
- Chơi Caro và Cờ tỷ phú ở cả hai chế độ cho ra số đếm tương ứng. Kiểm tra tải lại, nối lại phòng, chơi lại Caro, gửi lại lô offline và chuyển từ không mạng sang có mạng.
- Dashboard phân biệt thời gian xử lý backend, thời gian DB và phản hồi thiết bị. Thiếu mẫu hiển thị rõ ràng.
- Dọn bằng bộ dữ liệu thử có cả bản ghi cũ và mới. Kiểm tra xem trước, xác nhận, thử lại, số liệu tổng hợp và phòng có thể khôi phục sau thao tác.
