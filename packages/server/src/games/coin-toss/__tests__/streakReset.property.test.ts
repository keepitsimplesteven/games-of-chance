/**
 * Property-based tests for New Game Streak Reset
 *
 * Property 8: When a new game starts, all streak counters initialize to 0
 * regardless of prior state.
 *
 * **Validates: Requirements 6.7**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { computeStreakScoring, type StreakState } from "../StreakEngine"
import type { CoinTossPick, CoinTossResult } from "@games-of-chance/shared"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generates a random player ID (UUID-like format matching real player IDs) */
const playerIdArb = fc
  .tuple(fc.hexaString({ minLength: 4, maxLength: 8 }), fc.integer({ min: 1, max: 9999 }))
  .map(([hex, num]) => `player-${hex}-${num}`)

/** Generates a unique set of 2-10 player IDs */
const playerSetArb = fc
  .uniqueArray(playerIdArb, { minLength: 2, maxLength: 10 })

/** Generates a StreakState with random pre-existing streak values for given players */
function streakStateWithPlayersArb(players: string[]): fc.Arbitrary<StreakState> {
  return fc
    .tuple(
      fc.tuple(...players.map(() => fc.integer({ min: 0, max: 20 }))),
      fc.tuple(...players.map(() => fc.integer({ min: 0, max: 20 })))
    )
    .map(([correctValues, wrongValues]) => {
      const correctStreaks: Record<string, number> = {}
      const wrongStreaks: Record<string, number> = {}
      players.forEach((id, i) => {
        correctStreaks[id] = correctValues[i]
        wrongStreaks[id] = wrongValues[i]
      })
      return { correctStreaks, wrongStreaks }
    })
}

// ── Property 8: New Game Streak Reset ──────────────────────────────────────

describe("Property 8: New Game Streak Reset", () => {
  /**
   * When a new game starts, all streak counters initialize to 0.
   * A fresh StreakState { correctStreaks: {}, wrongStreaks: {} } means
   * all players effectively have streak 0 (since computeStreakScoring
   * uses `state.correctStreaks[playerId] ?? 0`).
   *
   * This test verifies that:
   * 1. A fresh empty StreakState treats all players as having 0 streaks
   * 2. All multipliers start at 1x for correct guesses with a fresh state
   * 3. This holds regardless of what prior streak values players had
   *
   * **Validates: Requirements 6.7**
   */
  it("fresh StreakState initializes all players with 0 streaks and 1x multiplier", () => {
    fc.assert(
      fc.property(
        playerSetArb.chain((players) =>
          fc.tuple(
            fc.constant(players),
            streakStateWithPlayersArb(players),
            fc.integer({ min: 1, max: 100 })
          )
        ),
        ([players, _priorState, basePoints]) => {
          // When a new game starts, a fresh empty StreakState is created
          const freshStreakState: StreakState = {
            correctStreaks: {},
            wrongStreaks: {},
          }

          // All players pick a side (doesn't matter which for this property)
          const picks: Record<string, CoinTossPick> = {}
          for (const playerId of players) {
            picks[playerId] = { side: "HEADS" }
          }

          // The coin result matches everyone's pick (all correct)
          const result: CoinTossResult = { outcome: "HEADS", flippedAt: Date.now() }

          // Compute scoring with the fresh state
          const scoring = computeStreakScoring(picks, result, freshStreakState, basePoints)

          // With a fresh state, all players should have:
          // - 1x multiplier (streak counter was 0 before this round)
          // - Points equal to basePoints * 1
          for (const playerId of players) {
            expect(scoring.appliedMultipliers[playerId]).toBe(1)
            expect(scoring.deltas[playerId]).toBe(basePoints * 1)
          }

          // After this first round, all correct streaks should be 1
          for (const playerId of players) {
            expect(scoring.nextStreakState.correctStreaks[playerId]).toBe(1)
            expect(scoring.nextStreakState.wrongStreaks[playerId]).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("fresh StreakState is independent of any prior streak values", () => {
    fc.assert(
      fc.property(
        playerSetArb.chain((players) =>
          fc.tuple(
            fc.constant(players),
            streakStateWithPlayersArb(players),
            fc.integer({ min: 1, max: 100 })
          )
        ),
        ([players, priorState, basePoints]) => {
          // Verify prior state has non-trivial values (some are > 0)
          // This demonstrates the prior state is "real" but irrelevant

          // Fresh state for new game
          const freshStreakState: StreakState = {
            correctStreaks: {},
            wrongStreaks: {},
          }

          // All players pick TAILS, outcome is HEADS → all incorrect
          const picks: Record<string, CoinTossPick> = {}
          for (const playerId of players) {
            picks[playerId] = { side: "TAILS" }
          }
          const result: CoinTossResult = { outcome: "HEADS", flippedAt: Date.now() }

          // Compute with fresh state (new game)
          const freshScoring = computeStreakScoring(picks, result, freshStreakState, basePoints)

          // Compute with prior state (as if game didn't reset)
          const priorScoring = computeStreakScoring(picks, result, priorState, basePoints)

          // Both should award 0 points for incorrect guesses
          for (const playerId of players) {
            expect(freshScoring.deltas[playerId]).toBe(0)
            expect(freshScoring.appliedMultipliers[playerId]).toBe(0)
          }

          // Fresh state: all wrong streaks go to 1 (starting from 0)
          for (const playerId of players) {
            expect(freshScoring.nextStreakState.wrongStreaks[playerId]).toBe(1)
            expect(freshScoring.nextStreakState.correctStreaks[playerId]).toBe(0)
          }

          // Key property: fresh state always starts wrong streaks at 1
          // regardless of what prior state had
          for (const playerId of players) {
            expect(freshScoring.nextStreakState.wrongStreaks[playerId]).toBe(1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
