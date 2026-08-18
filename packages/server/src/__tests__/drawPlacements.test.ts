/**
 * Unit tests for drawPlacements in lottery/odds.ts
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */
import { describe, it, expect } from "vitest"
import {
  drawPlacements,
  DEFAULT_LOTTERY_ODDS,
} from "../games/playcaller/lottery/odds"

/**
 * Creates a seeded deterministic RNG using a simple linear congruential generator.
 * Produces repeatable sequences for testing.
 */
function seededRng(seed: number): () => number {
  let state = seed
  return () => {
    // LCG parameters (Numerical Recipes)
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0x100000000
  }
}

describe("drawPlacements", () => {
  describe("basic behavior", () => {
    it("returns an array of length equal to playerCount", () => {
      const rng = seededRng(42)
      const result = drawPlacements(10, rng)
      expect(result).toHaveLength(10)
    })

    it("assigns each seed a unique 1-based placement", () => {
      const rng = seededRng(123)
      const result = drawPlacements(10, rng)

      // All placements should be 1 through 10, no duplicates
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it("every placement from 1 to N is used exactly once", () => {
      const rng = seededRng(999)
      for (let n = 2; n <= 10; n++) {
        const result = drawPlacements(n, seededRng(n * 100))
        const sorted = [...result].sort((a, b) => a - b)
        expect(sorted).toEqual(Array.from({ length: n }, (_, i) => i + 1))
      }
    })
  })

  describe("determinism", () => {
    it("same seed produces same output", () => {
      const result1 = drawPlacements(10, seededRng(42))
      const result2 = drawPlacements(10, seededRng(42))
      expect(result1).toEqual(result2)
    })

    it("different seeds produce different outputs", () => {
      const result1 = drawPlacements(10, seededRng(1))
      const result2 = drawPlacements(10, seededRng(2))
      // Extremely unlikely to be equal with different seeds
      expect(result1).not.toEqual(result2)
    })
  })

  describe("playerCount < 10", () => {
    it("handles playerCount=2 (uses first 2 rows/columns)", () => {
      const rng = seededRng(50)
      const result = drawPlacements(2, rng)
      expect(result).toHaveLength(2)
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 2])
    })

    it("handles playerCount=5 (uses first 5 rows/columns)", () => {
      const rng = seededRng(77)
      const result = drawPlacements(5, rng)
      expect(result).toHaveLength(5)
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 2, 3, 4, 5])
    })

    it("handles playerCount=8", () => {
      const rng = seededRng(200)
      const result = drawPlacements(8, rng)
      expect(result).toHaveLength(8)
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })
  })

  describe("edge cases and validation", () => {
    it("throws for playerCount < 2", () => {
      expect(() => drawPlacements(1, Math.random)).toThrow(
        "playerCount must be between 2 and 10"
      )
    })

    it("throws for playerCount > 10", () => {
      expect(() => drawPlacements(11, Math.random)).toThrow(
        "playerCount must be between 2 and 10"
      )
    })

    it("throws for playerCount = 0", () => {
      expect(() => drawPlacements(0, Math.random)).toThrow(
        "playerCount must be between 2 and 10"
      )
    })
  })

  describe("weighted distribution (statistical)", () => {
    it("seed 1 (best odds) gets 1st place more often than seed 10 (worst odds)", () => {
      const iterations = 10000
      let seed1First = 0
      let seed10First = 0

      for (let i = 0; i < iterations; i++) {
        const rng = seededRng(i)
        const result = drawPlacements(10, rng)
        if (result[0] === 1) seed1First++ // seed 1 got 1st place
        if (result[9] === 1) seed10First++ // seed 10 got 1st place
      }

      // Seed 1 has 18.9% chance of 1st, seed 10 has 1.9% — ratio ~10:1
      expect(seed1First).toBeGreaterThan(seed10First * 3) // conservative check
    })

    it("seed 10 (worst odds) ends up in last place more often than average", () => {
      const iterations = 10000
      let seed10Last = 0

      for (let i = 0; i < iterations; i++) {
        const rng = seededRng(i + 50000)
        const result = drawPlacements(10, rng)
        if (result[9] === 10) seed10Last++ // seed 10 got 10th place
      }

      // With 10 players, uniform expectation for 10th place is 10% (1000/10000).
      // Seed 10's column probability for last place is 50.9% —
      // even after conditional sampling it should be well above average.
      const uniformExpectation = iterations / 10
      expect(seed10Last).toBeGreaterThan(uniformExpectation)
    })
  })

  describe("custom table support", () => {
    it("accepts a custom odds table", () => {
      // Uniform 2x2 table: each seed has 50% chance of each placement
      const uniformTable = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => 0.1)
      )
      const rng = seededRng(42)
      const result = drawPlacements(2, rng, uniformTable)
      expect(result).toHaveLength(2)
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 2])
    })

    it("deterministic table forces specific outcome", () => {
      // Table where seed 0 always gets placement 1, seed 1 always gets placement 2
      const deterministicTable = Array.from({ length: 10 }, (_, row) => {
        const cols = new Array(10).fill(0)
        cols[row] = 1.0 // each seed gets exactly one placement
        return cols
      })

      const result = drawPlacements(10, seededRng(999), deterministicTable)
      // Each seed i should get placement i+1
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
  })
})
