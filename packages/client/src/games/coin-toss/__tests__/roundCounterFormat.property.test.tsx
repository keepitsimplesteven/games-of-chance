/**
 * Feature: coin-toss-gameplay-enhancements, Property 1: Round Counter Format
 *
 * For any valid round number X (1 ≤ X ≤ Y) and total Y (1 ≤ Y ≤ 100),
 * the RoundCounter component renders text matching "Round X of Y".
 *
 * **Validates: Requirements 3.1**
 */
import { describe, it, expect, afterEach } from "vitest"
import * as fc from "fast-check"
import { render, cleanup } from "@testing-library/react"
import { RoundCounter } from "../RoundCounter"

afterEach(() => {
  cleanup()
})

// Generator: totalRounds between 1 and 100, then currentRound between 1 and totalRounds
const roundParamsArb = fc
  .integer({ min: 1, max: 100 })
  .chain((totalRounds) =>
    fc
      .integer({ min: 1, max: totalRounds })
      .map((currentRound) => ({ currentRound, totalRounds }))
  )

describe("Feature: coin-toss-gameplay-enhancements, Property 1: Round Counter Format", () => {
  /**
   * Property 1: Round Counter Format
   *
   * For any valid currentRound and totalRounds, the rendered output
   * must contain the exact text "Round X of Y".
   *
   * **Validates: Requirements 3.1**
   */
  it("renders 'Round X of Y' for any valid currentRound and totalRounds", () => {
    fc.assert(
      fc.property(roundParamsArb, ({ currentRound, totalRounds }) => {
        const { getByText } = render(
          <RoundCounter currentRound={currentRound} totalRounds={totalRounds} />
        )

        const expectedText = `Round ${currentRound} of ${totalRounds}`
        expect(getByText(expectedText)).toBeInTheDocument()

        cleanup()
      }),
      { numRuns: 100 }
    )
  })
})
