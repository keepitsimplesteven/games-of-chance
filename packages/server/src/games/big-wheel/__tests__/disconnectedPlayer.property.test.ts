/**
 * Feature: big-wheel, Property 7: Disconnected player zero score
 *
 * For any player whose turn is skipped due to disconnection, their spinTotal
 * SHALL be 0 and the RoundScoreResult deltas for that player SHALL be 0.
 *
 * **Validates: Requirements 12.2, 12.3**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { resolveDisconnectedTurn } from "../disconnection"
import { setBigWheelState, bigWheelPlugin } from "../BigWheelPlugin"
import type { GameSettings } from "@games-of-chance/shared"

// ── Helpers ────────────────────────────────────────────────────────────────

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: 15_000,
  tuning: {},
}

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a valid player ID (non-empty alphanumeric string) */
const playerIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)

/** Generate a valid reel strip: length 2-100, values are integers in [1, 10000] */
const validReelStripArb = fc
  .integer({ min: 2, max: 100 })
  .chain((length) =>
    fc.array(fc.integer({ min: 1, max: 10_000 }), {
      minLength: length,
      maxLength: length,
    })
  )

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 7: Disconnected player zero score", () => {
  /**
   * Property 7a: resolveDisconnectedTurn returns spinTotal of 0 for any
   * disconnected player whose turn is skipped.
   *
   * **Validates: Requirements 12.2, 12.3**
   */
  it("resolveDisconnectedTurn produces spinTotal of 0 for any disconnected player", () => {
    fc.assert(
      fc.property(playerIdArb, validReelStripArb, (playerId, reelStrip) => {
        // Set up plugin state with the player in the spin order
        setBigWheelState({
          spinOrder: [playerId],
          currentTurnIndex: 0,
          spinResults: {},
          currentSpinNumber: 1,
          reelStrip,
          disconnectedPlayers: [],
        })

        // Resolve the disconnected player's turn
        const resolution = resolveDisconnectedTurn(playerId)

        // Verify: spinTotal is 0
        expect(resolution).not.toBeNull()
        expect(resolution!.spinTotal).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7b: scoreRound produces delta of 0 for a disconnected player
   * whose spinTotal is 0.
   *
   * **Validates: Requirements 12.2, 12.3**
   */
  it("scoreRound produces delta of 0 for disconnected player with spinTotal 0", () => {
    fc.assert(
      fc.property(playerIdArb, validReelStripArb, (playerId, reelStrip) => {
        // Set up plugin state
        setBigWheelState({
          spinOrder: [playerId],
          currentTurnIndex: 0,
          spinResults: {},
          currentSpinNumber: 1,
          reelStrip,
          disconnectedPlayers: [playerId],
        })

        // Create a BigWheelSpinResult with spinTotal=0 for the disconnected player
        const spinResult = {
          spinnerPlayerId: playerId,
          spinNumber: 2 as const,
          reelIndex: 0,
          value: 0,
          spinTotal: 0,
        }

        // Call scoreRound with the zero-total result
        const scoreResult = bigWheelPlugin.scoreRound(
          { [playerId]: { type: "spin" } },
          spinResult,
          [{ id: playerId, name: "test", role: "player" as const, connected: false, connectionId: null }],
          defaultSettings
        )

        // Verify: deltas for the disconnected player is 0
        expect(scoreResult.deltas[playerId]).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
