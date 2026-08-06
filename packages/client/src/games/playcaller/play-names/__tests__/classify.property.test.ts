import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { classifyCircumstance } from "../classify"
import type { Circumstance } from "../types"

/**
 * Property 5: Circumstance classification is exhaustive and deterministic
 *
 * For any valid down (1–4) and positive yardsToGo, the classifyCircumstance function
 * returns "short_yardage" when yardsToGo ≤ 3, "desperation" when down === 4 and
 * yardsToGo > 5, and "standard" for all other cases. Every valid (down, yardsToGo)
 * pair maps to exactly one circumstance.
 *
 * **Validates: Requirements 5.4, 5.5, 5.6, 5.7**
 */
describe("classifyCircumstance property tests", () => {
  const validDown = fc.integer({ min: 1, max: 4 })
  const positiveYards = fc.integer({ min: 1, max: 99 })

  const ALL_CIRCUMSTANCES: Circumstance[] = ["standard", "short_yardage", "desperation"]

  it("returns 'short_yardage' when yardsToGo <= 3 for any down", () => {
    fc.assert(
      fc.property(
        validDown,
        fc.integer({ min: 1, max: 3 }),
        (down, yardsToGo) => {
          expect(classifyCircumstance(down, yardsToGo)).toBe("short_yardage")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("returns 'desperation' when down === 4 and yardsToGo > 5", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 99 }),
        (yardsToGo) => {
          expect(classifyCircumstance(4, yardsToGo)).toBe("desperation")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("returns 'standard' for all other valid (down, yardsToGo) pairs", () => {
    fc.assert(
      fc.property(
        validDown,
        positiveYards,
        (down, yardsToGo) => {
          // Skip cases covered by other properties
          if (yardsToGo <= 3) return // short_yardage territory
          if (down === 4 && yardsToGo > 5) return // desperation territory

          expect(classifyCircumstance(down, yardsToGo)).toBe("standard")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("every valid (down, yardsToGo) pair maps to exactly one of the three circumstances", () => {
    fc.assert(
      fc.property(
        validDown,
        positiveYards,
        (down, yardsToGo) => {
          const result = classifyCircumstance(down, yardsToGo)

          // Result is one of the valid circumstances
          expect(ALL_CIRCUMSTANCES).toContain(result)

          // Deterministic: calling again produces the same result
          expect(classifyCircumstance(down, yardsToGo)).toBe(result)
        }
      ),
      { numRuns: 500 }
    )
  })
})
