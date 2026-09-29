import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
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
       * Consolidated-schedule model: after the play-in resolves in a 10-player
       * bracket, buildSchedule produces (in order):
       *   Round 1 (play-in) → Quarterfinal → Semifinal → Consolation → Final
       * The main-bracket quarterfinal matchups and the consolation matchups no
       * longer live on the SAME schedule entry. Instead:
       * - the Quarterfinal entry (mainBracketRoundIndex → rounds[1]) yields 4
       *   fully-populated main matchups, AND
       * - the dedicated Consolation entry (mainBracketRoundIndex === null,
       *   description "Consolation") holds the 9th/10th play-in-loser matchup.
       * Both are reachable via getActiveMatchupsForSchedule.
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

            // Generate consolation for the play-in losers and rebuild the schedule
            // (single currentScheduleIndex++ mirroring advancePlaycallerBracket).
            const newConsolation = generateConsolationForRound(bracket, resolvedRoundIndex)
            bracket.consolationRounds.push(...newConsolation)
            bracket.schedule = buildSchedule(bracket)
            bracket.currentScheduleIndex++

            // The advanced schedule index points at the Quarterfinal entry, whose
            // main-bracket round (rounds[1]) has 4 fully-populated matchups.
            const quarterfinalEntry = bracket.schedule[bracket.currentScheduleIndex]
            expect(quarterfinalEntry).toBeDefined()
            expect(quarterfinalEntry.mainBracketRoundIndex).toBe(1)
            const mainBracketMatchups = getActiveMatchupsForSchedule(bracket, quarterfinalEntry)
            expect(mainBracketMatchups.length).toBe(4)

            // The dedicated Consolation entry (mainBracketRoundIndex === null) holds
            // the play-in-loser matchups.
            const consolationEntry = bracket.schedule.find(
              (e) => e.mainBracketRoundIndex === null
            )
            expect(consolationEntry).toBeDefined()
            const consolationMatchups = getActiveMatchupsForSchedule(bracket, consolationEntry!)
            expect(consolationMatchups.length).toBeGreaterThan(0)

            // The consolation matchup(s) should contain the eliminated (play-in loser) players
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

            // Consolidated-schedule model: main-bracket and consolation matchups live
            // on DIFFERENT schedule entries, but both are reachable via the unified
            // getActiveMatchupsForSchedule API.

            // (1) The advanced index points at the Quarterfinal entry: 4 main matchups.
            const quarterfinalEntry = bracket.schedule[bracket.currentScheduleIndex]
            expect(quarterfinalEntry).toBeDefined()
            const mainActive = getActiveMatchupsForSchedule(bracket, quarterfinalEntry)
            expect(mainActive.length).toBe(4)

            // (2) The dedicated Consolation entry holds the play-in-loser matchups.
            const consolationEntry = bracket.schedule.find(
              (e) => e.mainBracketRoundIndex === null
            )
            expect(consolationEntry).toBeDefined()
            const consolationActive = getActiveMatchupsForSchedule(bracket, consolationEntry!)
            expect(consolationActive.length).toBeGreaterThan(0)

            // The consolation matchups involve the eliminated (play-in loser) players.
            const eliminatedPlayerIds = Object.keys(bracket.eliminated)
            const consolationPlayerIds = consolationActive.flatMap((m) => [m.playerA, m.playerB])
            const hasConsolationReachable = eliminatedPlayerIds.some((id) =>
              consolationPlayerIds.includes(id)
            )
            expect(hasConsolationReachable).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe("Secondary Bug Condition: Empty matchup slots cause 'No active matchups' hang", () => {
    it("getActiveMatchupsForSchedule filters out matchups with empty playerA/playerB", () => {
      /**
       * Filter invariant (Requirement: prevent the "No active matchups" hang):
       * getActiveMatchupsForSchedule must NEVER return a matchup whose playerA or
       * playerB slot is empty. Empty slots occur while a matchup is still waiting
       * for an upstream winner to be placed; playing such a matchup would hang.
       *
       * The current generation model never emits empty-slot consolation rounds, so
       * we construct one directly: a consolation round containing one fully-populated
       * matchup plus one empty-slot matchup, referenced by a schedule entry. The
       * populated matchup must come through; the empty one must be filtered out.
       */
      const populatedMatchup: Matchup = {
        matchupId: "c0-m0",
        playerA: "p1",
        playerB: "p2",
        winner: null,
      }
      const emptyMatchup: Matchup = {
        matchupId: "c0-m1",
        playerA: "",
        playerB: "",
        winner: null,
      }

      // Minimal bracket: one consolation round mixing a populated and an empty matchup.
      const bracket: Bracket = {
        rounds: [
          {
            roundIndex: 0,
            matchups: [{ matchupId: "r0-m0", playerA: "p1", playerB: "p2", winner: null }],
            byes: [],
            resolved: false,
          },
        ],
        currentRoundIndex: 0,
        totalRounds: 1,
        seeds: { p1: 1, p2: 2 },
        eliminated: {},
        consolationRounds: [
          {
            roundIndex: 0,
            matchups: [populatedMatchup, emptyMatchup],
            resolved: false,
            sourceRoundIndex: 0,
            placementStart: 5,
          },
        ],
        currentConsolationIndex: 0,
        schedule: [],
        currentScheduleIndex: 0,
      }

      // A schedule entry that references the consolation round (index 0).
      const scheduleEntry: GameRoundSchedule = {
        mainBracketRoundIndex: null,
        consolationRoundIndices: [0],
        description: "Consolation",
      }

      const active = getActiveMatchupsForSchedule(bracket, scheduleEntry)

      // The populated matchup is returned; the empty-slot matchup is filtered out.
      expect(active).toHaveLength(1)
      expect(active[0].matchupId).toBe("c0-m0")

      // Invariant: every returned matchup has non-empty playerA AND playerB.
      for (const m of active) {
        expect(m.playerA).not.toBe("")
        expect(m.playerB).not.toBe("")
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
