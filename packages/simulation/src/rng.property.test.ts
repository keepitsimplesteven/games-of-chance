import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { SeededRng } from "./rng"

describe("SeededRng Property Tests", () => {
  /**
   * Property 2: Seed Determinism
   * For any seed value (arbitrary integer), two SeededRng instances created
   * with the same seed should produce identical sequences of N values.
   *
   * **Validates: Requirements 1.4**
   */
  it("two SeededRng instances with the same seed produce identical sequences", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 1, max: 1000 }),
        (seed, sequenceLength) => {
          const rng1 = new SeededRng(seed)
          const rng2 = new SeededRng(seed)

          for (let i = 0; i < sequenceLength; i++) {
            expect(rng1.next()).toBe(rng2.next())
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("two SeededRng instances with the same seed produce identical nextInt sequences", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        (seed, sequenceLength, max) => {
          const rng1 = new SeededRng(seed)
          const rng2 = new SeededRng(seed)

          for (let i = 0; i < sequenceLength; i++) {
            expect(rng1.nextInt(max)).toBe(rng2.nextInt(max))
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
