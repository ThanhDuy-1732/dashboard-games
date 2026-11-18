# Các quyết định khi triển khai

Các quyết định và giới hạn đã ghi trong quá trình thực hiện, giữ nguyên để đối chiếu với kế hoạch.

- Ruling: Work in newly initialized repository on feat/game-hub, rather than creating a second worktree — no existing branch or product changes need protection; this preserves the user's active project path and prototype preview.

- Ruling: Plan headings normalized to Task N: A/B labels so the execution bookkeeping tools can extract briefs; scope unchanged.

- Task 1: Ruling: TypeScript 6.0.3 selected instead of registry latest 7.0.2 — typescript-eslint requires <6.1; no force/legacy-peer-deps used, cost is deferring a compiler-major upgrade until lint tooling supports it.

- Task 2: Ruling: shared settlePayment introduced in economy.ts during A2 — cards, taxes and mandatory jail fees already require a single debt primitive; A3 extends this same helper rather than duplicating payment logic.

- Task 4: Ruling: preserve resumePhase in authoritative state for auctions/transfers initiated before rolling — otherwise a management action can silently skip the player's required roll. Schema updated before any released saved-game format exists; no migration of user saves is needed yet.

- Task 6: Ruling: SaveStore.load reports a recovered flag and replace writes the new game atomically with the old backup — needed to tell users when recovery used an older snapshot and prevent a failed new-game write from deleting the old save. claim/release enforce a 15s writer lease, renewed every 5s; expiry permits recovery after a closed/crashed tab.

- Task 7: GREEN 71/71 total tests, typecheck/lint passed. Real Socket.IO tests verify capacity/readiness/host checks, private projections, forged commands, concurrent purchases, duplicate replies, origin allowlist, oversized frames and rate limits. Shared authority retains dedupe and revisions. Ruling: direct authenticated Rooms→GameAuthority calls replace separate auth/authority wrappers; synchronous Node dispatch provides per-room serialization without another queue. All-offline rooms close after 30 minutes; active games do not expire.

- Task 9: Ruling: native ServiceWorker API replaces virtual registerSW helper — no runtime Workbox window dependency is needed, and explicit acceptance controls reload. Per-build caches are retained for other open tabs; pruning is deferred until client-aware cleanup is needed (storage may grow across many releases).

- Final: Ruling: native/Bluetooth outside this WEB-PASS review — keep B1–B5 gated on web; no mobile completion inferred. Browser rendering/accessibility/PWA judged through separate actual browser checks. Public hosting/multi-process recovery remain outside authorized local implementation; one-process limits explicit in runbook.

- Final: Ruling: select a legal building target when bidding, then build there if winner — equivalent player choice while board is frozen, avoids a second placement phase; rulebook clarified. Cost: a bidder must choose before committing the bid rather than after winning.

Không có phát hiện nhỏ từ rà soát độc lập được hoãn lại.

## Android/iOS và điểm dừng kiểm chứng

- Task 1: Ruling: single-window native cold start takes over the previous process lease immediately, while a previously acquired writer remains fenced after takeover — necessary because force-kill cannot emit pagehide; iOS multiple scenes disabled and Android singleTask. Cost: enabling native multi-window later requires revisiting this policy. Web tab fencing unchanged.

- Task 1: Ruling: keep compile target iOS15.0 and supply standard structuredClone/dialog fallbacks plus UUID WebCrypto fallback; replace ES2023 array methods and add Safari15 CSS fallbacks — avoids treating a modern simulator as proof of oldest-device support. Real iOS15 and airplane-mode iPhone tests remain unverified.

- Ruling: stop Bluetooth integration at the real-device gate and continue only independent native lifecycle checks from B4 — required by plan, user has no hardware; does not replace BLE, reduce promised capacity, or label simulations as PASS.

- Task 4: Ruling: add setActive to GameSession and optional lifecycle save callback — one shared transport contract, offline callback retains IndexedDB save/lease ordering without a separate native storage adapter. Cost: future Bluetooth adapter must implement setActive; no runtime fallback to another transport.

- Task 4: Ruling: full rulebook displayed inside the app from canonical text — Capacitor iOS target=_blank opens UIApplication for capacitor:// URLs, so the original local-file link cannot work. Same UI now works on web and both native platforms; no remote document dependency.
