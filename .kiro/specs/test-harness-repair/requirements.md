# Test Harness Repair (Phase 0) — Requirements

## Purpose

Get the repository to a green, trustworthy baseline so later autonomous work can rely on `pnpm -r typecheck` and `pnpm -r test` as a definition of done. This spec fixes the infrastructure problems that make the current test suite untrustworthy. It does not change product behavior.

This is Phase 0 of the code-quality audit (see `.kiro/specs/code-quality-audit/findings.md`, findings T1, T3, T5). It is intended to run first, before any other audit follow-up, because most server tests currently cannot execute at all.

## Background (verified)

- `packages/server/vitest.config.ts` is `{ test: { globals: true } }` with no worker pool or module alias.
- `packages/server/src/room.ts` imports `partyserver`, whose `dist/index.js` does `import { DurableObject, env } from "cloudflare:workers"` and defines `class Server extends DurableObject`. Node's default ESM loader cannot resolve the `cloudflare:` scheme, so every test that imports `room.ts` fails at collection with: `Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. Received protocol 'cloudflare:'`.
- `packages/server/src/__tests__/helpers.ts` imports `GameRoom` from `../room` and constructs it with a hand-mocked `DurableObjectState` and `Env`, plus mock connections. It does not use a real Workers runtime. It only needs the `cloudflare:workers` import to resolve.
- 15 of 19 failing server test files fail for this single reason (collection error, zero failed assertions).
- `packages/client/src/test-setup.ts` only imports `@testing-library/jest-dom/vitest`. jsdom does not implement `Element.prototype.scrollTo`, so `PlayByPlayAnnouncer.tsx` throws in an effect during `SpectatorDriveView.property.test.tsx`.
- `pnpm -r typecheck` currently reports exactly one error: `packages/server/src/games/playcaller/consolationPlacements.test.ts:161` sets a `maxPlayers` property that no longer exists on `GameSettings`.
- `@vitest/coverage-v8@3.2.7` is already a root dev-dependency.

## Requirements

### R1 — Server tests load and run
As a developer, I want the server test files to execute so that `room.ts` behavior is actually verified.
- WHEN `pnpm --filter @games-of-chance/server test` runs, THEN no test file fails at collection with the `cloudflare:` loader error.
- WHEN the fix is applied, THEN the mechanism is a module alias/stub for `cloudflare:workers` scoped to the server test environment (not a change to `room.ts` or `partyserver`, and not a rewrite of the test helper).
- The stub SHALL provide the `DurableObject` base class and `env` export that `partyserver` imports, sufficient for `class Server extends DurableObject` to load and for the existing `helpers.ts` mock construction to work.

### R2 — Distinguish real failures from the harness failure
As a developer, I want to know which server tests fail on their own merits once they can load.
- WHEN server tests run after R1, THEN the remaining failures are assertion failures, not collection errors.
- The four files identified in findings T2 (`playcaller-consolation-generation.test.ts`, `BattleEngine.test.ts`, `BugConditionExploration.test.ts`, `SpectatorRevealDesync.exploration.test.ts`) must first run as assertion failures rather than being hidden behind the collection error. Resolving those assertion failures is handled in Phase 0.5 (see R6); it was re-scoped into this spec after re-triage showed all of them are stale tests, not product bugs.

### R3 — Client jsdom scroll stub
As a developer, I want client tests that render `PlayByPlayAnnouncer` to pass under jsdom.
- WHEN `pnpm --filter @games-of-chance/client test` runs, THEN no test fails due to `scrollRef.current.scrollTo is not a function`.
- The fix SHALL be a jsdom polyfill/stub in the client test setup (stub `Element.prototype.scrollTo` as a no-op), not a change to `PlayByPlayAnnouncer.tsx` behavior. A minimal guard in the component is acceptable only if the setup-file stub is not feasible.

### R4 — Typecheck is green
As a developer, I want `pnpm -r typecheck` to pass so it can gate later work.
- WHEN `pnpm -r typecheck` runs, THEN it exits 0.
- The one known error is the stale `maxPlayers` reference in `consolationPlacements.test.ts`. Fix it by removing/correcting the stale field to match the current `GameSettings` type. Do not add `maxPlayers` back to `GameSettings`.

### R5 — No product behavior change
- This spec SHALL NOT change runtime behavior of the client or server. Only test configuration, test setup, a test-only stub module, and stale test code may change.
- The pre-existing uncommitted edits in the working tree (`room.ts`, `roomHandlers.ts`, `bots/botTiming.ts`, `games/battle-bots/constants.ts`, `games/playcaller/constants.ts`, `GameView.tsx`) SHALL NOT be reverted, altered, or built upon. Leave them exactly as-is.

### R6 — The T2 tests capture current behavior (Phase 0.5)
As a developer about to refactor the games, I want the T2 tests to lock in how the games behave **today**, so a refactor that changes behavior fails a test.
- Re-triage finding: all seven currently-failing T2 assertions are stale tests (they assert behavior the implementation intentionally moved past), not product bugs. See `.kiro/specs/code-quality-audit/findings.md` and the Phase 0.5 tasks for the per-file analysis.
- WHEN a T2 test is corrected, THEN its assertions SHALL be re-pinned to the behavior the current implementation actually produces (values derived by reading the implementation, e.g. `BATTLE_BOTS.TICK_LIMIT`, `generateConsolationForRound`, `buildSchedule`), NOT weakened to trivially-true checks.
- A T2 test SHALL be deleted only when it asserts a shape the code no longer produces and no equivalent current-behavior invariant can replace it (documented per task). Passing sibling tests that provide real coverage SHALL be kept.
- This work changes only the four T2 test files. It SHALL NOT modify production/source code, `TICK_LIMIT`, the bracket engine, or the pre-existing uncommitted working-tree files.
- If enabling the now-loading suite surfaces a failure OUTSIDE the four T2 files, that is a potential real regression: STOP and report to the user rather than fixing it under this spec.

## Definition of done

- `pnpm -r typecheck` exits 0.
- `pnpm --filter @games-of-chance/server test` shows zero collection errors AND zero assertion failures (Phase 0.5 resolves the four T2 files).
- `pnpm --filter @games-of-chance/client test` shows no `scrollTo` failure.
- `pnpm --filter @games-of-chance/simulation test` remains fully green (92/92).
- No source file outside test setup, test config, the new test-only stub, and the one stale test line is modified.

## Out of scope

- Adding new coverage beyond re-pinning the existing T2 tests (that is later phases). Phase 0.5 corrects the four T2 files to match current behavior but does not add new test files or cover new surfaces.
- Any leaderboard, theming, settings, autoplay, create-room, or orchestration work.
- Adopting `@cloudflare/vitest-pool-workers` or rewriting `helpers.ts` (see design for why the lighter alias approach is preferred; escalate to the user before taking the heavier path).
