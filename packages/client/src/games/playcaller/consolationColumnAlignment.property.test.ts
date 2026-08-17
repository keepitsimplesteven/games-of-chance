/**
 * Property tests for consolation row column alignment.
 *
 * Property 5: Consolation row column alignment
 *
 * For any consolation round with `placementStart` value `ps`, that round's matchups
 * SHALL be rendered in the consolation row at column index
 * `totalRounds - 1 - floor((ps - 3) / 2)`, aligning visually with the
 * corresponding main-bracket column.
 *
 * **Validates: Requirements 3.5, 3.6**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { getConsolationColumnIndex } from "./consolationColumnAlignment"

describe("Property 5: Consolation row column alignment", () => {
  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * The column index is always within bounds [0, totalRounds - 1].
   * This ensures consolation matchups never render outside the bracket grid.
   */
  it("column index is always within bounds [0, totalRounds - 1]", () => {
    fc.assert(
      fc.property(
        // totalRounds: at least 2 (minimum bracket: one round + finals)
        fc.integer({ min: 2, max: 10 }),
        // placementStart must be odd, >= 3, and produce a valid column
        // For a bracket with N rounds, max placement = 2*N - 1 (top seed eliminated first round)
        // Valid placementStart values: 3, 5, 7, ..., up to 2*totalRounds - 1
        fc.integer({ min: 2, max: 10 }),
        (totalRounds, rawIdx) => {
          // Generate valid odd placementStart values: 3, 5, 7, ...
          // Max valid ps such that column >= 0: totalRounds - 1 - floor((ps-3)/2) >= 0
          // → ps <= 2*totalRounds + 1
          const maxPs = 2 * totalRounds + 1
          const ps = 3 + 2 * ((rawIdx - 2) % Math.floor((maxPs - 3) / 2 + 1))

          const col = getConsolationColumnIndex(ps, totalRounds)

          expect(col).toBeGreaterThanOrEqual(0)
          expect(col).toBeLessThanOrEqual(totalRounds - 1)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * Higher placementStart values (worse placements, eliminated earlier) map to
   * lower column indices (earlier rounds in the visual layout).
   * e.g., 9th/10th (ps=9) gets a lower column than 3rd/4th (ps=3).
   */
  it("higher placementStart maps to lower column index (monotonically decreasing)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // totalRounds
        fc.integer({ min: 3, max: 19 }).filter((ps) => ps % 2 === 1), // odd ps1
        fc.integer({ min: 3, max: 19 }).filter((ps) => ps % 2 === 1), // odd ps2
        (totalRounds, ps1, ps2) => {
          // Only compare if both produce valid columns
          const col1 = getConsolationColumnIndex(ps1, totalRounds)
          const col2 = getConsolationColumnIndex(ps2, totalRounds)

          if (ps1 < ps2) {
            expect(col1).toBeGreaterThan(col2)
          } else if (ps1 > ps2) {
            expect(col1).toBeLessThan(col2)
          } else {
            expect(col1).toBe(col2)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * placementStart = 3 (3rd/4th place) always maps to the rightmost column
   * (the finals column), i.e., column = totalRounds - 1.
   */
  it("placementStart=3 always maps to the finals column (totalRounds - 1)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (totalRounds) => {
          const col = getConsolationColumnIndex(3, totalRounds)
          expect(col).toBe(totalRounds - 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * Verify concrete alignment for a 10-player bracket (4 rounds):
   * 9th/10th(ps=9)→col 0, 7th/8th(ps=7)→col 1, 5th/6th(ps=5)→col 2, 3rd/4th(ps=3)→col 3
   */
  it("10-player bracket (4 rounds): correct column assignments", () => {
    const totalRounds = 4
    expect(getConsolationColumnIndex(9, totalRounds)).toBe(0)
    expect(getConsolationColumnIndex(7, totalRounds)).toBe(1)
    expect(getConsolationColumnIndex(5, totalRounds)).toBe(2)
    expect(getConsolationColumnIndex(3, totalRounds)).toBe(3)
  })

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * Verify concrete alignment for an 8-player bracket (3 rounds):
   * 7th/8th(ps=7)→col 0, 5th/6th(ps=5)→col 1, 3rd/4th(ps=3)→col 2
   */
  it("8-player bracket (3 rounds): correct column assignments", () => {
    const totalRounds = 3
    expect(getConsolationColumnIndex(7, totalRounds)).toBe(0)
    expect(getConsolationColumnIndex(5, totalRounds)).toBe(1)
    expect(getConsolationColumnIndex(3, totalRounds)).toBe(2)
  })

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * Adjacent odd placementStart values (e.g., 3 & 5, 5 & 7) always differ by
   * exactly 1 column, ensuring even spacing across the bracket grid.
   */
  it("adjacent placement pairs differ by exactly 1 column", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // totalRounds
        fc.integer({ min: 3, max: 17 }).filter((ps) => ps % 2 === 1), // odd ps
        (totalRounds, ps) => {
          const col = getConsolationColumnIndex(ps, totalRounds)
          const colNext = getConsolationColumnIndex(ps + 2, totalRounds)

          // Going up by 2 in placementStart decreases column by 1
          expect(col - colNext).toBe(1)
        }
      ),
      { numRuns: 200 }
    )
  })
})
