# Vườn Hoa Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in this session. The user approved the interactive match-three design; proceed through completion without another approval round.

**Goal:** Ship the approved sculpted-flower match-three game inside Nhà Chơi, with quick play, a 12-level campaign and independent offline saves.
**Architecture:** A pure game-core module owns moves, cascades, obstacles, goals and hints. React uses the shared core, existing Dialog/Icon/navigation, local CSS art and a versioned validated localStorage record. Persist completed moves before playing their visual frames so navigation never loses an accepted move.
**Tech Stack:** Existing TypeScript, React, Zod, Vitest and Playwright; no dependencies or server changes.
**Spec:** `docs/superpowers/specs/2026-11-21-flower-garden-design.md`; the approved swap-match-three section supersedes earlier link-chain rules.

## Global Constraints

- 7 × 7 board, five visibly distinct flower species; orthogonal swap, horizontal/vertical matches of at least three; reject other moves without consuming a turn.
- Quick play: 20 turns, 1,500 points. Campaign: all 12 configured levels, sequential unlock, stars/high scores and replay.
- Retain 3D-style layered petals, exchange/burst/fall effects, hints, pointer/touch/keyboard controls and reduced motion.
- Grass under matched tiles clears; each distinct matched flower next to rock/bud deals one damage (rock 2 HP, bud 4 HP). Cleared obstacles become normal tiles. Shovel hits one tile; Water clears one ordinary flower plus matching neighbors of the same color. Each campaign attempt grants one of each, no turn cost.
- Completed-turn saves only, separate from other games; errors remain visible, corrupted records need explicit replacement, concurrent tabs cannot silently overwrite.

## Review Focus

- Row wrapping/diagonal gestures cannot become legal swaps (core and browser tests).
- Last-turn wins beat loss and animations cannot discard an accepted move (core and UI reload tests).
- Constant or adversarial random sources must not hang generation/cascades (core bounded generation tests).
- Tampered saves, unavailable storage and concurrent tabs must not silently destroy a different saved position (storage/UI tests).
- Campaign obstacles cannot trap gravity or make level goals impossible (level/config tests and simulated campaign games).

### Task 1: Pure match-three engine

Files: create `packages/game-core/src/flower.ts`, `packages/game-core/test/flower.test.ts`; modify `packages/game-core/src/index.ts`.
Interfaces: `createFlowerGame(mode, level?, random?)`, `swapFlower(game,a,b,random?)`, `useFlowerTool(game,tool,index,random?)`, `flowerHint(board)`, `flowerMatches(board)`, `flowerGoals(game)`, `flowerStars(game)`, `FLOWER_LEVELS`. Results include a final immutable game plus animation frames; invalid moves return null.

- [x] Add and run failing tests for stable playable generation, row-wrap/diagonal rejection, legal tutorial move, cross matching, cascades, goals, last-turn victory, blockers/grass/buds, tools, input immutability and finished-game rejection.
- [x] Implement level configuration, bounded board generation, match/resolve/drop logic and final-state transitions.
- [x] Run `npx vitest run packages/game-core/test/flower.test.ts`; expected all pass.

### Task 2: Validated offline storage

Files: create `apps/web/src/flower/save.ts`, `apps/web/test/flower-save.test.ts`.
Interfaces: `readFlowerSave()`, `writeFlowerSave(save, expectedRaw)`, `emptyFlowerSave()`, `recordFlowerGame(save,game)`, `flowerUnlocked(save)`. Record has version, 12 level records and quick/journey games; returned raw record provides compare-before-write conflict detection.

- [x] Add/run failing tests: round trip, malformed and semantically invalid JSON, incompatible version, quota failure, conflict rejection, independent game modes, monotonic progress.
- [x] Implement using installed Zod and computed core goals/status; reject unstable/inconsistent boards and impossible obstacle counts.
- [x] Run `npx vitest run apps/web/test/flower-save.test.ts`; expected all pass.

### Task 3: Playable UI and integration

Files: create `apps/web/src/flower/{Screen,Board,Flower}.tsx`, `apps/web/src/flower/flower.css`, `apps/web/test/flower.test.tsx`; modify `App.tsx`, `screens/Home.tsx`, `public/icons.svg` if needed.
Interfaces: `FlowerScreen({onHome,onRules,onInGame})`, `FlowerRules`, `Flower({color})`; Board accepts rendered frame, selection, swap/tool callbacks and animation state.

- [x] Add/run failing UI tests opening from Home, quick/campaign, selected swap, final-state save/remount, replacing unfinished save, locked levels, storage conflicts/errors and returning home.
- [x] Implement scoped CSS art based on approved preview, responsive board, pointer capture/cancel, keyboard selection, effect frames, finite status/result views, map, retry/next, saved progress and explicit conflict resolution.
- [x] Reach every App entry point: sidebar/Home, breadcrumb, rules, current game, Back and PWA update guard; reuse Dialog and shared buttons.
- [x] Run focused UI/storage/core tests and `npm run typecheck`/`npm run lint`; expected all pass.

### Task 4: Browser validation and handoff

Files: create `apps/web/e2e/flower.spec.ts`; update README and `docs/runbooks/flower.md`.

- [x] Cover mouse swap, invalid move rollback, mobile touch swipe, keyboard flow, reload continuation, campaign obstacles/unlock/result states, offline cached PWA and axe scan of new screens.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then Chromium flower/Caro/offline/accessibility e2e. Inspect desktop and 375px screenshots; test WebKit flower flows when available.
- [x] Have one fresh reviewer check the completed work and address material findings with regression tests.
- [x] Document actual verification and limitations; retain changes in the user's existing feature checkout, no publish/push or unsolicited merge.

## Execution ledger

Ruling: Work in the existing `feat/game-hub` feature checkout, preserve unrelated untracked files and leave the complete change reviewable there. Do not create a second checkout or request the same authorization again.
Ruling: Update remaining link-chain rules to the approved match-three mechanism. Grass clears under matches; rock/bud take damage from distinct adjacent matched cells. Water clears one flower and same-color orthogonal neighbors because flower growth no longer exists.


## Verification ledger — 22/11/2026

- Task 1 complete: core tests cover stable generation with constant RNG, legal/illegal swaps, crossing matches, bounded cascades, last-turn wins, grass/rock/bud damage, direct tools, segmented gravity and immutable inputs. A deterministic goal-seeking player completes all 12 levels; separate exploratory simulation won 3/3 attempts at every level.
- Task 2 complete: schema/semantic validation, incompatible/corrupt JSON, quota failure, independent mode saves, monotonic progress and same-base simultaneous write tests pass. An IndexedDB readwrite mutex now serializes compare/write across tabs; validation also checks a saved win against recorded best results.
- Task 3 complete: Home/sidebar/breadcrumb/rules/current-game shortcut/Back/PWA guard integrated. React retains the mounted game across internal navigation, preserving unsaved memory after quota errors. Confirmations distinguish replacing one unfinished game from resetting a corrupt whole record.
- Final fresh unit/component run: `npm test` → 171 passed, 1 skipped (pre-existing opt-in database integration test).
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` → passed.
- Final Chromium command: `npx playwright test apps/web/e2e/flower.spec.ts apps/web/e2e/caro.spec.ts apps/web/e2e/offline.spec.ts apps/web/e2e/accessibility.spec.ts --project=chromium` → 17 passed. Earlier a synchronous Monopoly viewport assertion failed once; isolated rerun and final complete regression run passed without modifying the pre-existing test.
- Flower tests exercise real mouse and emulated touch swaps, diagonal/long gesture rejection, wrong-swap rollback, tool pointer cancellation, last-turn campaign result/unlock, reload during effects, offline PWA, hints, keyboard, reduced motion, 320/375/768/1440px layouts, axe scans of mode picker/map/board/result, and synchronized independent-tab writes.
- Fresh reviewer `flower_final_review` completed a whole-feature review. All material findings fixed: gesture interpretation, tool cancellation and direct damage, atomic same-base writes, corrupt-save reset copy, current-game shortcut, score/star display and saved-win consistency. Added regression coverage; no deferred review findings.
- Additional regression: effect playback waits for the save attempt; an explicitly blocked write cannot begin swap effects. Quota failure still permits play with a visible warning and retained in-memory state.
- Ruling: use a local IndexedDB transaction only as the cross-tab mutex while preserving the versioned localStorage save format. If IndexedDB/storage is unavailable, warn and keep the game in memory rather than performing an unsafe unguarded write.
- Ruling: keep native device installation, store release and deployment outside this change. Common web/native source is updated, but Android/iOS hardware performance remains unverified.
- Final WebKit command: `npx playwright test apps/web/e2e/flower.spec.ts --project=webkit` → 6 passed.
- Task 4 complete. Preview serves the final build at `http://127.0.0.1:5178/` (HTTP 200). Changes remain uncommitted in `feat/game-hub`; no push, merge or deploy. Unrelated pre-existing untracked files were preserved.
