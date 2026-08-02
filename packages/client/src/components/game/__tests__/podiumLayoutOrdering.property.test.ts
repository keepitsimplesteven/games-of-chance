/**
 * Feature: coin-toss-gameplay-enhancements, Property 4: Podium Layout Ordering
 *
 * For any game leaderboard with 3 or more entries sorted by rank, the podium
 * extraction function returns rank 1 in the center position, rank 2 in the
 * left position, and rank 3 in the right position, with all remaining players
 * (rank 4+) in ascending rank order below the podium.
 *
 * **Validates: Requirements 5.3, 5.4**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { extractPodium, PodiumEntry } from "../extractPodium"

/**
 * Generator: creates a random leaderboard of 3–10 entries with sequential ranks (1, 2, 3, ..., N).
 * Entries are shuffled to simulate receiving data in arbitrary order.
 */
const leaderboardArb = fc
  .integer({ min: 3, max: 10 })
  .chain((size) =>
    fc.shuffledSubarray(
      Array.from({ length: size }, (_, i) => i + 1),
      { minLength: size, maxLength: size }
    ).chain((shuffledRanks) =>
      fc.tuple(
        ...shuffledRanks.map((rank) =>
          fc.record({
            playerId: fc.uuid(),
            playerName: fc.string({ minLength: 1, maxLength: 10 }),
            score: fc.integer({ min: 0, max: 1000 }),
            rank: fc.constant(rank),
          })
        )
      )
    )
  ) as fc.Arbitrary<PodiumEntry[]>

describe("Feature: coin-toss-gameplay-enhancements, Property 4: Podium Layout Ordering", () => {
  /**
   * Property 4: Podium Layout Ordering
   *
   * For any leaderboard with 3–10 entries:
   * - center entry has rank 1
   * - left entry has rank 2
   * - right entry has rank 3
   * - remaining entries are in ascending rank order (4, 5, 6, ...)
   *
   * **Validates: Requirements 5.3, 5.4**
   */
  it("assigns rank 1 to center, rank 2 to left, rank 3 to right, and remaining in ascending order", () => {
    fc.assert(
      fc.property(leaderboardArb, (leaderboard) => {
        const { center, left, right, remaining } = extractPodium(leaderboard)

        // Rank 1 is in center position
        expect(center.rank).toBe(1)

        // Rank 2 is in left position
        expect(left.rank).toBe(2)

        // Rank 3 is in right position
        expect(right.rank).toBe(3)

        // Remaining entries are in ascending rank order
        for (let i = 0; i < remaining.length; i++) {
          expect(remaining[i].rank).toBe(i + 4)
        }

        // Total output count matches input count
        expect(1 + 1 + 1 + remaining.length).toBe(leaderboard.length)
      }),
      { numRuns: 100 }
    )
  })
})
