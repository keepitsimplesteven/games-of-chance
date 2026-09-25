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
