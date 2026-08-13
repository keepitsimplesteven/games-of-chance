import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { classifyCircumstance } from "../classify"
import type { Circumstance } from "../types"

/**
 * Property 1: Circumstance Classifier Correctness
 *
 * For any valid input tuple (down ∈ {1..4}, yardsToGo ∈ {1..99}, yardLine ∈ {1..99}),
 * classifyCircumstance(down, yardsToGo, yardLine) SHALL return the unique Circumstance
 * dictated by the priority rules:
 *   goal_line if yardLine ≤ 5;
 *   desperation if down = 4 and yardsToGo ≥ 4;
 *   must_convert if down = 4 and yardsToGo ∈ {1..3};
 *   short_yardage if yardsToGo ∈ {1..2};
 *   medium_yardage if yardsToGo ∈ {3..5};
 *   long_yardage if yardsToGo ∈ {6..9};
 *   standard otherwise.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
 */
describe("Property 1: Circumstance Classifier Correctness", () => {
  const validDown = fc.integer({ min: 1, max: 4 })
  const validYardsToGo = fc.integer({ min: 1, max: 99 })
  const validYardLine = fc.integer({ min: 1, max: 99 })

  const ALL_CIRCUMSTANCES: Circumstance[] = [
    "standard",
    "short_yardage",
    "medium_yardage",
    "long_yardage",
    "desperation",
    "goal_line",
    "must_convert",
  ]

  /**
   * Reference implementation of the priority rules for oracle comparison.
   */
  function expectedCircumstance(down: number, yardsToGo: number, yardLine: number): Circumstance {
    if (yardLine <= 5) return "goal_line"
    if (down === 4 && yardsToGo >= 4) return "desperation"
    if (down === 4 && yardsToGo >= 1 && yardsToGo <= 3) return "must_convert"
    if (yardsToGo <= 2) return "short_yardage"
    if (yardsToGo >= 3 && yardsToGo <= 5) return "medium_yardage"
    if (yardsToGo >= 6 && yardsToGo <= 9) return "long_yardage"
    return "standard"
  }

  it("returns the correct circumstance for any valid (down, yardsToGo, yardLine) input", () => {
    fc.assert(
      fc.property(
        validDown,
        validYardsToGo,
        validYardLine,
        (down, yardsToGo, yardLine) => {
          const result = classifyCircumstance(down, yardsToGo, yardLine)
          const expected = expectedCircumstance(down, yardsToGo, yardLine)
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })

  it("always returns exactly one of the seven valid Circumstance values", () => {
    fc.assert(
      fc.property(
        validDown,
        validYardsToGo,
        validYardLine,
        (down, yardsToGo, yardLine) => {
          const result = classifyCircumstance(down, yardsToGo, yardLine)
          expect(ALL_CIRCUMSTANCES).toContain(result)
        }
      ),
      { numRuns: 300 }
    )
  })

  it("is deterministic — same inputs always produce the same output", () => {
    fc.assert(
      fc.property(
        validDown,
        validYardsToGo,
        validYardLine,
        (down, yardsToGo, yardLine) => {
          const first = classifyCircumstance(down, yardsToGo, yardLine)
          const second = classifyCircumstance(down, yardsToGo, yardLine)
          expect(first).toBe(second)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("goal_line takes priority over all other rules when yardLine <= 5", () => {
    fc.assert(
      fc.property(
        validDown,
        validYardsToGo,
        fc.integer({ min: 1, max: 5 }),
        (down, yardsToGo, yardLine) => {
          expect(classifyCircumstance(down, yardsToGo, yardLine)).toBe("goal_line")
        }
      ),
      { numRuns: 200 }
    )
  })
})
