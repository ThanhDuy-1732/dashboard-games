# Nhà Chơi — Web/PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thao tác mô phỏng bằng Cờ tỷ phú truyền thống thật trên web: đấu máy, lưu/tiếp tục offline, phòng online và PWA.

**Architecture:** Thực hiện A1 → A10; lõi TypeScript không IO, giao diện React dùng chung cho mobile, authority online đặt tại Node server. Không dựng native project ở giai đoạn này.

**Tech Stack:** Theo [kế hoạch tổng](2026-11-17-game-hub-implementation.md): npm workspaces, React/Vite, TypeScript, Socket.IO, Zod, IndexedDB, vite-plugin-pwa/Workbox, Vitest, Playwright.

**Spec:** [Thiết kế](../specs/2026-11-17-game-hub-design.md), [hợp đồng và thứ tự mới](2026-11-17-game-hub-implementation.md), bản mẫu `design/` hiện tại.

## Global Constraints

Áp dụng nguyên văn Global Constraints và toàn bộ hợp đồng của kế hoạch tổng. Không triển khai game rút gọn. Web có online và offline; Bluetooth trên web chỉ giải thích cần ứng dụng mobile. Giữ 26 ảnh địa điểm, nguồn và giấy phép. Không dùng bản JavaScript giả lập làm engine thật.

## Review Focus

- ID lệnh trùng/revision cũ và bấm hai lần: A7/A8.
- Storage hết chỗ, save hỏng, tab thứ hai: A6.
- Giao dịch/đấu giá thay đổi đồng thời: A4/A7.
- Client giả actor/dice, đọc bài úp, payload bất thường: A1/A7.
- SW update khi đang chơi hoặc client khác protocol: A8/A9.

## Bản đồ file

```text
package.json, package-lock.json, tsconfig.base.json, vitest.config.ts
apps/web/{package.json,index.html,vite.config.ts,tsconfig.json}
apps/web/src/{main.tsx,App.tsx,styles.css,platform.ts}
apps/web/src/screens/{Home,Setup,Lobby,Game,Results}.tsx
apps/web/src/components/{Board,LocationDetails,ActionPanel,Players,TradeDialog,AssetsDialog}.tsx
apps/web/src/session/{offline.ts,online.ts,useGameSession.ts}
apps/web/src/storage/{save.ts,save-schema.ts}
apps/web/src/pwa/{register.ts,sw.ts}
apps/web/public/{locations/,icons/}
apps/server/{package.json,tsconfig.json,src/{main,rooms,authority,auth,random}.ts}
packages/game-core/src/{index,types,board,cards,engine,movement,economy,assets,trade,bot,view}.ts
packages/game-core/test/{data,movement,economy,assets,trade,bot,view}.test.ts
packages/game-core/test/fixtures/{state-factory,random-tape}.ts
packages/protocol/src/{index,messages,session,state-schema,authority}.ts
packages/protocol/test/messages.test.ts
apps/server/test/{rooms,authority,reconnect}.test.ts
apps/web/test/{screens,offline,save,online,pwa}.test.tsx
apps/web/e2e/{offline,online,pwa,accessibility}.spec.ts
playwright.config.ts, docs/rules/classic-v1.md, docs/runbooks/web.md
```

Không nhất thiết tạo file rỗng trước: mỗi task tạo đúng file nó cần. `useGameSession` chỉ nối subscription và React lifecycle, không thêm store framework.

### Task 1: A1 — Workspace, dữ liệu luật và hợp đồng chung

**Files:** Root config; package/config cho web, server, core, protocol; `core/src/{index,types,board,cards,view}.ts`; `protocol/src/{index,messages,session,state-schema}.ts`; `docs/rules/classic-v1.md`; tests `data`, `view`, `messages` và hai fixture helper.

**Interfaces:** Định nghĩa chính xác các type/function của kế hoạch tổng; action/state schemas ở protocol có kiểu ZodType tương ứng với core, không tạo vòng import. `PlayerConfig={id:PlayerId,name:string,token:'car'|'cat'|'hat'|'ship'|'dog'|'plane',kind:'human'|'bot'}`; tên trim 1–20 ký tự. `PlayerView` thêm `viewerId`; các enum lỗi có code ổn định, UI dịch sang tiếng Việt.

- [x] **Viết test dữ liệu/hợp đồng:** `board_has_40_spaces_and_28_assets` kiểm tra 22 đất/4 ga/2 tiện ích, giá hiện có trong `design/app.js`; `decks_have_16_unique_cards_each`; `project_hides_deck_order`; schema từ chối NaN/float/âm, action lạ, field thừa, name trống, protocol khác 1. Chạy `npx vitest run packages/game-core/test/data.test.ts packages/game-core/test/view.test.ts packages/protocol/test/messages.test.ts` để ghi nhận RED sau bootstrap tối thiểu.
- [x] **Chốt rulebook và fixture:** 8 nhóm màu kích thước 2/3/3/3/3/3/3/2 theo board index của bản mẫu; đủ rent 0–4 nhà/khách sạn, mortgage/giải chấp, nhà/khách sạn, 16 thẻ mỗi bộ và mọi effect. Dùng một bộ Classic thống nhất, ghi rõ biến thể số hóa: tự thu tiền thuê, bid bắt đầu 1/tăng ít nhất 1, server nhận trước thắng nếu bằng giá, không giới hạn thời gian lượt. Đọc đối chiếu phần Classic của [hướng dẫn Hasbro](https://www.hasbro.com/common/instruct/00009.pdf), không dùng Speed Die; dùng thuế cố định 200 và 100 như board đã duyệt. Viết lời thẻ tiếng Việt riêng, không sao chép hình/branding.
- [x] **Tạo engine skeleton và schema:** chưa thực thi mọi action; chỉ type, board/cards, `projectGame` và kiểm tra payload. Rulebook phải có đủ số liệu trước A2. Lưu `rulesVersion:'classic-v1'`, `schemaVersion:1`, `protocolVersion:1` độc lập. Trình bày lược đồ phase/action, gồm nợ lồng nhau do thẻ/thế chấp và quyền hành động ngoài lượt.
- [x] **Kiểm tra GREEN:** chạy lại ba file test; `npm run typecheck` và `npm run build`. Root scripts phải có `dev:web`, `dev:server`, `build`, `build:web`, `test`, `test:e2e`, `typecheck`, `lint`. `build` tạo dist core/protocol trước server/web; package exports trỏ dist, test dùng alias về src. `dev:web` Vite cổng 5173; `dev:server` cổng 3001; dùng `tsx` cho server dev, `tsc` cho server build. Chốt Node 24 trong `.nvmrc`, versions tương thích được khóa trong lockfile.
- [x] **Checkpoint:** nếu chưa Git, khởi tạo repository để lưu lịch sử cục bộ; không tạo remote/push. Commit `chore: establish shared game contracts and rules` cùng test/log kết quả.

### Task 2: A2 — Lượt, di chuyển, thẻ và nhà tù

**Files:** `core/src/{engine,movement}.ts`, bổ sung `types.ts`, `movement.test.ts`, fixtures `random-tape.ts`, `state-factory.ts`.

**Interfaces:** `createGame({gameId,players},random)` và `applyAction(state,actor,action,random)` theo hợp đồng; không mutate input. RandomSource giả cho test; nguồn thật do caller cấp. Thẻ có discriminated effects và continuation để nợ/di chuyển dây chuyền không mất lượt.

- [x] **RED:** `starts_with_1500_and_2_to_6_players`; `passes_go_once_per_crossing`; `third_double_goes_to_jail_without_moving`; `jail_double_does_not_grant_extra_roll`; `third_failed_jail_roll_requires_50_then_moves`; `card_moves_back_without_salary`; `held_jail_card_leaves_deck_until_used`; actor ngoài quyền bị từ chối. Run: `npx vitest run packages/game-core/test/movement.test.ts`.
- [x] **Implement:** tạo lượt đầu bằng gieo hai xúc xắc cho mỗi người, hòa thì những người hòa gieo lại; xáo mỗi bộ bài một lần, rút rồi đưa cuối bộ trừ thẻ được giữ. Xử lý 3 cách ra tù, đến thăm khác bị giam, thẻ đi tới ga/tiện ích, thẻ chuyển tiền nhiều người, thuế và Free Parking không thưởng; mỗi bước có GameEvent.
- [x] **GREEN:** chạy lại `movement.test.ts` và các test A1; assert dice 1–6, revision chỉ tăng khi action hợp lệ, vị trí 0–39, state lỗi không đổi.
- [x] **Checkpoint:** commit `feat: implement turns movement cards and jail`.

### Task 3: A3 — Mua đất, tiền thuê, đấu giá và thanh toán nợ

**Files:** `core/src/economy.ts`, `engine.ts`, `economy.test.ts`.

**Interfaces:** thêm nhánh `buy-property`, `decline-property`, `bid {amount}`, `pass-auction`, `declare-bankruptcy`. Internal `settlePayment(state,payer,payee,amount)` tạo debt continuation; không cho số dư âm rồi tiếp tục lượt.

- [x] **RED:** `decline_starts_auction_for_all_active_players`; `last_bidder_pays_exactly_once`; `all_pass_returns_property_to_bank`; `monopoly_doubles_base_rent`; `mortgaged_property_collects_zero`; ga 25/50/100/200, tiện ích 4×/10× tổng dice; `insufficient_cash_enters_debt_and_blocks_roll`; trả nợ đủ mới tiếp tục effect. Run: `npx vitest run packages/game-core/test/economy.test.ts`.
- [x] **Implement:** thu tiền thuê tự động; tính rent từ bảng board, không từ payload. Đấu giá nhận bid khi cao hơn hiện tại, đủ tiền, người còn tham gia; pass rút khỏi phiên, người từ chối mua vẫn được đấu. Mọi người phải bid/pass rõ ràng; không timer cưỡng bức. Giữ debt và continuation để A4 thanh lý hoặc phá sản.
- [x] **GREEN:** test trên, bộ test core; thêm fixture 2 người gửi cùng giá, lệnh sau nhận lỗi, tài sản chỉ có một chủ. Nếu nhiều người cần trả tiền bởi một thẻ, giữ hàng đợi nghĩa vụ cho tới khi tất cả được giải quyết.
- [x] **Checkpoint:** commit `feat: add purchases rent auctions and debt resolution`.

### Task 4: A4 — Xây/bán, thế chấp, giao dịch, phá sản và kết quả

**Files:** `core/src/{assets,trade}.ts`, `engine.ts`, tests `assets.test.ts`, `trade.test.ts`.

**Interfaces:** action `build/sell-building/mortgage/unmortgage {spaceId}`, trade `offer-trade {to,give,receive}` / `accept-trade {tradeId}` / `reject-trade {tradeId}`, `resolve-mortgage-transfer {spaceId,choice:'keep'|'redeem'}`. `give/receive` gồm cash, spaceIds, jail-card IDs; không chuyển công trình trực tiếp.

- [x] **RED:** `cannot_build_on_incomplete_or_mortgaged_group`; `build_and_sell_evenly`; `house_pool_never_exceeds_32`; `hotel_pool_never_exceeds_12`; `mortgage_requires_group_buildings_sold`; `trade_revalidates_both_balances_and_ownership`; `trade_transfers_atomically`; phá sản với ngân hàng và với người chơi cho kết quả tài sản khác nhau. Run: `npx vitest run packages/game-core/test/assets.test.ts packages/game-core/test/trade.test.ts`.
- [x] **Implement:** công trình bán nửa giá; đổi 4 nhà lấy 1 khách sạn trả nhà về ngân hàng. Ghi rõ trong rulebook cách xử lý bán khách sạn khi ngân hàng thiếu nhà và tranh mua công trình cuối; không tự tạo nguồn cung. Với tài sản thế chấp được chuyển, người nhận phải chọn trả 110% để giải chấp hoặc trả 10% ngay để giữ thế chấp; giải chấp sau đó vẫn 110%. Phát sinh nợ dùng cùng continuation A3. Người còn sống có thể quản lý tài sản/giao dịch khi phase cho phép, kể cả trong tù; không vượt qua debt/auction đang chờ.
- [x] **GREEN:** cùng tests + core suite; thêm `last_survivor_finishes_game_and_rejects_more_actions`, bán nhà để trả nợ rồi tiếp tục đúng event ban đầu; hoàn tất bảng phase/action và toàn bộ con số trong rulebook, không để lựa chọn luật cho task UI.
- [x] **Checkpoint:** commit `feat: complete asset management trades and bankruptcy`.

### Task 5: A5 — UI thật, offline session và bot

**Files:** `protocol/src/authority.ts`, `protocol/test/authority.test.ts`; web `main.tsx`, `App.tsx`, `styles.css`, `platform.ts`, 5 screens, 7 components trong bản đồ file; `session/{offline,useGameSession}.ts`; `core/src/bot.ts`; `bot.test.ts`; web tests `screens.test.tsx`, `offline.test.tsx`; public `locations/` và metadata.

**Interfaces:** `createOfflineSession({human:PlayerConfig,botCount:number}):GameSession`; `chooseBotAction(view)` chỉ đọc PlayerView. Mỗi session sở hữu một authoritative state; UI chỉ đọc projection và gửi commands. `createAuthority` và GameAuthority theo kế hoạch tổng; chỉ A6 mới thêm tham số resume với SavedGame.

- [ ] **RED:** UI tạo 1–5 bot, 6 quân cờ chọn độc nhất, tên trống bị chặn; mỗi phase cho đúng CTA; thẻ tài sản hiện ảnh/tác giả/giấy phép; bàn 40 ô chạm được ở 360px. Bot phải trả action hợp lệ ở auction/debt/jail/trade, không được đọc deck; authority từ chối sai gameId/revision, duplicate retry không đổi state, cache reply tối đa 1.024/actor và retry quá cũ không chạy lại. Run: `npx vitest run packages/game-core/test/bot.test.ts apps/web/test/screens.test.tsx apps/web/test/offline.test.tsx packages/protocol/test/authority.test.ts`.
- [ ] **Implement:** tạo GameAuthority dùng chung rồi chuyển hình thức đã duyệt sang React, giữ token palette/ảnh cục bộ. Bổ sung UI tài sản/xây nhà/thế chấp/giao dịch/nhà tù/xử lý nợ/kết quả còn thiếu ở prototype. Dùng native dialog với focus restore, form validation và aria-live cho sự kiện; hình ảnh không thay nhãn. Bot ưu tiên trả nợ bằng bán/thế chấp hợp lệ, mua trong khả năng chi trả, xây đều với quỹ dự phòng 150; đấu giá không vượt giá niêm yết hoặc số dư trừ dự phòng; nhận trade chỉ khi giá trị tài sản ước tính tăng và đủ chi phí tức thời. Không cần chủ động đề xuất trade.
- [ ] **GREEN:** test trên + core suite; fixture offline từ bắt đầu đến winner không cần sửa state giữa ván. Chạy thêm 50 seed × tối đa 2.000 actions để kiểm tra invariant và không phase bị bot kẹt; không áp giới hạn lượt này lên ván người dùng. Không cho vòng bot khóa UI: mỗi action yield về event loop, hủy timer khi rời session.
- [ ] **Checkpoint:** commit `feat: deliver playable offline web game and bots`.

### Task 6: A6 — Lưu/tiếp tục offline và bảo toàn dữ liệu

**Files:** `web/src/storage/{save,save-schema}.ts`, `session/offline.ts`, Home/Setup/Game; `web/test/save.test.tsx`, `e2e/offline.spec.ts`.

**Interfaces:** `SavedGame={schemaVersion:1,rulesVersion:'classic-v1',gameId:string,revision:number,savedAt:string,state:GameState,humanId:PlayerId}`; `SaveStore.load():Promise<SavedGame|null>`, `.save(save):Promise<void>`, `.remove():Promise<void>`. `createOfflineSession` thêm tham số thứ hai tùy chọn `saved?:SavedGame` để khởi tạo authority từ snapshot đã validate. Một slot offline gồm bản hiện tại và bản trước, giữ cả hai trong một IndexedDB transaction. Không lưu session token online trong save game.

- [ ] **RED:** `resume_restores_debt_auction_jail_and_bot_turn`; `write_failure_keeps_previous_save`; `corrupt_current_can_recover_previous`; `unknown_schema_does_not_overwrite`; `second_tab_cannot_take_writer_lease`; `new_game_requires_confirm_if_save_exists`. Run: `npx vitest run apps/web/test/save.test.tsx` và `npx playwright test apps/web/e2e/offline.spec.ts`.
- [ ] **Implement:** ghi sau mỗi action đã hoàn tất, serialize bằng schema kiểm tra đầy đủ và validate invariant khi load. Một transaction ghi current/previous và revision/lease; lease có owner và hết hạn, một tab bị mất lease chỉ được đọc. Không phụ thuộc Web Locks vì còn phải chạy trong WebView. Không tự ghi đè bản chưa hiểu hoặc tự xóa khi lỗi; có tiếp tục/thử lưu lại, và cảnh báo trạng thái chưa lưu.
- [ ] **GREEN:** reload giữa nợ/auction và lượt bot không nhân đôi action; đóng browser mở lại đúng số dư/tài sản; giả lập QuotaExceededError và transaction abort; migration có fixture trước/sau khi thực sự đổi version, không thêm migration rỗng.
- [ ] **Checkpoint:** commit `feat: persist and safely resume offline games`.

### Task 7: A7 — Máy chủ phòng online và xử lý hành động có thẩm quyền

**Files:** `server/src/{main,rooms,authority,auth,random}.ts`, tests `rooms.test.ts`, `authority.test.ts`; `protocol/src/messages.ts` bổ sung room schemas.

**Interfaces:** Socket.IO `room:create {name,token}`, `room:join {code,name,token}`, `room:ready {ready}`, `room:start {}`, `room:resume {resumeToken}`, `game:command CommandEnvelope`; server emits `room:update LobbyView` và `game:update SessionUpdate`. Ack phòng trả `RoomReply={ok:true,room:LobbyView,selfId:PlayerId,resumeToken:string}|{ok:false,code:RoomErrorCode}`; resume token chỉ trả cho chính chủ, không trong LobbyView. Room code 6 ký tự A–Z/0–9, có retry khi trùng; 2–6 người, quân cờ độc nhất, chỉ host bắt đầu khi tất cả ready.

- [ ] **RED:** 1 người không start, 7 người bị từ chối, người không host không start; `duplicate_command_returns_original_ack_without_reroll`; `stale_revision_gets_rejected_with_current_revision`; `spoofed_actor_is_rejected`; `view_never_contains_decks_or_session_secrets`; `same_trade_cannot_commit_twice`. Run: `npx vitest run apps/server/test/rooms.test.ts apps/server/test/authority.test.ts`.
- [ ] **Implement:** Node HTTP health endpoint + Socket.IO, rooms Map trong một process. Per-room queue gọi GameAuthority.dispatch đã có từ A5; crypto tạo ID/token/dice/shuffle; không `Math.random` cho authority. Dedupe dùng cache reply của GameAuthority trước khi kiểm tra revision, không cài thêm một bản reducer/dedupe trong server. Lệnh hợp lệ tăng revision, gửi projection riêng từng người; lỗi không tăng. Hash resume token trên server, không log/broadcast token.
- [ ] **Boundary checks:** Zod strict union, tiền safe integer, tên 1–20, commandId UUID, tối đa frame 32 KiB; rate limit command 20/s/phiên, tạo/vào phòng 30/phút/IP trong bản đầu; allowlist origins qua env, binding session không theo actor client. Phòng chờ trống xóa ngay, inactive phòng chờ TTL 30 phút, phòng kết thúc giữ 10 phút; không âm thầm hết hạn ván đang hoạt động. Không giới thiệu Redis/database/cluster khi chưa cần.
- [ ] **GREEN:** hai client cùng revision cùng mua hoặc accept trade chỉ một action commit; payload quá lớn/field dice/actor thừa bị chặn; duplicate cùng ID nhưng nội dung khác trả `COMMAND_ID_REUSED`; cache 1.024 replies/actor theo hợp đồng; thêm test retry envelope cũ sau hơn 1.024 commands nhận STALE_REVISION, không thay đổi state. Xóa cache khi ván kết thúc/TTL kết thúc, không giữ lịch sử log vô hạn. Core + server suite đều pass.
- [ ] **Checkpoint:** commit `feat: add authoritative online rooms and commands`.

### Task 8: A8 — UI online, reconnect và kết thúc ván bị gián đoạn

**Files:** `web/src/session/online.ts`, `useGameSession.ts`, Setup/Lobby/Game/Results; `server/src/rooms.ts`; `server/test/reconnect.test.ts`, `web/test/online.test.tsx`, `e2e/online.spec.ts`.

**Interfaces:** `connectOnlineRoom({serverUrl:string,name:string,token:PlayerConfig['token'],code?:string}):Promise<RoomSession>`; `CommandErrorCode` gồm `STALE_REVISION`, `NOT_AUTHORIZED`, `INVALID_ACTION`, `PROTOCOL_MISMATCH`, `COMMAND_ID_REUSED`, `PAUSED`. Dùng Socket.IO credentials theo room handshake, không dùng URL chia sẻ làm token người chơi.

- [ ] **RED:** 2/6 browser contexts có cùng public board/revision nhưng ownId khác; reconnect nhận snapshot mới nhất; rớt mạng trong lúc gửi buy không bị trừ hai lần; refresh giữ ghế, hai tab dùng một token không cùng điều khiển; người mới không vào ván đã start. Run: `npx vitest run apps/server/test/reconnect.test.ts apps/web/test/online.test.tsx` + `npx playwright test apps/web/e2e/online.spec.ts`.
- [ ] **Implement:** tạo/join bằng tên và mã/link `?room=ABC123`; riêng token reconnect lưu sessionStorage để refresh cùng tab. UI pending command khóa hành động xung đột, retries giữ nguyên commandId, server xác thực mỗi reconnect và gửi full PlayerView. Không tin recovery mặc định của thư viện; xử lý PROTOCOL_MISMATCH trước resume, không gửi lại command cũ qua phiên mới.
- [ ] **Disconnect policy:** tạm dừng khi bất kỳ người chơi đang sống mất kết nối; tất cả kết nối lại thì resume. Sau 120 giây mất người, hiện quyền kết thúc không người thắng cho người còn lại; không tự coi họ phá sản/bot hóa. Reconnect token mới thay thế connection cũ một cách tường minh. Host mất kết nối ở lobby thì giữ ghế tối đa 120 giây, sau đó chuyển host cho người ở lại; khi đã chơi, server vẫn là authority.
- [ ] **GREEN:** fake clock trước/sau 120 giây, host rời, server restart báo ván không còn chứ không giả resume. Test projection mỗi client, command retry sau ack thất lạc và đi về màn kết quả; mọi client ngừng gửi command khi ván closed.
- [ ] **Checkpoint:** commit `feat: complete online lobby reconnect and game flow`.

### Task 9: A9 — PWA thật, toàn bộ ảnh offline và cập nhật an toàn

**Files:** `web/vite.config.ts`, `src/pwa/{register,sw}.ts`, `public/icons/`, Home/Game; `web/test/pwa.test.tsx`, `e2e/pwa.spec.ts`.

**Interfaces:** `registerPwa({isNative:boolean,inGame:()=>boolean,onOfflineReady:()=>void,onUpdateReady:()=>void})`; native build sẽ không register service worker. IndexedDB save A6 độc lập với CacheStorage.

- [ ] **RED:** production build có manifest/icons/SW; truy cập lần đầu xong mới báo offline-ready; đóng và mở lại URL khi offline vẫn vào dashboard/game, đủ 26 ảnh; update giữa ván không reload; hủy update giữ ván. Run: `npx vitest run apps/web/test/pwa.test.tsx` + `npx playwright test apps/web/e2e/pwa.spec.ts` trên Vite preview, không trên dev server.
- [ ] **Implement:** injectManifest + Workbox precache `**/*.{html,js,css,jpg,jpeg,png,svg,json,webp,woff2}` và manifest; không cache socket/room API. Offline-ready chỉ sau SW activate và hoàn tất cache. Update prompt ở thời điểm an toàn, không skipWaiting/clientsClaim ép reload ván; giữ cache cũ cho client cũ tới khi chuyển xong. Rulebook/assets credits có trong bản build.
- [ ] **GREEN:** thử build v1 → lưu ván → build v2 → từ chối rồi chấp nhận update; save đọc lại đúng. Ngắt mạng trước khi precache xong phải báo chưa sẵn sàng thay vì giả khả năng offline; Android Chrome và Safari/WebKit có hướng dẫn cài phù hợp, không giả nút cài nếu browser không hỗ trợ.
- [ ] **Checkpoint:** commit `feat: ship installable offline PWA with safe updates`.

### Task 10: A10 — Gate WEB-PASS và bàn giao chạy web

**Files:** `playwright.config.ts`, `e2e/accessibility.spec.ts`, `docs/runbooks/web.md`, root README/`.env.example`; CI config tại `.github/workflows/web.yml` nếu dùng GitHub sau này, chạy local tương đương ngay hiện tại.

**Interfaces:** `npm run build` → web dist + server dist; `npm run test:e2e` tự khởi chạy web production preview và backend test, không cần dịch vụ thật.

- [ ] **Hoàn tất test nghiệm thu:** một ván offline đến winner; online 2 và 6 người với fixture tình huống từ core; không có nút “mẫu” hoặc dữ liệu người chơi giả trong sản phẩm. 26 ảnh đều giải mã được, credits hiện cả mua/đấu giá/chi tiết; 360/390/768/1024/1440px không tràn ngang. Keyboard, dialog accessible name/focus return, reduced motion, live announcements và màu không phải tín hiệu duy nhất.
- [ ] **Chạy đủ:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`; Chromium + Firefox + WebKit cho flow chính; fixture dùng seed/test injection riêng, production bundle không có endpoint sửa state/dice. Ghi browser versions và kết quả thực tế, không suy ra iPhone thật từ WebKit desktop.
- [ ] **Runbook:** dev web/server, build/start, ports/env, HTTPS/WSS và reverse proxy `/socket.io`, giới hạn một backend process và mất ván online khi process restart, cách cập nhật không làm mất offline save. Thêm kiểm tra graceful shutdown/drain: chặn room mới, chờ hoặc thông báo kết thúc trước khi dừng có chủ đích. Chưa chọn/đăng ký provider hoặc deploy công khai trong task này.
- [ ] **Đánh giá gate:** WEB-PASS chỉ khi web offline + online + PWA và các luật A1–A4 đạt; rà soát độc lập toàn bộ diff, sửa lỗi correctness/security/accessibility quan trọng, cập nhật bằng chứng. Không chờ Bluetooth để nghiệm thu web nhưng không tuyên bố đã xong mobile.
- [ ] **Checkpoint:** commit `test: verify web release candidate and document operations`; đánh dấu WEB-PASS rồi chuyển [B1](2026-11-17-game-hub-mobile.md).
