# Test Harness Repair (Phase 0) — Tasks

Work on a branch. Do not revert or build on the pre-existing uncommitted working-tree edits (`room.ts`, `roomHandlers.ts`, `bots/botTiming.ts`, `games/battle-bots/constants.ts`, `games/playcaller/constants.ts`, `GameView.tsx`). Do not change product behavior.

- [ ] 1. Fix the stale typecheck error (R4)
  - Remove the `maxPlayers` property from the `GameSettings` object literal at `packages/server/src/games/playcaller/consolationPlacements.test.ts:161`. Do not add `maxPlayers` back to the `GameSettings` type.
  - Verify: `pnpm --filter @games-of-chance/server typecheck` exits 0, then `pnpm -r typecheck` exits 0.
  - _Requirements: R4_

- [ ] 2. Add the jsdom `scrollTo` stub (R3)
  - In `packages/client/src/test-setup.ts`, stub `Element.prototype.scrollTo` as a no-op if absent.
  - Verify: `pnpm --filter @games-of-chance/client test` no longer reports `scrollRef.current.scrollTo is not a function`. Client failure count drops accordingly. (The seed-flaky property tests from finding T4 may still vary; only the scrollTo failure must be gone.)
  - _Requirements: R3_

- [ ] 3. Create the `cloudflare:workers` test stub (R1)
  - Inspect `node_modules/.pnpm/partyserver@0.5.10*/node_modules/partyserver/dist/index.js` to confirm exactly what `Server extends DurableObject` needs from the `DurableObject` base (constructor arg handling, member names like `ctx`/`env`).
  - Create `packages/server/src/test-support/cloudflare-workers-stub.ts` exporting a minimal `DurableObject` base class and `env`, matching those needs. Keep it small.
  - _Requirements: R1_

- [ ] 4. Wire the alias in server vitest config (R1)
  - In `packages/server/vitest.config.ts`, add `resolve.alias` mapping `"cloudflare:workers"` to the stub's absolute path. Keep `test.globals: true`.
  - Verify: `pnpm --filter @games-of-chance/server test` produces zero collection errors (no `cloudflare:` loader message). If imports still fail after a genuine attempt, STOP and report to the user; do not pivot to `@cloudflare/vitest-pool-workers` or rewrite `helpers.ts`.
  - _Requirements: R1_

- [ ] 5. Verify the failure landscape (R2)
  - Run `pnpm --filter @games-of-chance/server test`. Confirm the only remaining failures are assertion failures in the four known T2 files (`playcaller-consolation-generation.test.ts`, `BattleEngine.test.ts`, `BugConditionExploration.test.ts`, `SpectatorRevealDesync.exploration.test.ts`). Do NOT fix these; they are out of scope.
  - Record before/after counts (collection errors should be 0; note how many files now run that previously could not load).
  - _Requirements: R2_

- [ ] 6. Final verification and diff review (R5)
  - Run `pnpm -r typecheck` (expect exit 0) and `pnpm -r test` (expect: server shows only the T2 assertion failures; client shows no scrollTo failure; simulation 92/92 green).
  - Review the diff: only `packages/server/vitest.config.ts`, the new `packages/server/src/test-support/cloudflare-workers-stub.ts`, `packages/client/src/test-setup.ts`, and the one line in `consolationPlacements.test.ts` should appear. Confirm none of the pre-existing uncommitted product files were touched.
  - _Requirements: R1, R2, R3, R4, R5_

## Phase 0.5 — Resolve the T2 assertion failures (behavior-locking)

Context: the four "T2" files from the audit were re-triaged after the audit snapshot went stale. All seven currently-failing tests are STALE TESTS, not product bugs — each asserts behavior the implementation has since intentionally moved past. No source/runtime change is needed here. The goal is that the test suite captures the games **as they currently behave**, so the upcoming refactors (leaderboards, room.ts split, etc.) have a trustworthy regression baseline. That means: update assertions to the current behavior (do not weaken them to `toBeTruthy`/`not.toThrow` escape hatches), and delete only tests that assert a shape the code no longer produces.

Do these after tasks 1–6 (they depend on R1: the server suite must be able to load first). Still no product behavior change (R5 holds); only test files change.

- [ ] 7. Fix the BattleEngine tick-limit tests to track the real constant (T2)
  - Both `simulate1v1 > does not exceed 1000 ticks (TICK_LIMIT)` and `simulateFFA > does not exceed 1000 ticks (TICK_LIMIT)` in `packages/server/src/games/battle-bots/simulation/BattleEngine.test.ts` hardcode `expect(result.tickLog.length).toBeLessThanOrEqual(1000)`. `BATTLE_BOTS.TICK_LIMIT` is now `2000` (in `games/battle-bots/constants.ts`), so the engine legitimately runs to 2000 ticks.
  - Import `BATTLE_BOTS` and assert `toBeLessThanOrEqual(BATTLE_BOTS.TICK_LIMIT)` in both tests, so the bound follows the constant and cannot silently drift again.
  - Rename both test titles from "does not exceed 1000 ticks" to "does not exceed TICK_LIMIT ticks" (drop the literal).
  - Do NOT change `TICK_LIMIT` or any engine code. This is a stale-test fix that re-pins the assertion to the current behavior.
  - Verify: `pnpm --filter @games-of-chance/server test BattleEngine` — both tick-limit tests pass; the other 25 in the file stay green.
  - _Requirements: R2, R5, R6_

- [ ] 8. Delete the tautological Test Case C in the spectator-desync exploration test (T2)
  - In `packages/server/src/games/playcaller/SpectatorRevealDesync.exploration.test.ts`, the failing test `Test Case C (Client - Overshoot) > handleOutcomeReveal should NOT increment displayedPlayCount past playCount` inlines the OLD buggy update (`const buggyNextValue = displayedPlayCount + 1`) and asserts `buggyNextValue <= playCount`. That is `N+1 <= N` — it can never pass and it exercises no product code. The real `Math.min(prev + 1, playCount)` fix already shipped in `SpectatorDriveView.tsx`, `DriveView.tsx`, and `SpectatorGrid.tsx` (spectator-reveal-desync-fix spec, complete).
  - Remove that `it(...)` block. KEEP the sibling preservation test ("when displayedPlayCount < playCount, increment by 1 is valid") and KEEP Test Case A and Test Case B (both pass and guard the server-side `fillMissingPicks` behavior — real coverage).
  - Do NOT add a replacement client-state test here; genuine overshoot-guard coverage belongs with the components in the client package and is tracked separately (not in this phase).
  - Verify: `pnpm --filter @games-of-chance/server test SpectatorRevealDesync` — file passes with the remaining three tests.
  - _Requirements: R2, R5, R6_

- [ ] 9. Re-point the consolation-generation structure tests to the current consolidated model (T2)
  - File: `packages/server/src/__tests__/playcaller-consolation-generation.test.ts`. The two failing tests assert the OLD mini-bracket shape for 4-player elimination groups (a 2-matchup semifinal round + a 1-matchup final with empty `playerA`/`playerB`). The shipped `generateConsolationForRound`/`generateConsolationRounds` (consolation-concurrent-scheduling spec, complete) instead splits a 4-player group into TWO single-matchup placement games, both fully populated. NOTE: `generateConsolationRounds` is still live production code (used in the lottery/sim path in `room.ts`), so keep these tests — only correct their expected shape.
  - Update `8 players: ...`: after resolving with `higherSeedWins`, expect `consolation` length 3, each round exactly 1 matchup, `placementStart` values `[3, 5, 7]`, all matchups fully populated (no empty `playerA`/`playerB`).
  - Update `10-player bracket consolation structure`: expect `consolation` length 4, each round exactly 1 matchup, `placementStart` values `[3, 5, 7, 9]`, all matchups fully populated. Remove the assertions expecting a 2-matchup round and an empty-player round.
  - Before writing the numbers, confirm them against the implementation by reading `generateConsolationForRound` in `BracketEngine.ts` (placementStart = playersRemaining + 1; 4-player group → offsets `ps` and `ps+2`). Do not invent expected values — derive them from the code so the test locks in actual behavior.
  - Verify: `pnpm --filter @games-of-chance/server test playcaller-consolation-generation` — all 9 tests pass.
  - _Requirements: R2, R5, R6_

- [ ] 10. Re-point the BugConditionExploration schedule tests to the consolidated schedule (T2)
  - File: `packages/server/src/games/playcaller/BugConditionExploration.test.ts`. Three failing tests assume consolation rounds are scheduled CONCURRENTLY with the next main round (i.e. attached to `schedule[1]` alongside the quarterfinals). The shipped `buildSchedule` instead consolidates ALL consolation into ONE dedicated entry (`mainBracketRoundIndex === null`, `description: "Consolation"`) placed between the Semifinal and Final entries. So after resolving the play-in and one `currentScheduleIndex++`, `schedule[1]` is quarterfinal-only; the consolation matchups live on the later null-main entry.
  - `active matchups for next game round should include BOTH quarterfinal AND consolation matchups` and `beginPlaycallerDown logic: schedule-based lookup provides combined matchups`: rewrite so the "combined round" assertion reads the consolidated `Consolation` schedule entry (find the entry with `mainBracketRoundIndex === null`) and asserts its matchups (via `getActiveMatchupsForSchedule`) include the play-in losers, AND that the quarterfinal entry has the 4 main matchups. Keep verifying both main and consolation matchups exist and are reachable through the schedule — just off the entries where they actually live now.
  - `consolation round with empty playerA/playerB should not be included in active matchups`: the current generation never produces an empty-slot round (4-player groups become two populated 1v1 games), so `expect(emptySlotRound).toBeDefined()` can no longer hold. Replace this with a test of the real invariant: construct (or take from `getActiveMatchupsForSchedule`) a matchup set that includes an empty-slot matchup and assert `getActiveMatchupsForSchedule` filters it out — i.e. the function never returns a matchup with empty `playerA`/`playerB`. If a faithful construction isn't practical, delete this test rather than assert a precondition the code designed out. Prefer keeping a filter-invariant test.
  - Keep the two passing tests in this file (`after play-in resolves ... consolation rounds should exist` and `consolation is generated incrementally after each round`) unchanged.
  - Derive all expected schedule indices/shapes by reading `buildSchedule` and `getActiveMatchupsForSchedule` in `BracketEngine.ts`; mirror how production `advancePlaycallerBracket` (`roomHandlers.ts`) advances the schedule (single `currentScheduleIndex++` per resolve).
  - Verify: `pnpm --filter @games-of-chance/server test BugConditionExploration` — all tests pass.
  - _Requirements: R2, R5, R6_

- [ ] 11. Full green baseline and diff review (T2)
  - Run `pnpm -r typecheck` (expect exit 0) and `pnpm -r test`. Expect: server fully green (zero collection errors AND zero assertion failures), client shows no `scrollTo` failure, simulation 92/92.
  - If any test outside the four T2 files newly fails, STOP and report — it means a real regression was surfaced by the now-loading suite, which is a decision for the user, not a silent fix.
  - Review the diff: beyond the Phase 0 files (tasks 1–6), only the four T2 test files should be modified — `BattleEngine.test.ts`, `SpectatorRevealDesync.exploration.test.ts`, `playcaller-consolation-generation.test.ts`, `BugConditionExploration.test.ts`. Confirm no production/source file and none of the pre-existing uncommitted working-tree files were touched.
  - Record the final counts (files run, tests passed) so the green baseline is documented for the refactor phases that depend on it.
  - _Requirements: R2, R5, R6_
