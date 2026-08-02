/**
 * Feature: coin-toss-gameplay-enhancements, Property 2: Current Player Result Ordering
 *
 * For any non-empty list of player results and any valid current player ID
 * present in that list, the result ordering function places the current player's
 * entry at index 0 of the output list while preserving the relative order of
 * all other players.
 *
 * **Validates: Requirements 4.1**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { orderResultsByCurrentPlayer, PlayerResult } from "../orderResults"

// Generator: unique player results array of 2–10 entries, plus a random currentPlayerId from the array
const playerResultsArb = fc
  .integer({ min: 2, max: 10 })
  .chain((size) =>
    fc
      .uniqueArray(fc.uuid(), { minLength: size, maxLength: size })
      .chain((ids) => {
        const results: fc.Arbitrary<PlayerResult[]> = fc.constant(
          ids.map((id) => ({ playerId: id, playerName: `Player-${id.slice(0, 4)}`, score: 0 }))
        )
        const currentPlayerId = fc.constantFrom(...ids)
        return fc.tuple(results, currentPlayerId)
      })
  )

describe("Feature: coin-toss-gameplay-enhancements, Property 2: Current Player Result Ordering", () => {
  /**
   * Property 2: Current Player Result Ordering
   *
   * For any non-empty results list with a valid currentPlayerId present,
   * the current player is always at index 0 and other players' relative
   * order is preserved.
   *
   * **Validates: Requirements 4.1**
   */
  it("places the current player at index 0 and preserves others' relative order", () => {
    fc.assert(
      fc.property(playerResultsArb, ([results, currentPlayerId]) => {
        const ordered = orderResultsByCurrentPlayer(results, currentPlayerId)

        // Current player must be at index 0
        expect(ordered[0].playerId).toBe(currentPlayerId)

        // Output length must match input length
        expect(ordered.length).toBe(results.length)

        // Other players (indices 1+) must preserve their relative order from the original
        const originalOthers = results.filter((r) => r.playerId !== currentPlayerId)
        const orderedOthers = ordered.slice(1)

        expect(orderedOthers.length).toBe(originalOthers.length)
        for (let i = 0; i < originalOthers.length; i++) {
          expect(orderedOthers[i].playerId).toBe(originalOthers[i].playerId)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: when currentPlayerId is NOT in the list, the original order is preserved.
   *
   * **Validates: Requirements 4.1**
   */
  it("preserves original order when currentPlayerId is not in the list", () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.uuid(), { minLength: 2, maxLength: 10 })
          .map((ids) => ids.map((id) => ({ playerId: id, playerName: `P-${id.slice(0, 4)}`, score: 0 }))),
        fc.uuid(),
        (results, missingId) => {
          // Ensure missingId is not in the results
          fc.pre(!results.some((r) => r.playerId === missingId))

          const ordered = orderResultsByCurrentPlayer(results, missingId)

          // Order should be unchanged
          expect(ordered.length).toBe(results.length)
          for (let i = 0; i < results.length; i++) {
            expect(ordered[i].playerId).toBe(results[i].playerId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
