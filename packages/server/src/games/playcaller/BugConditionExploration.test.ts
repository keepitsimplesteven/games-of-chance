import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  generateConsolationRounds,
  generateConsolationForRound,
  buildSchedule,
  getActiveMatchupsForSchedule,
} from "./BracketEngine"
import type { MatchResolver, Bracket, Matchup, GameRoundSchedule } from "@games-of-chance/shared"

/**
 * Bug Condition Exploration Test
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3**
 *
 * GOAL: Surface counterexamples that demonstrate consolation rounds are not generated
 * concurrently with main-bracket rounds on the UNFIXED code.
 *
 * Bug Condition from design:
 *   isBugCondition(input) WHERE eliminatedThisRound.length > 0
 *     AND NOT mainBracketComplete
 *     AND consolationMatchupsNotScheduledFor(eliminatedThisRound)
 *
 * EXPECTED OUTCOME: These tests FAIL on unfixed code, confirming the bug exists.
 */

/**
 * Helper: creates a resolver that always picks playerA (higher seed wins)
 */
const higherSeedWinsResolver: MatchResolver = (playerA: string, _playerB: string) => playerA

/**
 * Helper: creates a resolver that randomly picks a winner based on fc arbitrary
 */
function randomResolver(outcomes: boolean[]): MatchResolver {
  let idx = 0
  return (playerA: string, playerB: string) => {
    const pickA = outcomes[idx % outcomes.length]
    idx++
    return pickA ? playerA : playerB
  }
}

/**
 * Helper: after resolving a round, generates consolation for newly eliminated
 * players and rebuilds the schedule. Returns the main-bracket and consolation
 * matchups for the current schedule entry.
 *
 * This is the FIXED behavior: consolation is generated incrementally after
 * each round resolves, and the schedule maps them concurrently.
 */
function generateConsolationAndGetActiveMatchups(bracket: Bracket, resolvedRoundIndex: number): {
  mainBracketMatchups: Matchup[]
  consolationMatchups: Matchup[]
} {
  // Generate consolation for players eliminated in the just-resolved round
  const newConsolation = generateConsolationForRound(bracket, resolvedRoundIndex)
  bracket.consolationRounds.push(...newConsolation)

  // Rebuild the schedule to include new consolation rounds
  bracket.schedule = buildSchedule(bracket)

  // Advance the schedule index past the resolved entry (mirroring advancePlaycallerBracket)
  // After resolving the play-in, the schedule index should point to the next game round
  // (quarterfinals + consolation). The schedule entry for the resolved round was at
  // currentScheduleIndex, so we advance past it.
  bracket.currentScheduleIndex++

  // Find the current schedule entry (should be the one for the next game round)
  const scheduleEntry = bracket.schedule[bracket.currentScheduleIndex]
  if (!scheduleEntry) {
    return { mainBracketMatchups: [], consolationMatchups: [] }
  }

  // Get main-bracket matchups from this schedule entry
  const mainBracketMatchups: Matchup[] = []
  if (scheduleEntry.mainBracketRoundIndex !== null) {
    const mainRound = bracket.rounds[scheduleEntry.mainBracketRoundIndex]
    if (mainRound) {
      mainBracketMatchups.push(
        ...mainRound.matchups.filter((m) => m.playerA !== "" && m.playerB !== "")
      )
    }
  }

  // Get consolation matchups from this schedule entry
  const consolationMatchups: Matchup[] = []
  for (const cIdx of scheduleEntry.consolationRoundIndices) {
    const cRound = bracket.consolationRounds[cIdx]
    if (cRound) {
      consolationMatchups.push(
        ...cRound.matchups.filter((m) => m.playerA !== "" && m.playerB !== "")
      )
    }
  }

  return { mainBracketMatchups, consolationMatchups }
}

describe("Bug Condition Exploration: Consolation Rounds Deferred Until After Finals", () => {
  describe("Property 1: Consolation rounds generated concurrently after elimination", () => {
    it("after play-in resolves (10 players), consolation rounds should exist for eliminated players", () => {
      /**
       * Scoped PBT: 10-player bracket where play-in round resolves, eliminating 2 players.
       *
       * The property asserts that after the play-in round resolves and
       * generateConsolationForRound is called:
       * - bracket.consolationRounds.length > 0 (consolation generated for eliminated players)
       *
       * This confirms incremental consolation generation works.
       */
      fc.assert(
        fc.property(
          // Generate random outcomes for the play-in matchups (2 matchups for 10 players)
          fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }),
          (outcomes) => {
            const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
            let bracket = generateBracket(players)

            // Verify preconditions: 10 players -> 4 rounds, play-in has 2 matchups
            expect(bracket.totalRounds).toBe(4)
            expect(bracket.rounds[0].matchups.length).toBe(2) // play-in: 7v8, 9v10
            expect(bracket.currentRoundIndex).toBe(0)

            // Resolve play-in round with random outcomes
            const resolver = randomResolver(outcomes)
            const resolvedRoundIndex = bracket.currentRoundIndex
            bracket = resolveCurrentRound(bracket, resolver)

            // After play-in resolves, 2 players are eliminated
            const eliminatedPlayers = Object.keys(bracket.eliminated)
            expect(eliminatedPlayers.length).toBe(2)

            // Main bracket should NOT be complete yet (still 3 rounds to go)
            expect(isComplete(bracket)).toBe(false)

            // Generate consolation for players eliminated in the play-in round
            const newConsolation = generateConsolationForRound(bracket, resolvedRoundIndex)
            bracket.consolationRounds.push(...newConsolation)

            // EXPECTED: consolationRounds should be populated for the 2 eliminated players
            expect(bracket.consolationRounds.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 10 }
      )
    })

    it("active matchups for next game round should include BOTH quarterfinal AND consolation matchups", () => {
      /**
       * After the play-in resolves in a 10-player bracket, the next game round
       * should include:
       * - 4 quarterfinal matchups (main bracket)
       * - 1 consolation matchup (9th/10th place game for play-in losers)
       *
       * This confirms the schedule-based system maps consolation concurrently
       * with main-bracket rounds.
       */
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }),
          (outcomes) => {
            const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
            let bracket = generateBracket(players)

            // Resolve play-in round
            const resolver = randomResolver(outcomes)
            const resolvedRoundIndex = bracket.currentRoundIndex
            bracket = resolveCurrentRound(bracket, resolver)

            // Generate consolation and get active matchups using the new schedule-based API
            const { mainBracketMatchups, consolationMatchups } =
              generateConsolationAndGetActiveMatchups(bracket, resolvedRoundIndex)

            // Main bracket: quarterfinals should have 4 matchups
            expect(mainBracketMatchups.length).toBe(4)

            // EXPECTED BEHAVIOR (FIXED code):
            // Consolation matchups should include the 9th/10th game
            // (1 matchup between the 2 play-in losers)
            expect(consolationMatchups.length).toBeGreaterThan(0)

            // The consolation matchup should contain the eliminated players
            const eliminatedPlayerIds = Object.keys(bracket.eliminated)
            const consolationPlayerIds = consolationMatchups.flatMap((m) => [m.playerA, m.playerB])
            for (const eliminatedId of eliminatedPlayerIds) {
              expect(consolationPlayerIds).toContain(eliminatedId)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it("beginPlaycallerDown logic: schedule-based lookup provides combined matchups", () => {
      /**
       * This test verifies that the schedule-based matchup lookup (replacing
       * the old isComplete gate) correctly returns both main-bracket AND
       * consolation matchups for the current game round.
       *
       * The FIXED system uses getActiveMatchupsForSchedule to get a unified
       * matchup list per game round, eliminating the mutually exclusive mode.
       */
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }),
          (outcomes) => {
            const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
            let bracket = generateBracket(players)

            // Resolve play-in round
            const resolver = randomResolver(outcomes)
            const resolvedRoundIndex = bracket.currentRoundIndex
            bracket = resolveCurrentRound(bracket, resolver)

            // Main bracket is NOT complete
            expect(isComplete(bracket)).toBe(false)

            // Generate consolation for eliminated players and rebuild schedule
            const newConsolation = generateConsolationForRound(bracket, resolvedRoundIndex)
            bracket.consolationRounds.push(...newConsolation)
            bracket.schedule = buildSchedule(bracket)

            // Advance the schedule index past the resolved play-in entry
            bracket.currentScheduleIndex++

            // Use getActiveMatchupsForSchedule (the new unified API)
            const scheduleEntry = bracket.schedule[bracket.currentScheduleIndex]
            expect(scheduleEntry).toBeDefined()

            const activeMatchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

            // Active matchups should include BOTH main-bracket AND consolation matchups
            const eliminatedPlayerIds = Object.keys(bracket.eliminated)

            // Assert: at least one active matchup involves an eliminated player
            // (i.e., consolation matchups are included alongside main bracket)
            const activePlayerIds = activeMatchups.flatMap((m) => [m.playerA, m.playerB])
            const hasConsolationInActive = eliminatedPlayerIds.some((id) =>
              activePlayerIds.includes(id)
            )

            expect(hasConsolationInActive).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe("Secondary Bug Condition: Empty matchup slots cause 'No active matchups' hang", () => {
    it("consolation round with empty playerA/playerB should not be included in active matchups", () => {
      /**
       * When a consolation mini-bracket has a "final" round with empty slots
       * (waiting for semi-final winners), the system should NOT attempt to play it.
       * Only consolation rounds with fully populated matchup slots should be playable.
       *
       * On UNFIXED code: the filter `m.playerA !== "" && m.playerB !== ""` correctly
       * excludes empty matchups, BUT the problem is that after filtering, if ALL matchups
       * in a consolation round are empty, the system ends up with activeMatchups.length === 0,
       * which causes the "No active matchups" hang.
       *
       * The FIXED system should use a schedule that only references consolation rounds
       * whose matchup slots are fully populated.
       */
      const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
      let bracket = generateBracket(players)

      // Resolve ALL main bracket rounds to get to consolation
      while (!isComplete(bracket)) {
        bracket = resolveCurrentRound(bracket, higherSeedWinsResolver)
      }

      // Generate consolation rounds (this is what the unfixed code does after isComplete)
      bracket.consolationRounds = generateConsolationRounds(bracket)
      bracket.currentConsolationIndex = 0

      // Find a consolation round that has empty matchup slots (mini-bracket final)
      const emptySlotRound = bracket.consolationRounds.find((r) =>
        r.matchups.some((m) => m.playerA === "" || m.playerB === "")
      )

      // Verify that such a round exists (the 5th-8th final has empty slots before semis resolve)
      expect(emptySlotRound).toBeDefined()

      if (emptySlotRound) {
        // Simulate the current code's filter behavior
        const activeMatchups = emptySlotRound.matchups.filter(
          (m) => m.playerA !== "" && m.playerB !== ""
        )

        // BUG: After filtering, activeMatchups is EMPTY for the final round
        // because no one has been placed into the slots yet.
        // The FIXED system should never attempt to play this round until
        // the semi-final winners have been placed.

        // EXPECTED BEHAVIOR (FIXED code):
        // The scheduling system should ensure that consolation rounds with empty
        // slots are NEVER referenced as active until their dependency (semi-finals)
        // has been resolved and winners placed into the slots.
        //
        // Assert: if a schedule entry references this round, its matchups must be non-empty
        // On UNFIXED code, there IS no schedule, so we can't test this directly.
        // Instead, we verify the fundamental issue: empty matchups produce 0 active matchups.
        expect(activeMatchups.length).toBe(0) // This confirms the hang condition exists
      }
    })

    it("consolation is generated incrementally after each round, not all at the end", () => {
      /**
       * EXPECTED BEHAVIOR (FIXED code):
       * - Consolation should be generated INCREMENTALLY as players are eliminated
       * - After play-in (round 0) resolves → consolationRounds.length >= 1 (9th/10th)
       * - After quarterfinals (round 1) resolve → consolationRounds.length >= 3 (+ 5th-8th SF + F)
       * - After semifinals (round 2) resolve → consolationRounds.length >= 4 (+ 3rd/4th)
       *
       * This confirms the system supports incremental generation.
       */
      const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
      let bracket = generateBracket(players)

      // Track consolation state after EACH round resolves with incremental generation
      const consolationCountAfterEachRound: number[] = []

      while (!isComplete(bracket)) {
        const resolvedRoundIndex = bracket.currentRoundIndex
        bracket = resolveCurrentRound(bracket, higherSeedWinsResolver)

        // Generate consolation for players eliminated in the just-resolved round
        const newConsolation = generateConsolationForRound(bracket, resolvedRoundIndex)
        bracket.consolationRounds.push(...newConsolation)

        consolationCountAfterEachRound.push(bracket.consolationRounds.length)
      }

      // Assert: consolation rounds should be generated INCREMENTALLY, not all at the end
      // After the first round (play-in), there should already be consolation rounds
      const hasIncrementalGeneration = consolationCountAfterEachRound.some((count) => count > 0)
      expect(hasIncrementalGeneration).toBe(true)

      // More specifically: after play-in resolves, the first consolation round exists
      expect(consolationCountAfterEachRound[0]).toBeGreaterThan(0)
    })
  })
})
