/**
 * Feature: playcaller-tournament, Property 12: Resolver output invariant
 *
 * Validates: Requirements 4.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { randomResolver } from "../games/playcaller/MatchResolver"

describe("Property 12: Resolver output invariant", () => {
  it("randomResolver always returns one of the two input player IDs", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 })
          )
          .filter(([a, b]) => a !== b),
        ([playerA, playerB]) => {
          const result = randomResolver(playerA, playerB)
          expect(result === playerA || result === playerB).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
