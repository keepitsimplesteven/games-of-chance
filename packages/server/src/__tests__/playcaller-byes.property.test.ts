/**
 * Feature: playcaller-tournament, Property 3: Bye assignment correctness
 *
 * For any player count N that is not a power of 2, the bracket SHALL assign
 * exactly `nextPowerOf2(N) - N` byes, all to the highest-seeded players
 * (seeds 1 through byeCount), and byes SHALL appear only in the first round.
 *
 * Validates: Requirements 2.3, 5.3, 5.4, 10.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  computeByeCount,
  nextPowerOfTwo,
} from "../games/playcaller/BracketEngine"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Non-power-of-2 player counts within valid range */
const nonPowerOf2CountArb = fc.constantFrom(3, 5, 6, 7, 9, 10)

/** Generates an array of unique player IDs of a given length (filtering proto-polluting keys) */
function uniquePlayerIdsArb(count: number) {
  return fc
    .uniqueArray(
      fc.string({ minLength: 1, maxLength: 12 }).filter(
        (s) => !Object.prototype.hasOwnProperty.call(Object.prototype, s)
      ),
      {
        minLength: count,
        maxLength: count,
      }
    )
}

// ── Property 3: Bye assignment correctness ─────────────────────────────────

describe("Feature: playcaller-tournament, Property 3: Bye assignment correctness", () => {
  /**
   * Property 3.1: The bracket's first round byes count equals nextPowerOfTwo(N) - N
   *
   * **Validates: Requirements 2.3, 10.3**
   */
  it("bye count equals nextPowerOfTwo(N) - N for non-power-of-2 player counts", () => {
    fc.assert(
      fc.property(nonPowerOf2CountArb, (playerCount) => {
        const playerIds = Array.from(
          { length: playerCount },
          (_, i) => `player-${i + 1}`
        )
        const bracket = generateBracket(playerIds)

        const expectedByeCount = nextPowerOfTwo(playerCount) - playerCount
        expect(computeByeCount(playerCount)).toBe(expectedByeCount)
        expect(bracket.rounds[0].byes.length).toBe(expectedByeCount)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3.2: All bye players are the highest-seeded players (seeds 1 through byeCount)
   *
   * **Validates: Requirements 5.3, 5.4**
   */
  it("byes are assigned to the highest-seeded players", () => {
    fc.assert(
      fc.property(
        nonPowerOf2CountArb.chain((count) =>
          uniquePlayerIdsArb(count).map((ids) => ({ count, ids }))
        ),
        ({ count, ids }) => {
          const bracket = generateBracket(ids)
          const byePlayers = bracket.rounds[0].byes
          const byeCount = nextPowerOfTwo(count) - count

          // Each bye player should have a seed in [1, byeCount]
          for (const playerId of byePlayers) {
            const seed = bracket.seeds[playerId]
            expect(seed).toBeGreaterThanOrEqual(1)
            expect(seed).toBeLessThanOrEqual(byeCount)
          }

          // All seeds 1..byeCount should be in the byes list
          const byeSeeds = byePlayers.map((p) => bracket.seeds[p]).sort((a, b) => a - b)
          const expectedSeeds = Array.from({ length: byeCount }, (_, i) => i + 1)
          expect(byeSeeds).toEqual(expectedSeeds)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3.3: No round other than round 0 has any byes
   *
   * **Validates: Requirements 5.3**
   */
  it("byes appear only in round 0 (first round)", () => {
    fc.assert(
      fc.property(
        nonPowerOf2CountArb.chain((count) =>
          uniquePlayerIdsArb(count).map((ids) => ({ count, ids }))
        ),
        ({ ids }) => {
          const bracket = generateBracket(ids)

          // Round 0 should have byes (non-empty for non-power-of-2)
          expect(bracket.rounds[0].byes.length).toBeGreaterThan(0)

          // All subsequent rounds should have empty byes arrays
          for (let r = 1; r < bracket.rounds.length; r++) {
            expect(bracket.rounds[r].byes).toEqual([])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
