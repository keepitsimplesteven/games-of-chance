/**
 * Feature: playcaller-tournament, Property 6: Tournament completion
 *
 * Validates: Requirements 3.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { generateBracket, resolveCurrentRound, isComplete } from "../games/playcaller/BracketEngine"
import type { MatchResolver } from "@games-of-chance/shared"

describe("Property 6: Tournament completion", () => {
  it("fully resolving all rounds results in isComplete returning true", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          let bracket = generateBracket(players)

          // Before any resolution, bracket should not be complete
          expect(isComplete(bracket)).toBe(false)

          // Fully resolve all rounds
          while (!isComplete(bracket)) {
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // After full resolution, isComplete must return true
          expect(isComplete(bracket)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("isComplete returns false before the final resolution", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          let bracket = generateBracket(players)
          const totalRounds = bracket.totalRounds

          // Resolve all rounds except the last one
          for (let i = 0; i < totalRounds - 1; i++) {
            // Before resolving this round, bracket should not be complete
            expect(isComplete(bracket)).toBe(false)
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // After resolving all rounds except the last, still not complete
          // (for brackets with more than 1 round)
          if (totalRounds > 1) {
            expect(isComplete(bracket)).toBe(false)
          }

          // Now resolve the final round
          bracket = resolveCurrentRound(bracket, resolver)

          // After the final resolution, isComplete returns true
          expect(isComplete(bracket)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
