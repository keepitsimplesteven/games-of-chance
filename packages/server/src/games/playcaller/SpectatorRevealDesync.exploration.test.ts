import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import {
  recordPlaySelection,
  resolveMatchupDown,
  fillMissingPicks,
  getDownPicks,
  setDriveStates,
  resetDriveStates,
} from "./PlaycallerPlugin"
import { createDriveState } from "./drive"
import type { OffensivePlayId, DefensivePlayId } from "./drive"

/**
 * Bug Condition Exploration: Spectator Reveal Desync Fix
 *
 * **Validates: Requirements 1.4, 1.5, 1.6, 1.2**
 *
 * GOAL: Surface counterexamples that demonstrate both bugs exist on UNFIXED code.
 *
 * Bug Condition (Server):
 *   isBugCondition_Server(input) WHERE
 *     downPicks[matchupId].offense IS DEFINED
 *     AND downPicks[matchupId].defense IS DEFINED
 *     AND matchup was already resolved in this down cycle
 *     AND fillMissingPicks() includes matchupId in return array
 *
 * Bug Condition (Client):
 *   isBugCondition_Client(input) WHERE
 *     onOutcomeReveal fires
 *     AND displayedPlayCount >= playCount
 *     AND increment would cause displayedPlayCount > playCount
 *
 * EXPECTED OUTCOME: Tests FAIL on unfixed code (this is correct — it proves the bugs exist).
 * DO NOT attempt to fix the code or the tests when they fail.
 */

// --- Arbitraries ---
const offensivePlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom(
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive"
)

const defensivePlayArb: fc.Arbitrary<DefensivePlayId> = fc.constantFrom(
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive"
)

describe("Bug Condition Exploration: Spectator Reveal Desync (Server + Client)", () => {
  beforeEach(() => {
    resetDriveStates()
  })

  describe("Test Case A (Server - Double Resolution): fillMissingPicks returns already-resolved matchups", () => {
    it("fillMissingPicks() should NOT include a matchup that already has both picks present", () => {
      /**
       * Property 1: Bug Condition — No Double-Resolution of Matchup Downs
       *
       * Set up 2 matchups. Resolve Matchup A via recordPlaySelection (both offense+defense picks).
       * Then call fillMissingPicks() — assert it does NOT include Matchup A in the return array.
       *
       * Bug: currently fillMissingPicks() returns ALL non-complete matchups unconditionally,
       * even those that already have both picks present (were resolved earlier in the same
       * down cycle via SUBMIT_PICK).
       *
       * EXPECTED: This test FAILS on unfixed code because fillMissingPicks includes matchupA.
       */
      fc.assert(
        fc.property(
          offensivePlayArb,
          defensivePlayArb,
          (offensePlay, defensePlay) => {
            resetDriveStates()

            // Set up 2 matchups: A and B
            const driveA = createDriveState("playerA-off", "playerA-def", 2, 1)
            const driveB = createDriveState("playerB-off", "playerB-def", 2, 1)
            setDriveStates({
              matchupA: driveA,
              matchupB: driveB,
            })

            // Record both picks for matchup A (simulating early resolution via SUBMIT_PICK)
            recordPlaySelection("playerA-off", "matchupA", offensePlay)
            recordPlaySelection("playerA-def", "matchupA", defensePlay)

            // Verify matchup A has both picks present
            const picks = getDownPicks()
            expect(picks["matchupA"]?.offense).toBeDefined()
            expect(picks["matchupA"]?.defense).toBeDefined()

            // Now call fillMissingPicks (simulating what happens when play clock expires)
            const filledMatchups = fillMissingPicks()

            // EXPECTED BEHAVIOR (FIXED code): matchupA should NOT be in the result
            // because it already has both picks present — nothing was "filled"
            //
            // BUG (UNFIXED code): matchupA IS included because fillMissingPicks
            // unconditionally pushes all non-complete matchups to the result array
            expect(filledMatchups).not.toContain("matchupA")

            // matchupB SHOULD be included because it genuinely had missing picks
            expect(filledMatchups).toContain("matchupB")
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe("Test Case B (Server - Stale picks don't cause double-resolution): fillMissingPicks skips fully-picked matchups", () => {
    it("fillMissingPicks() skips matchups where both picks persist after resolveMatchupDown", () => {
      /**
       * Property 1: Bug Condition — Stale picks no longer cause double-resolution
       *
       * After resolving Matchup A's down via resolveMatchupDown, the picks
       * intentionally PERSIST in downPicks (needed for allActiveMatchupsResolved).
       * However, fillMissingPicks() must NOT include matchupA in its return array
       * because no picks were actually "filled" (both were already present).
       *
       * This validates that Task 3.1's `filled` flag prevents the original bug
       * without needing to delete picks (which broke allActiveMatchupsResolved).
       */
      fc.assert(
        fc.property(
          offensivePlayArb,
          defensivePlayArb,
          (offensePlay, defensePlay) => {
            resetDriveStates()

            // Set up two matchups
            const driveX = createDriveState("offense-player", "defense-player", 2, 1)
            const driveY = createDriveState("other-off", "other-def", 2, 1)
            setDriveStates({ matchupX: driveX, matchupY: driveY })

            // Record both picks for matchupX
            recordPlaySelection("offense-player", "matchupX", offensePlay)
            recordPlaySelection("defense-player", "matchupX", defensePlay)

            // Resolve matchupX's down (picks persist — not deleted)
            resolveMatchupDown("matchupX")

            // Verify picks still exist (intentional — needed for allActiveMatchupsResolved)
            const picksAfter = getDownPicks()
            expect(picksAfter["matchupX"]?.offense).toBeDefined()
            expect(picksAfter["matchupX"]?.defense).toBeDefined()

            // Key assertion: fillMissingPicks does NOT include matchupX
            // because both picks were already present (filled flag stays false)
            const filledMatchups = fillMissingPicks()
            expect(filledMatchups).not.toContain("matchupX")

            // matchupY IS included because it genuinely had missing picks
            expect(filledMatchups).toContain("matchupY")
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe("Test Case C (Client - Overshoot): displayedPlayCount exceeds playCount", () => {
    it("handleOutcomeReveal should NOT increment displayedPlayCount past playCount", () => {
      /**
       * Property 2: Bug Condition — No displayedPlayCount Overshoot
       *
       * Simulate displayedPlayCount === playCount === N, then call handleOutcomeReveal.
       * Assert displayedPlayCount remains N, not N+1.
       *
       * The client uses: setDisplayedPlayCount((prev) => prev + 1)
       * The fix should be: setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
       *
       * We test the LOGIC here without React state — just the update function:
       * - Current (buggy): (prev) => prev + 1
       * - Expected (fixed): (prev) => Math.min(prev + 1, playCount)
       *
       * EXPECTED: This test FAILS on unfixed code because the unbounded increment
       * causes displayedPlayCount to exceed playCount.
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (playCount) => {
            // Simulate the state: displayedPlayCount === playCount (fully caught up)
            const displayedPlayCount = playCount

            // Simulate the CURRENT (buggy) handleOutcomeReveal:
            // setDisplayedPlayCount((prev) => prev + 1)
            const buggyNextValue = displayedPlayCount + 1

            // The bug: this overshoots playCount
            // EXPECTED BEHAVIOR (FIXED): the result should never exceed playCount
            // EXPECTED: This assertion FAILS on unfixed code
            expect(buggyNextValue).toBeLessThanOrEqual(playCount)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("when displayedPlayCount < playCount, increment by 1 is valid (preservation)", () => {
      /**
       * This confirms the normal case still works: when displayedPlayCount < playCount,
       * incrementing by 1 is correct behavior. This should PASS on both fixed and unfixed code.
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 99 }),
          (playCount, offset) => {
            // Ensure displayedPlayCount < playCount
            const displayedPlayCount = Math.min(offset, playCount - 1)
            fc.pre(displayedPlayCount < playCount)

            // Increment by 1
            const nextValue = displayedPlayCount + 1

            // Should still be <= playCount
            expect(nextValue).toBeLessThanOrEqual(playCount)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
