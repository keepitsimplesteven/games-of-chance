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
import type { GameSettings } from "@games-of-chance/shared"

// ── Helpers ────────────────────────────────────────────────────────────────

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: 15_000,
  tuning: {},
}

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a player ID (avoid prototype property names like valueOf, toString, etc.) */
const playerIdArb = fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/)

/** Generate a reel value in valid range */
const reelValueArb = fc.integer({ min: 1, max: 10_000 })

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 8: Score delta equals spin total", () => {
  /**
   * Property 8a: After spin 2, deltas[spinnerPlayerId] === spin 2 value
   *
   * For any player completing a turn (spin 2 resolved), the scoreRound method
   * SHALL return a deltas record mapping the player's ID to the spin 2 value
   * (progressive scoring — each spin contributes independently).
   *
   * **Validates: Requirements 6.2**
   */
  it("spin 2 result: deltas[spinnerPlayerId] === spin 2 value", () => {
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
            [{ id: spinnerPlayerId, name: "Test", role: "player" as const, connected: true, connectionId: spinnerPlayerId }], defaultSettings)

          // Verify: deltas maps the player's ID to the spin 2 value (progressive scoring)
          expect(scoreResult.deltas[spinnerPlayerId]).toBe(spin2Value)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8b: After spin 1, deltas contains the spin 1 value
   *
   * When spinNumber is 1, the score delta equals the spin value (progressive scoring).
   *
   * **Validates: Requirements 6.2**
   */
  it("spin 1 result: deltas[spinnerPlayerId] === spin value (progressive scoring)", () => {
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
            [{ id: spinnerPlayerId, name: "Test", role: "player" as const, connected: true, connectionId: spinnerPlayerId }], defaultSettings)

          // Verify: deltas contains the spin value (progressive scoring)
          expect(scoreResult.deltas[spinnerPlayerId]).toBe(spinValue)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8c: Cumulative scoring — accumulating deltas across multiple
   * players' turns produces correct game scores (sum of individual spin values).
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

            // Spin 1 — scores the spin1 value
            const spin1Result = {
              spinnerPlayerId: playerId,
              spinNumber: 1 as const,
              reelIndex: 0,
              value: spin1Value,
              spinTotal: null,
            }
            const score1 = bigWheelPlugin.scoreRound(
              { [playerId]: { type: "spin" } },
              spin1Result,
              [{ id: playerId, name: "Test", role: "player" as const, connected: true, connectionId: playerId }], defaultSettings)
            const delta1 = score1.deltas[playerId] ?? 0
            gameScores[playerId] = (gameScores[playerId] ?? 0) + delta1

            // Spin 2 — scores the spin2 value
            const spin2Result = {
              spinnerPlayerId: playerId,
              spinNumber: 2 as const,
              reelIndex: 0,
              value: spin2Value,
              spinTotal,
            }
            const score2 = bigWheelPlugin.scoreRound(
              { [playerId]: { type: "spin" } },
              spin2Result,
              [{ id: playerId, name: "Test", role: "player" as const, connected: true, connectionId: playerId }], defaultSettings)
            const delta2 = score2.deltas[playerId] ?? 0
            gameScores[playerId] = (gameScores[playerId] ?? 0) + delta2
          }

          // Verify: final game scores match expected accumulated spin totals
          // (spin1 + spin2 for each turn, accumulated per player)
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
