/**
 * Feature: coin-toss-gameplay-enhancements, Property 7: Multiplier Scoring Formula
 *
 * Test that points = basePoints × multiplier (1x/2x/3x) based on prior streak,
 * and 0 points for incorrect guesses.
 *
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { computeStreakScoring, type StreakState } from "../StreakEngine"
import type { CoinTossPick, CoinTossResult } from "@games-of-chance/shared"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a random base points value between 1 and 100 */
const basePointsArb = fc.integer({ min: 1, max: 100 })

/** Generate a random streak value between 0 and 20 */
const streakArb = fc.integer({ min: 0, max: 20 })

/** Generate a random coin side */
const coinSideArb = fc.constantFrom("HEADS" as const, "TAILS" as const)

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: coin-toss-gameplay-enhancements, Property 7: Multiplier Scoring Formula", () => {
  /**
   * Property 7a: Correct guess with streak 0 → basePoints × 1
   *
   * **Validates: Requirements 6.2**
   */
  it("correct guess with streak 0 awards basePoints × 1 (1x multiplier)", () => {
    fc.assert(
      fc.property(basePointsArb, coinSideArb, (basePoints, side) => {
        const playerId = "player-1"
        const picks: Record<string, CoinTossPick> = { [playerId]: { side } }
        const result: CoinTossResult = { outcome: side, flippedAt: Date.now() }
        const currentStreak: StreakState = {
          correctStreaks: { [playerId]: 0 },
          wrongStreaks: { [playerId]: 0 },
        }

        const scoring = computeStreakScoring(picks, result, currentStreak, basePoints)

        expect(scoring.deltas[playerId]).toBe(basePoints * 1)
        expect(scoring.appliedMultipliers[playerId]).toBe(1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7b: Correct guess with streak 1 → basePoints × 2
   *
   * **Validates: Requirements 6.3**
   */
  it("correct guess with streak 1 awards basePoints × 2 (2x multiplier)", () => {
    fc.assert(
      fc.property(basePointsArb, coinSideArb, (basePoints, side) => {
        const playerId = "player-1"
        const picks: Record<string, CoinTossPick> = { [playerId]: { side } }
        const result: CoinTossResult = { outcome: side, flippedAt: Date.now() }
        const currentStreak: StreakState = {
          correctStreaks: { [playerId]: 1 },
          wrongStreaks: { [playerId]: 0 },
        }

        const scoring = computeStreakScoring(picks, result, currentStreak, basePoints)

        expect(scoring.deltas[playerId]).toBe(basePoints * 2)
        expect(scoring.appliedMultipliers[playerId]).toBe(2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7c: Correct guess with streak ≥ 2 → basePoints × 3
   *
   * **Validates: Requirements 6.4**
   */
  it("correct guess with streak >= 2 awards basePoints × 3 (3x multiplier)", () => {
    fc.assert(
      fc.property(
        basePointsArb,
        fc.integer({ min: 2, max: 20 }),
        coinSideArb,
        (basePoints, streak, side) => {
          const playerId = "player-1"
          const picks: Record<string, CoinTossPick> = { [playerId]: { side } }
          const result: CoinTossResult = { outcome: side, flippedAt: Date.now() }
          const currentStreak: StreakState = {
            correctStreaks: { [playerId]: streak },
            wrongStreaks: { [playerId]: 0 },
          }

          const scoring = computeStreakScoring(picks, result, currentStreak, basePoints)

          expect(scoring.deltas[playerId]).toBe(basePoints * 3)
          expect(scoring.appliedMultipliers[playerId]).toBe(3)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7d: Points = basePoints × multiplier for any valid streak
   * Tests the general formula: points = basePoints × getMultiplier(streak)
   *
   * **Validates: Requirements 6.5**
   */
  it("points always equal basePoints × multiplier for correct guesses", () => {
    fc.assert(
      fc.property(basePointsArb, streakArb, coinSideArb, (basePoints, streak, side) => {
        const playerId = "player-1"
        const picks: Record<string, CoinTossPick> = { [playerId]: { side } }
        const result: CoinTossResult = { outcome: side, flippedAt: Date.now() }
        const currentStreak: StreakState = {
          correctStreaks: { [playerId]: streak },
          wrongStreaks: { [playerId]: 0 },
        }

        const scoring = computeStreakScoring(picks, result, currentStreak, basePoints)

        // Determine expected multiplier
        const expectedMultiplier = streak >= 2 ? 3 : streak === 1 ? 2 : 1
        expect(scoring.deltas[playerId]).toBe(basePoints * expectedMultiplier)
        expect(scoring.appliedMultipliers[playerId]).toBe(expectedMultiplier)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7e: Incorrect guess → 0 points regardless of streak
   *
   * **Validates: Requirements 6.6**
   */
  it("incorrect guess awards 0 points regardless of prior streak", () => {
    fc.assert(
      fc.property(basePointsArb, streakArb, coinSideArb, (basePoints, streak, side) => {
        const playerId = "player-1"
        // Player picks one side, result is the opposite
        const oppositeSide = side === "HEADS" ? "TAILS" : "HEADS"
        const picks: Record<string, CoinTossPick> = { [playerId]: { side } }
        const result: CoinTossResult = { outcome: oppositeSide, flippedAt: Date.now() }
        const currentStreak: StreakState = {
          correctStreaks: { [playerId]: streak },
          wrongStreaks: { [playerId]: 0 },
        }

        const scoring = computeStreakScoring(picks, result, currentStreak, basePoints)

        expect(scoring.deltas[playerId]).toBe(0)
        expect(scoring.appliedMultipliers[playerId]).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
