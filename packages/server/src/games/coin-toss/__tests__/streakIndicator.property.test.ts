/**
 * Feature: coin-toss-gameplay-enhancements, Property 9: Streak Indicator Mapping
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { getStreakIndicator } from "../StreakEngine"

// ── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Generates a pair [correctStreak, wrongStreak] with the mutual exclusion constraint:
 * when one is positive, the other must be 0.
 */
const mutuallyExclusiveStreaksArb = fc.oneof(
  // Case 1: correctStreak > 0, wrongStreak = 0
  fc.integer({ min: 1, max: 20 }).map((c) => [c, 0] as [number, number]),
  // Case 2: correctStreak = 0, wrongStreak > 0
  fc.integer({ min: 1, max: 20 }).map((w) => [0, w] as [number, number]),
  // Case 3: both are 0
  fc.constant([0, 0] as [number, number])
)

// ── Property: Streak Indicator Mapping ─────────────────────────────────────

describe("Feature: coin-toss-gameplay-enhancements, Property 9: Streak Indicator Mapping", () => {
  /**
   * Property: Streak Indicator Mapping
   *
   * For any player with correctStreak `c` and wrongStreak `w` (mutually exclusive),
   * the getStreakIndicator function returns:
   * - "" when c = 0 and w ≤ 1
   * - "🔥" when c = 1
   * - "🔥🔥" when c ≥ 2
   * - "🧊" when w = 2
   * - "🧊🧊" when w ≥ 3
   *
   * **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**
   */
  it("should return correct emoji for all valid streak combinations", () => {
    fc.assert(
      fc.property(mutuallyExclusiveStreaksArb, ([correctStreak, wrongStreak]) => {
        const result = getStreakIndicator(correctStreak, wrongStreak)

        if (correctStreak >= 3) {
          expect(result).toBe("🔥🔥")
        } else if (correctStreak === 2) {
          expect(result).toBe("🔥")
        } else if (wrongStreak >= 3) {
          expect(result).toBe("🧊🧊")
        } else if (wrongStreak === 2) {
          expect(result).toBe("🧊")
        } else {
          // c ≤ 1 and w ≤ 1 → no indicator
          expect(result).toBe("")
        }
      }),
      { numRuns: 200 }
    )
  })

  it("should return no indicator when both streaks are zero", () => {
    fc.assert(
      fc.property(fc.constant([0, 0] as [number, number]), ([c, w]) => {
        expect(getStreakIndicator(c, w)).toBe("")
      }),
      { numRuns: 100 }
    )
  })

  it("should return fire emoji for correct streak >= 2", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (correctStreak) => {
        const result = getStreakIndicator(correctStreak, 0)
        if (correctStreak >= 3) {
          expect(result).toBe("🔥🔥")
        } else if (correctStreak === 2) {
          expect(result).toBe("🔥")
        } else {
          // correctStreak = 1 → no indicator
          expect(result).toBe("")
        }
      }),
      { numRuns: 100 }
    )
  })

  it("should return ice emoji only for wrong streak >= 2", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (wrongStreak) => {
        const result = getStreakIndicator(0, wrongStreak)
        if (wrongStreak >= 3) {
          expect(result).toBe("🧊🧊")
        } else if (wrongStreak === 2) {
          expect(result).toBe("🧊")
        } else {
          // wrongStreak = 1 → no indicator
          expect(result).toBe("")
        }
      }),
      { numRuns: 100 }
    )
  })
})
