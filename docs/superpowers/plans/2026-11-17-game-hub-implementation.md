# Nhà Chơi — Web and Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai Cờ tỷ phú truyền thống chơi được trên web/PWA trước, sau đó dùng chung mã nguồn để dựng Android/iOS và thêm Bluetooth.

**Architecture:** Một giao diện React responsive, một lõi luật TypeScript và một giao thức hành động/trạng thái. Offline chạy lõi luật trên thiết bị; online chạy trên máy chủ; Bluetooth chạy trên điện thoại chủ phòng. Mobile đóng gói bản build của giao diện web bằng Capacitor, không viết lại game.

**Tech Stack:** npm workspaces, TypeScript, React + Vite, Node.js + Socket.IO, Zod tại biên dữ liệu, IndexedDB, vite-plugin-pwa/Workbox, Capacitor 8.5+ cùng major 8; Vitest và Playwright. Kotlin/Swift chỉ cho tích hợp mobile/Bluetooth. Không cần game engine, Redux, backend framework, tài khoản hoặc database server cho bản đầu.

**Spec:** [Thiết kế đã duyệt](../specs/2026-11-17-game-hub-design.md); [bản mẫu giao diện](../../../design/README.md), gồm 26 ảnh địa điểm và thông tin tác giả/giấy phép.

## Global Constraints

- “Sản phẩm có website, PWA, ứng dụng Android và iOS.”
- “Mỗi ván 2–6 người chơi.” Offline một người với 1–5 bot, một mức khó.
- “Bàn 40 ô; 28 tài sản gồm 22 đất, 4 ga và 2 tiện ích.”
- “Hai xúc xắc sáu mặt, số dư ban đầu 1.500 đơn vị, qua ô xuất phát nhận 200.”
- “Ngân hàng có giới hạn 32 nhà và 12 khách sạn; không tự sinh thêm khi hết.”
- “Không thu tiền thuê cho tài sản đang thế chấp.”
- “Người cuối cùng chưa phá sản thắng; không giới hạn thời gian ván.”
- “Không âm thầm đổi sang internet.” khi Bluetooth gặp lỗi.
- Tiếng Việt, bố cục đã duyệt, bàn phím/focus/nhãn truy cập; 26 ảnh cục bộ có attribution, không phụ thuộc CDN.
- Không khôi phục online/Bluetooth sau khi tiến trình authority bị đóng trong bản đầu; có khôi phục sau mất kết nối khi authority vẫn sống.
- Bản mẫu `design/` là tham chiếu, không đem JavaScript mô phỏng vào sản phẩm và không ghi đè bản mẫu.

## Review Focus

1. Lệnh đến hai lần hoặc trên trạng thái cũ: không trả tiền/gieo/xây hai lần — A7, A8, B3.
2. Mất mạng, đóng tab, ghi storage thất bại: ván lưu trước vẫn đọc được, không tự xử thua — A6, A8, A9, B4.
3. Hai người tranh một tài sản, chấp nhận giao dịch khi số dư thay đổi: xử lý tuần tự, kiểm tra lại tại lúc thực thi — A4, A7.
4. Đọc lén bộ bài, điều khiển người khác, đoán mã phòng và payload sai/quá lớn: không lộ dữ liệu hoặc nhận hành động trái quyền — A1, A7, B2, B3.
5. PWA cập nhật giữa ván, WebView vào nền hoặc đổi phiên bản client: không reload/migrate phá ván, không tiếp tục phiên không tương thích — A6, A9, B4.

## Thứ tự mới theo yêu cầu người dùng

**Thiết kế cho cả hai ngay từ đầu; triển khai web trước rồi mới dựng mobile.** Không chạy hai dự án sản phẩm độc lập. “Song song” ở đây là cùng kiến trúc, lõi luật, UI và hợp đồng dữ liệu; không dựng native project trong giai đoạn web.

| Mốc | Làm gì | Điều kiện qua mốc |
|---|---|---|
| A1–A4 | Lõi luật và dữ liệu truyền thống | Các nhánh luật có test; không phụ thuộc DOM/mạng/native |
| A5–A6 | Web offline, bot, lưu/tiếp tục | Chơi và kết thúc được ván thật, khôi phục đúng |
| A7–A8 | Web online | 2–6 browser client chơi chung, reconnect và quyền đúng |
| A9–A10 | PWA, ảnh offline, kiểm thử và bàn giao web | Gate WEB-PASS đạt; bản web có thể nghiệm thu |
| B1 | Dựng Android và iOS từ web build | Cả hai mở được bản web đóng gói, offline không cần server |
| B2–B3 | Kiểm chứng rồi tích hợp Bluetooth | Qua thiết bị thật, cả ba cặp nền tảng, mục tiêu 6 người |
| B4–B5 | Hoàn thiện mobile và phân phối thử nghiệm | Gate MOBILE-PASS đạt; không coi giả lập là kiểm chứng radio |

Yêu cầu này thay thứ tự “thử nghiệm Bluetooth trước” trong thiết kế ban đầu. Rủi ro được chấp nhận về lịch thực hiện: khả năng Bluetooth chỉ được chứng minh sau khi web đã hoàn thành. Nếu spike không đạt, giữ nguyên web, báo bằng chứng và thống nhất điều chỉnh riêng phần Bluetooth; không tự bỏ iOS hoặc thay bằng Wi-Fi.

## Hai kế hoạch thực hiện

- [A — Web/PWA và lõi dùng chung](2026-11-17-game-hub-web.md): thực hiện trước, theo A1 → A10.
- [B — Android/iOS và Bluetooth](2026-11-17-game-hub-mobile.md): chỉ dựng sau WEB-PASS, theo B1 → B5.

Đây là kế hoạch sản phẩm, không phải kết quả triển khai. Tất cả task A/B hiện chưa bắt đầu.

## Cấu trúc đích và ranh giới

```text
apps/web/                     React UI, local session, save, PWA; dùng lại trên mobile
apps/server/                  HTTP + Socket.IO, phòng, phiên, authority online
apps/mobile/                  Chỉ tạo ở B1: Capacitor config, ios/, android/, plugin BLE
packages/game-core/           Luật, board/cards, bot, projection; không có IO
packages/protocol/            Zod schemas, version, session interface, frame codec BLE
apps/web/public/locations/    26 ảnh và credits sao chép từ bản mẫu
apps/web/e2e/                 Playwright, gồm offline/PWA và nhiều browser context
mobile-evidence/              Chỉ tạo khi chạy thiết bị: kết quả, phiên bản, log đã bỏ bí mật
```

Không tách `apps/mobile-web` hoặc bộ component mobile. CSS hiện tại được chuyển thành component styles có tên rõ, giữ màu và bố cục; không mang nguyên event-handler DOM của bản mẫu sang React.

## Hợp đồng tối thiểu, dùng xuyên hai kế hoạch

Tạo tại `packages/game-core/src/types.ts`, `packages/protocol/src/messages.ts`, `packages/protocol/src/session.ts` trong A1; các chữ hoa dưới đây là type phải được định nghĩa ở các file đó.

```ts
// Core state chứa bài úp, nhưng PlayerView chỉ chứa thông tin người chơi được biết.
createGame(config: {gameId:string; players:PlayerConfig[]}, random: RandomSource): GameState;
applyAction(state: GameState, actor: PlayerId, action: GameAction, random: RandomSource): ActionResult;
projectGame(state: GameState, viewer: PlayerId): PlayerView;
chooseBotAction(view: PlayerView): GameAction;
// RandomSource: int(minInclusive: number, maxInclusive: number): number.
// ActionResult = { ok:true; state:GameState; events:GameEvent[] }
//              | { ok:false; code:RuleErrorCode }; lỗi không đổi state đầu vào.
// GameState có gameId, rulesVersion, revision, players, board, turn, phase, decks, bank.
// PlayerView có viewerId, revision, phase, players, board, recentEvents, allowedActions;
// không có thứ tự bài úp, random seed hoặc secret của phiên.

interface GameSession {
  send(command: CommandEnvelope): Promise<CommandReply>;
  subscribe(listener: (update: SessionUpdate) => void): () => void;
  close(): Promise<void>;
}
// CommandEnvelope = { protocolVersion:1; gameId:string; commandId:string;
//   expectedRevision:number; action:GameAction };
// Actor lấy từ phiên đã xác thực, không tin playerId do client tự gửi.
// CommandReply = { ok:true; commandId:string; revision:number }
//              | { ok:false; commandId:string; code:CommandErrorCode; revision:number };
// SessionUpdate = { connection:'connected'|'reconnecting'|'paused'|'closed';
//   view:PlayerView|null; reason?:string };
```

B4 bổ sung `GameSession.setActive(active:boolean):Promise<void>` để transport tạm dừng/kết nối lại theo vòng đời native; web không tự gọi thay đổi nền tảng.

`RoomSession extends GameSession` có `.setReady(ready:boolean):Promise<RoomReply>`, `.startGame():Promise<RoomReply>`, `.subscribeLobby(listener:(view:LobbyView)=>void):()=>void`. Online và Bluetooth implement RoomSession, offline chỉ cần GameSession. `LobbyView` có roomId, code (online), hostId, capacity:6, players gồm id/name/token/ready/connected; không chứa resume token. `RoomReply` được định nghĩa tại A7 và dùng chung ở B3.

`GameAction` là discriminated union bằng `type`: `roll`, `buy-property`, `decline-property`, `bid`, `pass-auction`, `build`, `sell-building`, `mortgage`, `unmortgage`, `offer-trade`, `accept-trade`, `reject-trade`, `resolve-mortgage-transfer`, `pay-jail`, `use-jail-card`, `declare-bankruptcy`, `end-turn`. Payload tài sản dùng board index cố định 0–39; tiền là số nguyên không âm, không chuỗi/float. Các effect tự động của ô/thẻ được core giải quyết, client không gửi giá mua, tiền thuê, kết quả xúc xắc hay người thắng.

`allowedActions` là các loại hành động được phép kèm tài sản/đối tượng hợp lệ và ràng buộc số tiền, không liệt kê mọi số tiền giao dịch. `phase` tối thiểu gồm `awaiting-roll`, `awaiting-purchase`, `auction`, `debt`, `jail-choice`, `awaiting-end-turn`, `finished`; tạm dừng kết nối nằm ở SessionUpdate. Chốt transition và quyền của từng action trong A1 trước khi code reducer; không giả định mọi action chỉ thuộc người đang tới lượt (đấu giá/giao dịch/quản lý tài sản có quyền riêng).

`packages/protocol/src/authority.ts` do A5 tạo cung cấp `createAuthority(state:GameState,random:RandomSource):GameAuthority`, với `.dispatch(actor:PlayerId,command:CommandEnvelope):CommandReply`, `.getView(viewer:PlayerId):PlayerView`, `.snapshot():GameState`. Authority sở hữu state, kiểm tra gameId/revision/schema, dedupe và gọi core; không quản lý socket/token/quyền kết nối. Offline, server online và host Bluetooth dùng lại lớp xử lý nhỏ này, không sao chép quy tắc idempotency. `GameAuthority` được export từ `protocol/src/index.ts`.

Schema `gameStateSchema` ở `packages/protocol/src/state-schema.ts` đối chiếu kiểu GameState để kiểm tra snapshot/save; core không import protocol. Protocol phụ thuộc core một chiều. Cache reply giữ tối đa 1.024 command/actor; retry nguyên envelope cũ đã bị evict nhận STALE_REVISION và snapshot hiện tại, tuyệt đối không thực thi lại. Client retry phải giữ cả commandId lẫn expectedRevision.

## Công cụ, nguồn và giới hạn đã kiểm tra

- Hiện repo chỉ có `design/`, `docs/`, chưa Git/dependency sản phẩm. Máy có Node 24.11.0, npm 11.6.2, Xcode 27.2, Java 25; chưa xác nhận Android SDK, signing hoặc thiết bị thật. Không thay JDK mặc định của máy; Gradle dùng JDK tương thích với template khi dựng mobile.
- React + Vite tạo static app, không cần SSR. Chốt phiên bản ổn định tương thích bằng peer dependencies tại A1 và commit `package-lock.json`; không ghi `latest` vào dependency đã khóa. [Vite](https://vite.dev/guide/)
- Capacitor dùng lại web build; nhánh 8.5+ có thay đổi UIScene liên quan Xcode 27, phải dùng template/lifecycle tương ứng. Đây là lý do chọn cùng major 8 và floor 8.5 cho mobile. [Workflow](https://capacitorjs.com/docs/basics/workflow), [8.5 lifecycle](https://capacitorjs.com/docs/updating/8-5)
- Socket.IO không tự bảo đảm một hành động chỉ thực thi một lần: application phải có command ID, revision và snapshot khi reconnect. [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- `@capacitor-community/bluetooth-le` chỉ có central role; không chọn riêng plugin này rồi mặc định có host/peripheral. Kế hoạch dùng plugin cục bộ đủ hai vai trò, thử nghiệm trước khi tích hợp game. [Plugin README](https://github.com/capacitor-community/bluetooth-le#introduction)
- Cache PWA phải liệt kê cả HTML/JS/CSS/JPG/JSON/icons; cập nhật dạng prompt, không reload ván đang chơi. [Static assets](https://vite-pwa-org.netlify.app/guide/static-assets), [Update prompt](https://vite-pwa-org.netlify.app/guide/prompt-for-update)

## Handoff

Mặc định đề xuất: thực hiện tuần tự trong chat hiện tại, kiểm tra độc lập ở gate WEB-PASS và MOBILE-PASS. Chưa khởi tạo app, cài dependency, cấu hình dịch vụ hay dựng native project trong lần lên kế hoạch này. Sau khi bắt đầu thực hiện, không cần hỏi lại ở từng task; chỉ cần người dùng cho đầu vào khi thực sự thiếu thiết bị/signing hoặc phải đổi phạm vi.

## Kết quả tự rà soát kế hoạch

- Scope: A1–A4 bao phủ luật; A5–A6 offline/bot/save; A7–A8 online; A9–A10 PWA/ảnh/accessibility; B1–B5 Android/iOS/Bluetooth và lifecycle.
- Interface: core không import protocol; protocol chứa schema và authority chung; web/mobile/server dùng cùng type; RoomSession phân biệt sảnh chờ với ván đấu.
- Rủi ro bổ sung: các luật ít gặp, giới hạn storage, multi-tab, mất ack, hidden deck, update giữa ván và hardware đã có task/test sở hữu.
- Không coi các lệnh test/build trong kế hoạch là đã chạy: hiện chỉ kiểm tra tài liệu, đường dẫn liên kết và tính nhất quán các task. Chưa có app sản phẩm để chạy chúng.
