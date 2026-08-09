/**
 * Feature: big-wheel, Property 1: Spin result round-trip consistency
 *
 * For any valid reel strip and any spin resolution, the returned index SHALL be
 * in the range [0, reelStrip.length - 1], and the returned value SHALL equal
 * `reelStrip[returnedIndex]`. This holds regardless of whether the spin was
 * triggered manually or auto-resolved by timeout.
 *
 * **Validates: Requirements 4.3, 4.6, 5.1, 5.2, 5.3, 5.4**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { bigWheelPlugin, setBigWheelState } from "../BigWheelPlugin"
import type { GameSettings } from "@games-of-chance/shared"

// ── Helpers ────────────────────────────────────────────────────────────────

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: 15_000,
  tuning: {},
}

// ── Arbitraries ────────────────────────────────────────────────────────────

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

describe("Feature: big-wheel, Property 1: Spin result round-trip consistency", () => {
  /**
   * Property 1a: Spin 1 — reelIndex is in bounds and value matches reelStrip[reelIndex].
   * spinTotal should be null after spin 1.
   *
   * **Validates: Requirements 4.3, 5.1, 5.2, 5.3**
   */
  it("spin 1: reelIndex is in bounds, value matches reelStrip[reelIndex], spinTotal is null", () => {
    fc.assert(
      fc.property(validReelStripArb, (reelStrip) => {
        const spinnerId = "player-1"

        // Set up plugin state for spin 1
        setBigWheelState({
          spinOrder: [spinnerId],
          currentTurnIndex: 0,
          spinResults: {},
          currentSpinNumber: 1,
          reelStrip,
          disconnectedPlayers: [],
        })

        // Resolve the round with the active spinner's pick
        const result = bigWheelPlugin.resolveRound({ [spinnerId]: { type: "spin" } }, defaultSettings)

        // Verify: reelIndex is in valid range
        expect(result.reelIndex).toBeGreaterThanOrEqual(0)
        expect(result.reelIndex).toBeLessThan(reelStrip.length)

        // Verify: value equals reelStrip[reelIndex]
        expect(result.value).toBe(reelStrip[result.reelIndex])

        // Verify: spinTotal is null for spin 1
        expect(result.spinTotal).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1b: Spin 2 — reelIndex is in bounds, value matches reelStrip[reelIndex],
   * and spinTotal equals spin1Value + spin2Value.
   *
   * **Validates: Requirements 4.3, 4.6, 5.1, 5.2, 5.3, 5.4**
   */
  it("spin 2: reelIndex is in bounds, value matches reelStrip[reelIndex], spinTotal equals sum", () => {
    fc.assert(
      fc.property(
        validReelStripArb,
        fc.integer({ min: 1, max: 10_000 }),
        (reelStrip, spin1Value) => {
          const spinnerId = "player-1"

          // Set up plugin state for spin 2 with a known spin 1 value
          setBigWheelState({
            spinOrder: [spinnerId],
            currentTurnIndex: 0,
            spinResults: { [spinnerId]: [spin1Value] },
            currentSpinNumber: 2,
            reelStrip,
            disconnectedPlayers: [],
          })

          // Resolve the round with the active spinner's pick
          const result = bigWheelPlugin.resolveRound({ [spinnerId]: { type: "spin" } }, defaultSettings)

          // Verify: reelIndex is in valid range
          expect(result.reelIndex).toBeGreaterThanOrEqual(0)
          expect(result.reelIndex).toBeLessThan(reelStrip.length)

          // Verify: value equals reelStrip[reelIndex]
          expect(result.value).toBe(reelStrip[result.reelIndex])

          // Verify: spinTotal equals spin1Value + spin2Value
          expect(result.spinTotal).toBe(spin1Value + result.value)
        }
      ),
      { numRuns: 100 }
    )
  })
})
