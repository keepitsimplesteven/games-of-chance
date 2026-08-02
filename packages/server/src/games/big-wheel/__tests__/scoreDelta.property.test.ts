/**
 * Feature: big-wheel, Property 8: Score delta equals spin total
 *
 * For any player completing a turn (both spins resolved), the RoundScoreResult
 * deltas record SHALL map the player's ID to exactly their spinTotal value.
 * Accumulating all such deltas across turns SHALL produce the correct cumulative
 * game score.
 *
 * **Validates: Requirements 6.2, 6.3**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { bigWheelPlugin } from "../BigWheelPlugin"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a player ID */
const playerIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)

/** Generate a reel value in valid range */
const reelValueArb = fc.integer({ min: 1, max: 10_000 })

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 8: Score delta equals spin total", () => {
  /**
   * Property 8a: After spin 2, deltas[spinnerPlayerId] === spinTotal
   *
   * For any player completing a turn (spin 2 resolved), the scoreRound method
   * SHALL return a deltas record mapping the player's ID to exactly their spinTotal.
   *
   * **Validates: Requirements 6.2**
   */
  it("spin 2 result: deltas[spinnerPlayerId] === spinTotal", () => {
    fc.assert(
      fc.property(
        playerIdArb,
        reelValueArb,
        reelValueArb,
        (spinnerPlayerId, spin1Value, spin2Value) => {
          const spinTotal = spin1Value + spin2Value

          // Create a BigWheelSpinResult for spin 2 with computed spinTotal
          const spinResult = {
            spinnerPlayerId,
            spinNumber: 2 as const,
            reelIndex: 0,
            value: spin2Value,
            spinTotal,
          }

          // Call scoreRound with the spin 2 result
          const scoreResult = bigWheelPlugin.scoreRound(
            { [spinnerPlayerId]: { type: "spin" } },
            spinResult,
            [{ id: spinnerPlayerId, name: "Test", connected: true }],
            {}
          )

          // Verify: deltas maps the player's ID to exactly their spinTotal
          expect(scoreResult.deltas[spinnerPlayerId]).toBe(spinTotal)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8b: After spin 1, deltas is empty
   *
   * When spinNumber is 1, no score should be produced yet.
   *
   * **Validates: Requirements 6.2**
   */
  it("spin 1 result: deltas is empty (no score yet)", () => {
    fc.assert(
      fc.property(
        playerIdArb,
        reelValueArb,
        (spinnerPlayerId, spinValue) => {
          // Create a BigWheelSpinResult for spin 1
          const spinResult = {
            spinnerPlayerId,
            spinNumber: 1 as const,
            reelIndex: 0,
            value: spinValue,
            spinTotal: null,
          }

          // Call scoreRound with the spin 1 result
          const scoreResult = bigWheelPlugin.scoreRound(
            { [spinnerPlayerId]: { type: "spin" } },
            spinResult,
            [{ id: spinnerPlayerId, name: "Test", connected: true }],
            {}
          )

          // Verify: deltas is empty after spin 1
          expect(scoreResult.deltas).toEqual({})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8c: Cumulative scoring — accumulating deltas across multiple
   * players' turns produces correct game scores.
   *
   * **Validates: Requirements 6.3**
   */
  it("cumulative scoring: accumulated deltas produce correct game scores", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(playerIdArb, reelValueArb, reelValueArb),
          { minLength: 1, maxLength: 10 }
        ),
        (playerTurns) => {
          // Simulate accumulating game scores from multiple player turns
          const gameScores: Record<string, number> = {}

          for (const [playerId, spin1Value, spin2Value] of playerTurns) {
            const spinTotal = spin1Value + spin2Value

            // Create a BigWheelSpinResult for spin 2 (completed turn)
            const spinResult = {
              spinnerPlayerId: playerId,
              spinNumber: 2 as const,
              reelIndex: 0,
              value: spin2Value,
              spinTotal,
            }

            // Call scoreRound to get the delta
            const scoreResult = bigWheelPlugin.scoreRound(
              { [playerId]: { type: "spin" } },
              spinResult,
              [{ id: playerId, name: "Test", connected: true }],
              {}
            )

            // Accumulate the delta into the game score
            const delta = scoreResult.deltas[playerId] ?? 0
            gameScores[playerId] = (gameScores[playerId] ?? 0) + delta
          }

          // Verify: final game scores match expected accumulated spin totals
          const expectedScores: Record<string, number> = {}
          for (const [playerId, spin1Value, spin2Value] of playerTurns) {
            expectedScores[playerId] = (expectedScores[playerId] ?? 0) + (spin1Value + spin2Value)
          }

          expect(gameScores).toEqual(expectedScores)
        }
      ),
      { numRuns: 100 }
    )
  })
})
