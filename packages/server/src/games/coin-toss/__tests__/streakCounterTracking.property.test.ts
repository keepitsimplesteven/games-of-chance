import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import type { CoinTossPick, CoinTossResult, CoinSide } from "@games-of-chance/shared"
import { computeStreakScoring, type StreakState } from "../StreakEngine"

/**
 * Property 6: Streak Counter Tracking
 *
 * For any player and any sequence of round outcomes (correct/incorrect),
 * the streak counters SHALL satisfy:
 * - After a correct guess: correctStreak increments by 1, wrongStreak resets to 0
 * - After an incorrect guess: wrongStreak increments by 1, correctStreak resets to 0
 *
 * This invariant holds regardless of the player's prior streak state.
 *
 * **Validates: Requirements 6.1, 7.1**
 */
describe("Feature: coin-toss-gameplay-enhancements, Property 6: Streak Counter Tracking", () => {
  it("correctStreak increments on correct guess and wrongStreak resets; wrongStreak increments on incorrect guess and correctStreak resets", () => {
    fc.assert(
      fc.property(
        // Generate a random sequence of 1–20 outcomes (true = correct, false = incorrect)
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        // Generate a player ID
        fc.string({ minLength: 1, maxLength: 10 }),
        // Generate base points (irrelevant for streak tracking, but required param)
        fc.integer({ min: 1, max: 100 }),
        (outcomes, playerId, basePoints) => {
          // Start with empty streak state
          let streakState: StreakState = {
            correctStreaks: {},
            wrongStreaks: {},
          }

          let expectedCorrectStreak = 0
          let expectedWrongStreak = 0

          for (const isCorrect of outcomes) {
            // Determine the coin outcome and player pick based on whether this round is correct
            const coinOutcome: CoinSide = "HEADS"
            const playerPick: CoinSide = isCorrect ? "HEADS" : "TAILS"

            const picks: Record<string, CoinTossPick> = {
              [playerId]: { side: playerPick },
            }
            const result: CoinTossResult = {
              outcome: coinOutcome,
              flippedAt: Date.now(),
            }

            const scoringResult = computeStreakScoring(
              picks,
              result,
              streakState,
              basePoints
            )

            // Update expected values
            if (isCorrect) {
              expectedCorrectStreak += 1
              expectedWrongStreak = 0
            } else {
              expectedCorrectStreak = 0
              expectedWrongStreak += 1
            }

            // Verify streak counters match expected values
            expect(scoringResult.nextStreakState.correctStreaks[playerId]).toBe(
              expectedCorrectStreak
            )
            expect(scoringResult.nextStreakState.wrongStreaks[playerId]).toBe(
              expectedWrongStreak
            )

            // Advance to next round with updated streak state
            streakState = scoringResult.nextStreakState
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
