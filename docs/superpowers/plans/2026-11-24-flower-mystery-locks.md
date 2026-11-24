# Vườn khóa bí ẩn Implementation Plan

> Execute inline using the existing feature checkout. The user approved the proposed mode; no additional approval gate is needed.

**Goal:** Add a third flower mode with 4–6 fixed random locked cells, each randomly unlocking after 2–4 valid turns or 2–4 orthogonally adjacent match waves.
**Architecture:** Reuse the obstacle representation and shared match/gravity engine. Add `mystery` as a separately saved quick-style mode (20 turns, 1,500 points). Timer locks tick once at the end of an accepted swap; blast locks tick once per neighboring match wave. Unlock reveals the existing flower, gives no direct points, and allows natural falling/matches.
**Tech stack:** Existing TypeScript/React/Zod/Vitest/Playwright; no new dependencies.
**Approved design:** User accepted the 4–6 tiles, 2–4 counters, orthogonally adjacent explosion interpretation and fixed blocking cells. Names/goal reuse, no boosters in this quick-style mode, and backward-compatible save defaults are implementation choices.

## Review focus

- Invalid swaps, hints, cancelled gestures and tools never tick time; cascades count as distinct explosion waves but multiple adjacent flowers in one wave only count once per blast lock.
- Locks stay anchored, block swaps/matches/gravity, survive shuffles with unchanged counters, and ordinary boosters cannot destroy them.
- Newly revealed flowers may match and cascade; turn counters tick only once even when their release causes more cascades. Last-turn win still beats loss.
- Generated boards always have a valid move, including constant RNG; clearing/expiry is bounded.
- Existing v1 quick/campaign saves load without data loss. Separate mystery saves validate counts/types/counters and restore exactly.

### Task 1: Rules and regression tests

Files: `packages/game-core/src/flower.ts`, `packages/game-core/test/flower.test.ts`.
Interfaces: extend FlowerMode with `mystery`, obstacle kinds with `turn-lock`/`blast-lock`, frames with `unlock`. Reuse createFlowerGame/swapFlower/useFlowerTool/flowerHint.
- [x] Write/run failing tests for generation, timer ticks, one blast tick per adjacent match wave, no distant/diagonal damage, rejected swaps/tools, expiry, gravity, immutable inputs and non-hanging cascades.
- [x] Implement bounded random placement and shared unlock resolution; preserve existing two modes.
- [x] Run focused core tests, expected all pass.

### Task 2: Save compatibility and UI

Files: `apps/web/src/flower/{save.ts,Screen.tsx,Board.tsx,flower.css}`, existing flower save/UI tests.
Interfaces: optional-on-read `mystery` save slot default null; same version/key/atomic writer. Add mode card, resume/replay names, lock countdown labels, distinct timer/blast icons and unlock animation.
- [x] Add/run failing save/UI tests for legacy defaults, roundtrip and validation, independent mode slots, mode entry/resume and lock labels.
- [x] Implement shared paths; only valid Mystery games may contain dynamic locks. Keep existing saved states untouched until a real write.
- [x] Run typecheck, lint and focused tests.

### Task 3: Browser and final verification

Files: `apps/web/e2e/flower.spec.ts`, `docs/runbooks/flower.md`.
- [x] Test actual mode entry and blocked swaps, valid timer decrement and visible opening, count restore on reload, 375px layout and axe scan.
- [x] Run full unit suite, typecheck/lint/build, Flower Chromium/WebKit e2e, then an independent focused review and fix material findings.
- [x] Update rules/runbook and report verified results, leaving unrelated in-progress games untouched.

## Ledger

- Work is scoped to flower source/tests/docs; other in-progress Caro/Dino/Kiln edits are preserved.

- Focused verification: 38 flower core/save/UI tests passed, including existing modes and new locks.
- Whole repository suite: 244 passed, 1 skipped (pre-existing opt-in live database test).
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: passed.
- Final Chromium flower e2e: 8/8 passed; actual Mystery start, blocked gesture, valid-turn countdown, exact reload, expiry/release, 375px fit and axe scan included.
- Independent review `flower_mystery_review`: fixed locked-flower recoloring on shuffle, exposed held-flower names to screen readers, replaced transient-message assertion with persistent board/playability assertion.
- Added deterministic regressions for two separate blast waves and timer expiry causing a new match without a second time tick. Fixes verified red→green; no deferred review findings.
- Final preview runs at http://127.0.0.1:5178/; shared source updates web/PWA/native UI, but no physical Android/iOS test or deploy performed.
- Final WebKit flower e2e: 8/8 passed. All three tasks complete, with the user's existing unrelated work preserved and no new dependencies.
