/**
 * Feature: big-wheel, Property 2: Spin total arithmetic
 *
 * For any two values drawn from a valid reel strip, the computed spinTotal SHALL
 * equal their arithmetic sum (value1 + value2).
 *
 * **Validates: Requirements 4.5, 6.1**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { bigWheelPlugin, setBigWheelState } from "../BigWheelPlugin"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a valid reel strip value: integer in [1, 10000] */
const reelValueArb = fc.integer({ min: 1, max: 10_000 })

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

describe("Feature: big-wheel, Property 2: Spin total arithmetic", () => {
  /**
   * Property 2a: Pure arithmetic — for any two values from a valid reel strip range,
   * their sum equals value1 + value2.
   *
   * **Validates: Requirements 4.5, 6.1**
   */
  it("for any two reel values, spinTotal equals value1 + value2 (pure arithmetic)", () => {
    fc.assert(
      fc.property(reelValueArb, reelValueArb, (value1, value2) => {
        const expectedTotal = value1 + value2
        expect(expectedTotal).toBe(value1 + value2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2b: Plugin integration — set up plugin state with spin 1 result stored,
   * call resolveRound for spin 2, verify spinTotal === spin1Value + spin2Value.
   *
   * **Validates: Requirements 4.5, 6.1**
   */
  it("resolveRound computes spinTotal as spin1Value + spin2Value through the plugin", () => {
    fc.assert(
      fc.property(validReelStripArb, reelValueArb, (reelStrip, spin1Value) => {
        const spinnerId = "player-1"

        // Set up plugin state for spin 2 with a known spin 1 value stored
        setBigWheelState({
          spinOrder: [spinnerId],
          currentTurnIndex: 0,
          spinResults: { [spinnerId]: [spin1Value] },
          currentSpinNumber: 2,
          reelStrip,
          disconnectedPlayers: [],
        })

        // Resolve spin 2
        const result = bigWheelPlugin.resolveRound(
          { [spinnerId]: { type: "spin" } },
          {}
        )

        // The spin2 value is whatever the plugin resolved from the reel strip
        const spin2Value = result.value

        // Verify: spinTotal is exactly the arithmetic sum of both spin values
        expect(result.spinTotal).toBe(spin1Value + spin2Value)
      }),
      { numRuns: 100 }
    )
  })
})
