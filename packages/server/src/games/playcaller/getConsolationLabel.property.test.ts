/**
 * Property tests for getConsolationLabel()
 *
 * Property 3: Single-matchup consolation label format
 * Property 4: Multi-matchup consolation label format
 *
 * Validates: Requirements 2.1, 2.2
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { getConsolationLabel, ordinal } from "./BracketEngine"
import type { ConsolationRound, Matchup } from "@games-of-chance/shared"

/** Helper: creates a minimal Matchup stub */
function makeMatchup(index: number): Matchup {
  return {
    matchupId: `m${index}`,
    playerA: `playerA-${index}`,
    playerB: `playerB-${index}`,
    winner: null,
  }
}

/** Helper: creates a ConsolationRound with a given number of matchups and placementStart */
function makeConsolationRound(
  matchupCount: number,
  placementStart: number
): ConsolationRound {
  return {
    roundIndex: 0,
    matchups: Array.from({ length: matchupCount }, (_, i) => makeMatchup(i)),
    resolved: false,
    sourceRoundIndex: 0,
    placementStart,
  }
}

describe("Property 3: Single-matchup consolation label format", () => {
  /**
   * For any ConsolationRound with exactly one matchup and a given placementStart
   * value ps, getConsolationLabel() shall return "{ordinal(ps)}/{ordinal(ps+1)}".
   *
   * **Validates: Requirements 2.1, 2.3**
   */
  it("returns ordinal(ps)/ordinal(ps+1) for single-matchup rounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (placementStart) => {
          const cRound = makeConsolationRound(1, placementStart)

          const result = getConsolationLabel(cRound)

          const expected = `${ordinal(placementStart)}/${ordinal(placementStart + 1)}`
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("label always contains a forward slash separator for single matchups", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (placementStart) => {
          const cRound = makeConsolationRound(1, placementStart)

          const result = getConsolationLabel(cRound)

          expect(result).toContain("/")
          expect(result).not.toContain("SF")
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("Property 4: Multi-matchup consolation label format", () => {
  /**
   * For any ConsolationRound with exactly two matchups and a given placementStart
   * value ps, getConsolationLabel() shall return "{ordinal(ps)}-{ordinal(ps+3)} SF".
   *
   * **Validates: Requirement 2.2**
   */
  it("returns ordinal(ps)-ordinal(ps+3) SF for two-matchup rounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (placementStart) => {
          const cRound = makeConsolationRound(2, placementStart)

          const result = getConsolationLabel(cRound)

          const expected = `${ordinal(placementStart)}-${ordinal(placementStart + 3)} SF`
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("label always ends with ' SF' for two-matchup rounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (placementStart) => {
          const cRound = makeConsolationRound(2, placementStart)

          const result = getConsolationLabel(cRound)

          expect(result).toMatch(/ SF$/)
          expect(result).not.toContain("/")
        }
      ),
      { numRuns: 100 }
    )
  })
})
