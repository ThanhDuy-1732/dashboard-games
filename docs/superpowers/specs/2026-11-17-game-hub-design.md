# Dashboard nhiều game và Cờ tỷ phú

Ngày: 17/11/2026
Trạng thái: Đã duyệt thiết kế và bản mẫu giao diện. Người dùng yêu cầu lập kế hoạch triển khai web/PWA trước, rồi dựng Android/iOS; lõi và giao diện dùng chung ngay từ đầu.

## 1. Mục đích và những gì đã thống nhất

Xây một cổng game dành cho mọi người. Cờ tỷ phú là game đầu tiên, dùng luật truyền thống. Sản phẩm có website, PWA, ứng dụng Android và iOS. Có ba chế độ: online nhiều người, Bluetooth giữa các thiết bị ở gần và offline một người đấu với máy.

Người dùng đã chọn dùng giao diện web làm nền cho ứng dụng mobile, bổ sung tích hợp nền tảng khi cần. Không tách thành hai bộ giao diện web và native độc lập.

Mục tiêu: người chơi chọn game, vào ván và hoàn thành được ván trên các nền tảng hỗ trợ chế độ tương ứng. Mọi chế độ dùng cùng luật và cách xác định thắng thua.

## 2. Các cách triển khai đã cân nhắc

1. **Giao diện web dùng chung, mobile có tích hợp native:** tái sử dụng giao diện và lõi luật; cần cầu nối native cho Bluetooth. Đây là hướng người dùng đã chọn để giảm công phát triển và bảo trì.
2. **Giao diện web và mobile riêng, dùng chung lõi luật:** tối ưu sâu theo thiết bị nhưng phải phát triển hai bộ giao diện. Chưa chọn vì chưa có nhu cầu giao diện native riêng.

Chưa chốt framework hoặc thư viện Bluetooth. Không mặc định Web Bluetooth là giải pháp kết nối giữa các điện thoại.

## 3. Phạm vi bản đầu — các mặc định đã duyệt

Các mặc định sau nằm trong bản thiết kế đã được người dùng duyệt. Cập nhật mới nhất: ảnh địa điểm đã được bổ sung vào bản mẫu; web được triển khai và nghiệm thu trước khi dựng mobile.

- Giao diện tiếng Việt, dùng được trên màn hình điện thoại và máy tính; hỗ trợ thao tác chạm, bàn phím, nhãn truy cập và trạng thái không chỉ phân biệt bằng màu.
- Vào bằng tên hiển thị, chưa cần tài khoản. Phòng online riêng có mã và link mời; chưa có ghép trận công khai.
- Mỗi ván 2–6 người chơi. Online và Bluetooth gồm người thật; offline gồm một người và 1–5 đối thủ máy, ban đầu một mức độ khó.
- Online cho phép người dùng website, PWA, Android và iOS chơi chung qua internet.
- Bluetooth hướng tới Android ↔ Android, iOS ↔ iOS và Android ↔ iOS; mỗi người dùng một thiết bị. Sau khi cài đặt/tải nội dung, chế độ này không cần internet để chơi.
- Offline có lưu tự động trên thiết bị và tiếp tục ván. PWA phải được tải đủ nội dung ít nhất một lần trước khi chơi không có mạng. Không hứa lưu xuyên thiết bị hoặc giữ dữ liệu nếu người dùng xóa dữ liệu ứng dụng/trình duyệt.
- Chưa có mua bán bằng tiền thật, chat, bảng xếp hạng, skin, giải đấu, người xem, bot bổ sung vào phòng nhiều người hoặc công cụ tự tạo game.
- Dashboard chỉ có game đã chơi được; chưa tạo thẻ game giả hoặc nền tảng plugin cho những game tương lai.

## 4. Trải nghiệm chính

```text
Dashboard
└── Cờ tỷ phú
    ├── Online → Tạo / vào phòng → Sảnh chờ → Ván đấu → Kết quả
    ├── Bluetooth [mobile] → Tạo / tìm phòng → Sảnh chờ → Ván đấu → Kết quả
    └── Offline → Ván mới / tiếp tục → Ván đấu → Kết quả
```

Dashboard có thẻ Cờ tỷ phú và lối vào ván offline đã lưu. Sảnh chờ hiển thị người chơi, quân cờ, trạng thái sẵn sàng; chủ phòng bắt đầu khi đủ người và tất cả sẵn sàng.

Màn hình ván đấu hiển thị bàn cờ, người đang tới lượt, tiền và tài sản, nhật ký sự kiện và các hành động hợp lệ. Màn hình nhỏ có thể mở chi tiết tài sản/người chơi bằng bảng phụ. Dùng bàn cờ 2D cho bản đầu; hiệu ứng không được chặn thao tác hoặc là cách duy nhất thông báo kết quả.

Website/PWA không hiển thị Bluetooth như một chế độ dùng được; giải thích ngắn rằng cần ứng dụng mobile khi người dùng tìm tính năng này.

## 5. Luật Cờ tỷ phú — bộ quy tắc nền đề xuất

Dùng bộ luật truyền thống cố định cho bản đầu, không có bộ chỉnh luật phòng:

- Bàn 40 ô; 28 tài sản gồm 22 đất, 4 ga và 2 tiện ích. Hai xúc xắc sáu mặt, số dư ban đầu 1.500 đơn vị, qua ô xuất phát nhận 200.
- Mua tài sản chưa có chủ hoặc đưa ra đấu giá nếu từ chối mua. Có thu tiền thuê, nhóm màu, giao dịch tự nguyện giữa người chơi và thế chấp/giải chấp.
- Xây đều trên nhóm màu sở hữu đủ; mỗi đất tối đa 4 nhà trước khi nâng thành khách sạn. Ngân hàng có giới hạn 32 nhà và 12 khách sạn; không tự sinh thêm khi hết.
- Có ô thuế, Cơ hội, Khí vận, Nhà tù, Vào tù và Đỗ xe miễn phí. Đỗ xe miễn phí không nhận quỹ thưởng.
- Tung đôi được thêm lượt; ba lần đôi liên tiếp vào tù. Trong tù có các cách ra tù theo bộ luật: trả phí, dùng thẻ hoặc tung đôi trong tối đa ba lượt.
- Xử lý nợ bằng bán công trình/thế chấp theo luật; phá sản khi không thể thanh toán. Tài sản và tiền được chuyển/xử lý theo chủ nợ; người phá sản rời ván. Người cuối cùng chưa phá sản thắng; không giới hạn thời gian ván.
- Không thu tiền thuê cho tài sản đang thế chấp. Bán công trình và thanh lý phải giữ quy tắc xây đều; giao dịch cần hai bên xác nhận và được kiểm tra lại tại thời điểm thực hiện.

Người triển khai phải lập bảng luật, giá tài sản, tiền thuê và nội dung thẻ nhất quán trước khi lập trình; xử lý rõ đấu giá, thiếu nhà, nợ, nhà tù và phá sản. Các con số còn lại dùng một bộ luật truyền thống nhất quán, ghi trong hướng dẫn chơi và kiểm thử. Không thêm luật địa phương ngầm định.

Tên địa danh Việt Nam giữ theo bản mẫu đã duyệt. 22 ô phố và 4 nhà ga có ảnh cục bộ cùng tên địa điểm, tác giả, nguồn và giấy phép; hiện có 26 ảnh Wikimedia Commons ở `design/assets/locations/` và metadata `credits.json`. Dùng lại chúng trong sản phẩm, cả ở bàn cờ, mua/đấu giá và modal chi tiết; các ô chức năng dùng biểu tượng. Nội dung thẻ và hình nhận diện của dự án được tự viết/vẽ, không dùng thương hiệu hoặc bộ đồ họa trò chơi khác.

## 6. Cấu trúc hệ thống

- **Lõi luật dùng chung:** biểu diễn trạng thái ván, hành động hợp lệ, chuyển trạng thái và kết quả; không phụ thuộc giao diện, Bluetooth hoặc mạng.
- **Giao diện web dùng chung:** dashboard, sảnh chờ, bàn cờ và kết quả. PWA bổ sung cài đặt, cache nội dung và lưu offline; ứng dụng mobile đóng gói giao diện này và cung cấp tích hợp native.
- **Online:** một máy chủ quyết định trạng thái, lượt, xúc xắc và thẻ. Client gửi ý định hành động; máy chủ xác thực người chơi, lượt, dữ liệu và luật. Mã phòng dùng để tham gia, không thay cho quyền điều khiển người chơi.
- **Bluetooth:** thiết bị chủ phòng quyết định trạng thái và gửi cập nhật cho thiết bị còn lại. Dùng cầu nối native với giao diện game chung; quyền và thông báo lỗi theo nền tảng. Không yêu cầu backend để chơi.
- **Offline:** lõi luật chạy trên thiết bị, máy đưa ra hành động qua cùng bộ kiểm tra luật như người thật. AI phải xử lý đủ mua, đấu giá, xây dựng, thế chấp, giao dịch nhận được và thanh toán nợ; không cần AI học máy.
- Luật không bị sao chép thành ba bản theo chế độ. Mọi hành động có định danh/thứ tự để tránh áp dụng hai lần; kết nối lại nhận ảnh chụp trạng thái chuẩn. Dữ liệu lưu có phiên bản để tránh đọc sai sau cập nhật.

Không cần tạo hệ thống plugin, tổng quát hóa cho mọi thể loại game hoặc đồng bộ tài khoản ngay từ game đầu tiên.

## 7. Mất kết nối và dữ liệu

Mặc định đề xuất cho bản đầu:

- Online tạm dừng khi mất người chơi, cho kết nối lại bằng phiên bí mật đã cấp. Sau hai phút, người còn lại có thể chọn kết thúc ván không tính người thắng; chưa tự thay bằng bot. Chủ phòng rời không làm mất vai trò điều phối của server.
- Bluetooth tạm dừng và thử kết nối lại. Nếu thiết bị chủ phòng mất kết nối thì không tự bầu chủ mới; hiện lựa chọn thử lại hoặc kết thúc ván. Không âm thầm đổi sang internet.
- Lưu ván offline sau mỗi hành động hoàn tất, bảo toàn bản lưu trước nếu ghi thất bại và thông báo nếu không lưu được. Cập nhật ứng dụng không được tự ý xóa ván đang lưu.
- Bản đầu chưa cam kết khôi phục ván online/Bluetooth sau khi tiến trình chủ bị đóng. Thông báo giới hạn khi rời ván; không coi mất mạng là phá sản.
- Kiểm tra quyền truy cập phòng, giới hạn dữ liệu đầu vào và số lần yêu cầu; không ghi bí mật phiên vào log. Không gửi dữ liệu offline lên máy chủ nếu không cần.

## 8. Thứ tự triển khai và cổng kiểm chứng

Theo chỉ đạo mới nhất của người dùng, thiết kế cho cả web/mobile nhưng làm web trước rồi mới dựng mobile:

1. **Lõi luật dùng chung và web offline:** triển khai bộ luật truyền thống đầy đủ, UI đã duyệt, bot và lưu/tiếp tục ván.
2. **Web online và PWA:** phòng riêng 2–6 người, authority trên server, kết nối lại, cài PWA và dùng toàn bộ ảnh khi offline. Nghiệm thu web trước khi sinh project native.
3. **Dựng Android và iOS:** đóng gói cùng bản web, giữ nguyên lõi game, dữ liệu và UI; kiểm tra offline và online chơi chéo web.
4. **Kiểm chứng Bluetooth ngay đầu phần kết nối mobile:** thử cả ba cặp nền tảng bằng thiết bị thật, nhóm hỗn hợp và mục tiêu tối đa 6 người, không internet; kiểm tra quyền, ngắt/kết nối lại và background.
5. **Tích hợp Bluetooth đầy đủ và hoàn thiện mobile:** chỉ tích hợp vào ván thật sau khi có bằng chứng phù hợp; kiểm tra thiết bị thật, chuẩn bị gói thử nghiệm Android/iOS.

Việc hoãn spike Bluetooth tới giai đoạn mobile thay thứ tự ban đầu. Đây là rủi ro lịch thực hiện đã được nêu trong kế hoạch: web sẽ hoàn thành trước khi khả năng Bluetooth được chứng minh. Nếu thử nghiệm thiếu thiết bị, không chơi chéo được hoặc chỉ hỗ trợ ít người hơn yêu cầu 2–6, báo kết quả và thống nhất điều chỉnh riêng phần này; không tự thay bằng Wi-Fi hoặc bỏ một nền tảng.

Không coi web/PWA là hoàn thành toàn bộ dự án. Android và iOS đều nằm trong phạm vi; phát hành công khai lên cửa hàng cần thông tin tài khoản/chứng chỉ và yêu cầu phát hành riêng. Kế hoạch thực hiện nằm tại `docs/superpowers/plans/2026-11-17-game-hub-implementation.md`.

## 9. Tiêu chí nghiệm thu

- Ba chế độ cùng tuân thủ bộ luật đã ghi; kiểm thử các nhánh quan trọng: đấu giá, xây đều, giới hạn nhà, thế chấp, nhà tù, nợ và phá sản.
- Hoàn thành được ván offline với máy; mở lại tiếp tục đúng trạng thái đã lưu.
- PWA đã chuẩn bị dữ liệu chạy được khi ngắt mạng; mobile offline tương tự.
- Online chơi chéo web/Android/iOS; không thể điều khiển người khác hoặc gửi hành động ngoài lượt; kết nối lại không nhân đôi lượt/thanh toán.
- Bluetooth chơi được với thiết bị thật theo các cặp đã cam kết, không cần internet; kiểm tra nhóm tối đa dự kiến trước khi nghiệm thu.
- Giao diện dùng được trên điện thoại và máy tính; nội dung thông báo lượt, tiền và lỗi có thể tiếp cận bằng công cụ hỗ trợ.

## 10. Quyết định giao người triển khai

Chọn framework web, lớp đóng gói mobile, lưu trữ và thư viện truyền tải sau khi đối chiếu yêu cầu Bluetooth. Chọn cấu trúc thư mục, thuật toán bot đơn giản, giao diện 2D, nội dung gốc và chi tiết bộ luật còn thiếu theo các ràng buộc trên. Không tự mở rộng tính năng hoặc giảm nền tảng/chế độ.

Tại thời điểm lập thiết kế ban đầu, thư mục dự án trống, chưa có mã nguồn, dependency hoặc kho Git. Bản mẫu giao diện sau duyệt được lưu riêng trong `design/`, chưa triển khai hệ thống game.
