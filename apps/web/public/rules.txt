# Cờ tỷ phú — classic-v1

Bộ luật cố định cho Nhà Chơi. Cùng dữ liệu và cách phân xử được dùng cho offline, online và Bluetooth. Tên địa điểm và lời thẻ do dự án lựa chọn; không dùng Speed Die hoặc luật thưởng Đỗ xe miễn phí.

## Khởi tạo và tiền

- 2–6 người, quân cờ khác nhau, mỗi người 1.500 đơn vị, bắt đầu ở ô 0. Gieo hai xúc xắc để chọn người bắt đầu; những người hòa gieo lại, những người khác giữ thứ tự vòng theo sảnh chờ. Xáo độc lập hai bộ thẻ 16 lá một lần khi khởi tạo.
- Tiền là số nguyên an toàn, không có tiền thật. Ngân hàng không hết tiền, nhưng chỉ có 32 nhà và 12 khách sạn.
- Đi ngang hoặc tới Xuất phát theo chiều tiến nhận 200 mỗi lần qua. Đi lùi hoặc bị đưa vào tù không nhận lương. Thẻ tiến tới Xuất phát nhận 200, kể cả đã qua Xuất phát ở lần gieo trước đó trong cùng lượt.

## Di chuyển, thẻ và nhà tù

- Hai xúc xắc 1–6. Tung đôi có thêm lần gieo sau khi giải quyết hết ô và nghĩa vụ; ba lần đôi liên tiếp vào tù ngay, không di chuyển theo lần đôi thứ ba.
- Bài rút từ đầu bộ, thực hiện rồi trả cuối bộ. Thẻ ra tù được giữ bên ngoài bộ cho tới khi dùng/chuyển hoặc trả lại khi phá sản với ngân hàng.
- Thẻ tới ga gần nhất tính tiền thuê gấp đôi tiền thuê ga thông thường. Thẻ tới tiện ích gần nhất yêu cầu gieo mới để tính thuê 10 lần tổng điểm nếu tiện ích có chủ và không thế chấp; lần gieo này không tạo thêm lượt.
- Lùi ba ô có thể dẫn tới rút thêm thẻ hoặc phải trả nợ; mọi hiệu ứng được xử lý đến hết trước khi qua lượt.
- Ô 10 là ghé thăm nếu đi đến bằng di chuyển thường. Vào tù đặt ở ô 10, kết thúc chuỗi gieo đôi.
- Đầu lượt trong tù chọn trả 50, dùng một thẻ ra tù hoặc gieo. Tung đôi ra tù và di chuyển, không nhận thêm lượt. Sau hai lần gieo thất bại được ở lại; lần thất bại thứ ba bắt buộc trả 50 rồi di chuyển theo tổng lần gieo đó. Nếu thiếu tiền, xử lý nợ trước khi di chuyển.
- Người trong tù vẫn thu thuê, đấu giá và quản lý/giao dịch tài sản theo phase hợp lệ.

## Mua, thuê và đấu giá

- Đất chưa có chủ: mua theo giá niêm yết hoặc từ chối để mở đấu giá. Người thiếu tiền mua cũng được từ chối; không tự bỏ qua đấu giá.
- Mọi người chưa phá sản, kể cả người từ chối mua, đều được đấu. Giá mở 1, tăng ít nhất 1, chỉ trả giá bằng tiền đang có; không vay hoặc thanh lý giữa một phiên đấu giá. Người pass rời phiên. Khi chỉ còn người trả cao nhất thì họ trả tiền và nhận tài sản. Tất cả pass mà chưa ai bid thì tài sản về ngân hàng.
- Không giới hạn thời gian trả giá. Server/host xử lý bid theo thứ tự nhận; hai bid bằng nhau chỉ bid đầu tiên hợp lệ. UI hiển thị giá mới để người sau quyết định tiếp.
- Thu tiền thuê tự động khi dừng ở tài sản người khác. Đất không công trình thuộc nhóm màu sở hữu đủ có tiền thuê nền gấp đôi; đất đang thế chấp không thu thuê. Các đất còn lại của cùng nhóm vẫn có tiền thuê nền gấp đôi nếu người đó sở hữu đủ nhóm, dù một đất khác đang thế chấp.
- 1/2/3/4 ga cho thuê 25/50/100/200. Số ga sở hữu tính cả ga đang thế chấp, nhưng chính ga đang thế chấp không thu tiền.
- 1/2 tiện ích cho thuê 4/10 lần tổng xúc xắc của lần đến ô đó. Số tiện ích sở hữu tính cả tiện ích thế chấp, nhưng chính tiện ích thế chấp không thu tiền.
- Thuế tại ô 4 là 200, ô 38 là 100; nộp về ngân hàng. Ô Đỗ xe miễn phí không làm gì.

## Công trình và thế chấp

- Chỉ xây khi sở hữu trọn nhóm màu và không đất nào trong nhóm đang thế chấp. Xây/bán đều: chênh lệch công trình giữa các đất tối đa một; khách sạn tính mức 5. Mua từng mức, không bỏ qua bậc.
- Nhà cần nguồn cung ngân hàng. Khi đổi từ 4 nhà lên khách sạn, trả 4 nhà về ngân hàng và lấy 1 khách sạn. Mỗi công trình trả cùng giá xây của nhóm.
- Bán công trình được một nửa giá xây. Đổi khách sạn về 4 nhà chỉ khi ngân hàng có đủ 4 nhà và vẫn bán đều. Nếu không đủ nhà, chủ phải bán trọn công trình của cả nhóm về 0 theo giá nửa chi phí đã xây, thay vì tạo nhà mới; UI yêu cầu xác nhận thanh lý nhóm.
- Khi chỉ còn một công trình và có nhiều chủ đất đủ điều kiện xây, yêu cầu mua mở phiên đấu giá công trình cho các chủ đất đủ điều kiện xây; mỗi người chọn ô đất hợp lệ khi trả giá, nếu thắng thì xây tại ô đã chọn và thanh toán giá thắng. Một yêu cầu xây đơn lẻ khi không còn công trình được từ chối; không tạo trước công trình để hứa cho giao dịch khác.
- Chỉ thế chấp tài sản không có công trình; với đất màu, phải bán hết công trình của cả nhóm trước. Nhận giá thế chấp bằng nửa giá mua. Giải chấp trả giá thế chấp cộng 10%; phần lãi được làm tròn lên đơn vị nguyên (thế chấp 75 có lãi 8, giải chấp 83).

## Giao dịch và nợ

- Có thể đề nghị trao đổi tiền, tài sản không có công trình và thẻ ra tù. Không bán nhà/khách sạn trực tiếp cho người khác. Không cho vay hoặc hẹn thanh toán tương lai.
- Hai bên xác nhận; tại thời điểm chấp nhận phải kiểm tra lại sở hữu, thẻ và tiền. Chuyển toàn bộ gói cùng lúc hoặc không chuyển gì. Không tự cho phép hoàn thành một phần.
- Người nhận tài sản đang thế chấp chọn giải chấp ngay giá 110%, hoặc trả 10% ngay để giữ thế chấp. Nếu giữ, lần giải chấp sau vẫn là 110%; khoản 10% trước không được khấu trừ. Giải quyết từng tài sản trước khi thực hiện hiệu ứng tiếp theo.
- Thiếu tiền phát sinh trạng thái nợ, không ghi số dư âm và không cho tiếp tục gieo. Người mắc nợ được bán công trình, thế chấp, đề nghị giao dịch để huy động tiền; người khác chỉ được phản hồi giao dịch liên quan. Không mua/xây/đấu giá mới khi còn nghĩa vụ chưa giải quyết.
- Sau mỗi thanh lý/giao dịch, tự trả nếu đã đủ tiền; sau đó tiếp tục chính xác hiệu ứng bị gián đoạn. Nghĩa vụ trả nhiều người được giữ thành hàng đợi theo thứ tự người chơi trong state, không mất khoản còn lại.
- Chỉ tuyên bố phá sản khi tiền và nguồn thanh lý hợp lệ không thể trả đủ nghĩa vụ. Không được bỏ ván bằng cách tuyên bố phá sản giả khi vẫn đủ nguồn lực.
- Nợ người chơi: bán công trình về ngân hàng, chuyển tiền còn lại, tài sản và thẻ ra tù cho chủ nợ; xử lý nghĩa vụ tài sản đang thế chấp của người nhận. Nợ ngân hàng: bán công trình, trả thẻ về đúng bộ, bỏ thế chấp và đưa tài sản lần lượt ra đấu giá cho người còn sống.
- Người phá sản không nhận thêm lượt hoặc tham gia đấu giá/giao dịch. Người cuối cùng còn sống thắng; sau đó không nhận thêm action game.

## Phase và quyền hành động

| Phase | Hành động chính | Ai được làm |
|---|---|---|
| awaiting-roll | roll; quản lý tài sản/giao dịch | người tới lượt gieo; chủ sở hữu được quản lý tài sản |
| jail-choice | roll, pay-jail, use-jail-card | người tới lượt đang trong tù |
| awaiting-purchase | buy-property, decline-property | người vừa tới tài sản |
| auction | bid, pass-auction | người tham gia phiên đấu giá |
| debt | sell-building, mortgage, offer-trade, declare-bankruptcy | người mắc nợ; đối tác phản hồi trade liên quan |
| mortgage-transfer | resolve-mortgage-transfer và thanh lý cần thiết | người nhận đang có nghĩa vụ |
| awaiting-end-turn | end-turn hoặc roll khi còn lượt đôi; quản lý/trade | người tới lượt và chủ sở hữu theo quyền riêng |
| finished | không có action | không ai |

Tạm dừng kết nối là trạng thái session, không phải luật thắng/thua. Mỗi action hợp lệ tăng revision đúng một lần; các hiệu ứng tự động trong cùng action không tăng revision riêng.

## Dữ liệu và hình ảnh

Nguồn số liệu thực thi duy nhất: `packages/game-core/src/board.ts` và `cards.ts`. Bảng dưới được chốt cùng dữ liệu tại A1. Thứ tự thuê: nền / 1 nhà / 2 nhà / 3 nhà / 4 nhà / khách sạn. Khi có nhóm đủ mà chưa xây, nhân đôi duy nhất mức nền.

| ID | Location | Buy | Mortgage | Build | Rent 0 / 1 / 2 / 3 / 4 / hotel |
|---|---|---:|---:|---:|---|
| 1 | Phố Hàng Đào | 60 | 30 | 50 | 2 / 10 / 30 / 90 / 160 / 250 |
| 3 | Phố Hàng Bạc | 60 | 30 | 50 | 4 / 20 / 60 / 180 / 320 / 450 |
| 5 | Ga Hà Nội | 200 | 100 | - |  |
| 6 | Phố Hàng Buồm | 100 | 50 | 50 | 6 / 30 / 90 / 270 / 400 / 550 |
| 8 | Phố Hàng Mã | 100 | 50 | 50 | 6 / 30 / 90 / 270 / 400 / 550 |
| 9 | Phố Hàng Gai | 120 | 60 | 50 | 8 / 40 / 100 / 300 / 450 / 600 |
| 11 | Phố Tràng Tiền | 140 | 70 | 100 | 10 / 50 / 150 / 450 / 625 / 750 |
| 12 | Điện lực | 150 | 75 | - |  |
| 13 | Phố Đinh Lễ | 140 | 70 | 100 | 10 / 50 / 150 / 450 / 625 / 750 |
| 14 | Phố Ngô Quyền | 160 | 80 | 100 | 12 / 60 / 180 / 500 / 700 / 900 |
| 15 | Ga Huế | 200 | 100 | - |  |
| 16 | Phố Bạch Đằng | 180 | 90 | 100 | 14 / 70 / 200 / 550 / 750 / 950 |
| 18 | Phố Trần Phú | 180 | 90 | 100 | 14 / 70 / 200 / 550 / 750 / 950 |
| 19 | Phố Chùa Cầu | 200 | 100 | 100 | 16 / 80 / 220 / 600 / 800 / 1000 |
| 21 | Phố Lê Lợi | 220 | 110 | 150 | 18 / 90 / 250 / 700 / 875 / 1050 |
| 23 | Phố Hai Bà Trưng | 220 | 110 | 150 | 18 / 90 / 250 / 700 / 875 / 1050 |
| 24 | Phố Nguyễn Huệ | 240 | 120 | 150 | 20 / 100 / 300 / 750 / 925 / 1100 |
| 25 | Ga Đà Nẵng | 200 | 100 | - |  |
| 26 | Phố Đồng Khởi | 260 | 130 | 150 | 22 / 110 / 330 / 800 / 975 / 1150 |
| 27 | Phố Lê Duẩn | 260 | 130 | 150 | 22 / 110 / 330 / 800 / 975 / 1150 |
| 28 | Cấp nước | 150 | 75 | - |  |
| 29 | Phố Nam Kỳ | 280 | 140 | 150 | 24 / 120 / 360 / 850 / 1025 / 1200 |
| 31 | Phố Hồ Tây | 300 | 150 | 200 | 26 / 130 / 390 / 900 / 1100 / 1275 |
| 32 | Phố Thanh Niên | 300 | 150 | 200 | 26 / 130 / 390 / 900 / 1100 / 1275 |
| 34 | Phố Quảng An | 320 | 160 | 200 | 28 / 150 / 450 / 1000 / 1200 / 1400 |
| 35 | Ga Sài Gòn | 200 | 100 | - |  |
| 37 | Phố Thảo Điền | 350 | 175 | 200 | 35 / 175 / 500 / 1100 / 1300 / 1500 |
| 39 | Phố Phú Mỹ | 400 | 200 | 200 | 50 / 200 / 600 / 1400 / 1700 / 2000 |
