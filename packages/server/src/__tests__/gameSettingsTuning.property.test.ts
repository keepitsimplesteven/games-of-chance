/**
 * Feature: game-settings, Property 4: Configured tuning constants are used in scoring
 *
 * Validates: Requirements 6.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { coinTossPlugin, resetCoinTossStreakState } from "../games/coin-toss/CoinTossPlugin"
import type {
  GameSettings,
  Player,
  CoinTossPick,
  CoinTossResult,
} from "@games-of-chance/shared"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generates valid CORRECT_GUESS_CHIPS values within [1, 100] (integer, step 1) */
const validCorrectGuessChipsArb = fc.integer({ min: 1, max: 100 })

/** Generates a coin side */
const coinSideArb = fc.constantFrom("HEADS" as const, "TAILS" as const)

/** Generates a player ID */
const playerIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)

// ── Property 4: Configured tuning constants are used in scoring ────────────

describe("Feature: game-settings, Property 4: Configured tuning constants are used in scoring", () => {
  /**
   * Property 4: Configured tuning constants are used in scoring
   *
   * For any CORRECT_GUESS_CHIPS in [1, 100], verify scoreRound uses configured value.
   * We create a scenario where at least one player guesses correctly and verify
   * the delta for that player equals the configured CORRECT_GUESS_CHIPS value.
   *
   * **Validates: Requirements 6.3**
   */
  it("scoreRound uses the configured CORRECT_GUESS_CHIPS value from GameSettings for correct guesses", () => {
    fc.assert(
      fc.property(
        validCorrectGuessChipsArb,
        coinSideArb,
        playerIdArb,
        (correctGuessChips, outcome, playerId) => {
          // Reset streak state so 1x multiplier is applied (fresh streak)
          resetCoinTossStreakState()

          // Build GameSettings with the generated tuning value
          const settings: GameSettings = {
            roundCount: 10,
            pickWindowMs: 15000,
            tuning: {
              CORRECT_GUESS_CHIPS: correctGuessChips,
              STREAK_MULTIPLIER: 2,
              STREAK_THRESHOLD: 3,
            },
          }

          // Create a player who is connected
          const players: Player[] = [
            {
              id: playerId,
              name: "TestPlayer",
              role: "player",
              connected: true,
              connectionId: `conn-${playerId}`,
            },
          ]

          // The player picks the same side as the outcome (correct guess)
          const picks: Record<string, CoinTossPick> = {
            [playerId]: { side: outcome },
          }

          // The coin lands on the same side as the player's pick
          const result: CoinTossResult = {
            outcome,
            flippedAt: Date.now(),
          }

          // Call scoreRound with the configured settings
          const scoreResult = coinTossPlugin.scoreRound(
            picks,
            result,
            players,
            settings
          )

          // The delta for the correct-guessing player must equal the configured value
          expect(scoreResult.deltas[playerId]).toBe(correctGuessChips)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("scoreRound awards 0 for incorrect guesses regardless of CORRECT_GUESS_CHIPS value", () => {
    fc.assert(
      fc.property(
        validCorrectGuessChipsArb,
        coinSideArb,
        playerIdArb,
        (correctGuessChips, outcome, playerId) => {
          // Reset streak state so no prototype/accumulation issues
          resetCoinTossStreakState()

          // Build GameSettings with the generated tuning value
          const settings: GameSettings = {
            roundCount: 10,
            pickWindowMs: 15000,
            tuning: {
              CORRECT_GUESS_CHIPS: correctGuessChips,
              STREAK_MULTIPLIER: 2,
              STREAK_THRESHOLD: 3,
            },
          }

          // Create a connected player
          const players: Player[] = [
            {
              id: playerId,
              name: "TestPlayer",
              role: "player",
              connected: true,
              connectionId: `conn-${playerId}`,
            },
          ]

          // Player picks the OPPOSITE side of the outcome (incorrect guess)
          const wrongSide = outcome === "HEADS" ? "TAILS" : "HEADS"
          const picks: Record<string, CoinTossPick> = {
            [playerId]: { side: wrongSide },
          }

          const result: CoinTossResult = {
            outcome,
            flippedAt: Date.now(),
          }

          // Call scoreRound
          const scoreResult = coinTossPlugin.scoreRound(
            picks,
            result,
            players,
            settings
          )

          // Incorrect guess always yields 0, regardless of CORRECT_GUESS_CHIPS
          expect(scoreResult.deltas[playerId]).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
