# WEB-PASS — 18/11/2026

A1–A10 đạt sau một vòng rà soát độc lập và sửa đủ 8 phát hiện. Đây là nghiệm thu web/PWA chạy cục bộ, chưa phải triển khai công khai hoặc nghiệm thu mobile/Bluetooth.

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: đạt. 88 kiểm tra unit/integration.
- `npm run test:e2e`: **24/24 đạt**, chạy bản production, tự khởi động backend và preview.
- Chromium 159.0.8154.6: 8/8; Firefox 159.0: 8/8; WebKit 27.2: 8/8.
- Mỗi trình duyệt kiểm tra offline lưu/rời/reload/tiếp tục; khôi phục nợ, tù, đấu giá và lượt máy; từ chối tab điều khiển thứ hai; online 2 và 6 ngữ cảnh trình duyệt riêng; giữ ghế sau reload.
- PWA: reload khi offline, bắt đầu ván, đủ 26 ảnh giải mã được; build v1→v2, chặn cập nhật giữa ván, từ chối không reload, chấp nhận sau khi lưu/rời, bản lưu giữ nguyên.
- Bàn phím: mở/đóng modal, trả tiêu điểm; kiểm tra axe WCAG A/AA; nhật ký cuộn nhận tiêu điểm. Không tràn ngang ở 360/390/768/1024/1440px, có reduced motion.
- Lõi luật: mô phỏng 50 seed qua 2–6 người, tới 2.000 hành động; một ván từ trạng thái ban đầu tới người thắng. Mua/thuê, đấu giá, xây/bán, thế chấp, giao dịch, tù và phá sản có kiểm tra tình huống.
- Máy chủ: xác thực người điều khiển, private projection, dedupe/cạnh tranh cùng revision, rate limit, origin allowlist, frame 32 KiB, hết hạn lobby, mất mạng/120 giây, đóng ván không người thắng, drain từ chối phòng mới.

Các lỗi đã sửa sau rà soát: tab cũ ghi đè lịch sử; trao lại đất còn nợ phí; bot bỏ qua đề nghị khi người chơi đang nợ; vào phòng thất bại làm mất phiên cũ; retry lệnh khi pause/closed; chọn ô khi đấu giá công trình; xác nhận thanh lý nhóm khách sạn; nhận diện bản lưu đấu giá sai để dùng backup. Từng lỗi được tái hiện bằng kiểm tra thất bại trước sửa và đạt sau sửa.

Lần đầu bộ kiểm tra 6 cửa sổ WebKit vượt thời gian của kịch bản; đã cho các bước chuẩn bị độc lập chạy song song và đặt giới hạn 60 giây cho kịch bản 6 người, giữ nguyên timeout từng khẳng định. Lần đầu axe phát hiện nhật ký dài chưa nhận tiêu điểm trên Firefox; đã sửa rồi chạy lại đủ 24 ca đạt.

Giới hạn: trình duyệt desktop không chứng minh iPhone/Android thật; chưa có public HTTPS backend hoặc thử tải thực tế nhiều phòng; backend một process mất ván online khi restart. Bản lưu offline không bị restart backend ảnh hưởng. Full dependency audit có 19 cảnh báo dev-only, runtime audit 0. Cache PWA cũ được giữ cho tab cũ và chưa tự dọn theo tuổi.

Sau B1/B4 phần dùng chung: chạy lại 27/27 E2E (9 mỗi trình duyệt), gồm fallback dialog trên WebView cũ; full unit/integration 105/105. Web giữ WEB-PASS.
