/**
 * Feature: big-wheel, Property 6: Spin order respects session rank
 *
 * For any set of connected players with session leaderboard rankings, the
 * determined spin order SHALL contain exactly all connected player IDs (set
 * equality), and for any two players A and B where A has a strictly HIGHER
 * session rank number than B (worse standing), A SHALL appear BEFORE B in the
 * spin order. This creates a "last place spins first" ordering for dramatic
 * lead changes.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { determineSpinOrder } from "../spinOrder"
import type { SessionLeaderboardEntry } from "@games-of-chance/shared"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a unique set of player IDs (1-20 players) */
const playerIdsArb = fc
  .integer({ min: 1, max: 20 })
  .chain((count) =>
    fc.uniqueArray(fc.uuid(), { minLength: count, maxLength: count })
  )

/** Generate session leaderboard entries for a subset or all of the given players */
function sessionLeaderboardArb(
  playerIds: string[]
): fc.Arbitrary<SessionLeaderboardEntry[]> {
  // Each player may or may not have a leaderboard entry
  return fc
    .tuple(
      // Which players have leaderboard entries (subset via boolean mask)
      fc.array(fc.boolean(), {
        minLength: playerIds.length,
        maxLength: playerIds.length,
      }),
      // Ranks for players (allow ties by picking from small range)
      fc.array(fc.integer({ min: 1, max: 10 }), {
        minLength: playerIds.length,
        maxLength: playerIds.length,
      }),
      // Session points (arbitrary, not used by determineSpinOrder but required by type)
      fc.array(fc.integer({ min: 0, max: 1000 }), {
        minLength: playerIds.length,
        maxLength: playerIds.length,
      })
    )
    .map(([included, ranks, points]) => {
      const entries: SessionLeaderboardEntry[] = []
      for (let i = 0; i < playerIds.length; i++) {
        if (included[i]) {
          entries.push({
            playerId: playerIds[i],
            playerName: `Player${i}`,
            sessionPoints: points[i],
            gamesPlayed: 1,
            rank: ranks[i],
          })
        }
      }
      return entries
    })
}

/** Generate player IDs with guaranteed distinct ranks (no ties) for ordering checks */
function distinctRankLeaderboardArb(
  playerIds: string[]
): fc.Arbitrary<SessionLeaderboardEntry[]> {
  // Shuffle the player indices to assign distinct ranks 1..N
  return fc.shuffledSubarray(playerIds, { minLength: playerIds.length, maxLength: playerIds.length }).map(
    (shuffled) =>
      shuffled.map((id, idx) => ({
        playerId: id,
        playerName: `Player_${id.slice(0, 4)}`,
        sessionPoints: 100 - idx,
        gamesPlayed: 1,
        rank: idx + 1,
      }))
  )
}

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 6: Spin order respects session rank", () => {
  /**
   * Property 6a: Output contains exactly the same set of player IDs as input (set equality).
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  it("output contains exactly the same set of player IDs as input", () => {
    fc.assert(
      fc.property(
        playerIdsArb.chain((ids) =>
          sessionLeaderboardArb(ids).map((lb) => ({ playerIds: ids, leaderboard: lb }))
        ),
        ({ playerIds, leaderboard }) => {
          const result = determineSpinOrder(playerIds, leaderboard)

          // Set equality: same elements regardless of order
          expect(new Set(result)).toEqual(new Set(playerIds))
          // Same length (no duplicates)
          expect(result.length).toBe(playerIds.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6b: For any two players A and B where A has a strictly HIGHER session
   * rank number than B (worse standing), A appears BEFORE B in the spin order.
   * (Last place spins first.)
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it("players with strictly higher rank (worse standing) appear before players with lower rank", () => {
    fc.assert(
      fc.property(
        playerIdsArb.chain((ids) =>
          sessionLeaderboardArb(ids).map((lb) => ({ playerIds: ids, leaderboard: lb }))
        ),
        ({ playerIds, leaderboard }) => {
          const result = determineSpinOrder(playerIds, leaderboard)

          // Build rank lookup
          const rankMap = new Map<string, number>()
          for (const entry of leaderboard) {
            rankMap.set(entry.playerId, entry.rank)
          }
          const maxRank = leaderboard.length > 0
            ? Math.max(...leaderboard.map((e) => e.rank))
            : 0
          const fallbackRank = maxRank + 1

          // For any pair (A at i, B at j>i) where A has strictly higher rank than B,
          // that's correct (descending). If B has a strictly HIGHER rank than A,
          // the ordering is violated.
          for (let i = 0; i < result.length; i++) {
            for (let j = i + 1; j < result.length; j++) {
              const rankA = rankMap.get(result[i]) ?? fallbackRank
              const rankB = rankMap.get(result[j]) ?? fallbackRank
              // B should have a rank <= A (lower or equal rank = better standing, spins later)
              expect(rankB).toBeLessThanOrEqual(rankA)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6c: All connected players (including those without leaderboard entries)
   * appear in the output.
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  it("all connected players including those without leaderboard entries appear in output", () => {
    fc.assert(
      fc.property(
        playerIdsArb.chain((ids) => {
          // Ensure some players are NOT on the leaderboard
          const subsetSize = Math.max(0, Math.floor(ids.length / 2))
          const leaderboardPlayers = ids.slice(0, subsetSize)
          return distinctRankLeaderboardArb(leaderboardPlayers).map((lb) => ({
            playerIds: ids,
            leaderboard: lb,
          }))
        }),
        ({ playerIds, leaderboard }) => {
          const result = determineSpinOrder(playerIds, leaderboard)

          // Every player ID from input must appear in output
          for (const id of playerIds) {
            expect(result).toContain(id)
          }
          // No extra players in output
          expect(result.length).toBe(playerIds.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6d: With distinct ranks (no ties), ordering is fully deterministic
   * and matches rank descending (last place first).
   *
   * **Validates: Requirements 3.1**
   */
  it("with distinct ranks, output is sorted by rank descending", () => {
    fc.assert(
      fc.property(
        playerIdsArb.chain((ids) =>
          distinctRankLeaderboardArb(ids).map((lb) => ({ playerIds: ids, leaderboard: lb }))
        ),
        ({ playerIds, leaderboard }) => {
          const result = determineSpinOrder(playerIds, leaderboard)

          // Build rank lookup — all players have entries with distinct ranks
          const rankMap = new Map<string, number>()
          for (const entry of leaderboard) {
            rankMap.set(entry.playerId, entry.rank)
          }

          // Result should be strictly sorted by rank descending (highest rank first)
          for (let i = 0; i < result.length - 1; i++) {
            const rankCurr = rankMap.get(result[i])!
            const rankNext = rankMap.get(result[i + 1])!
            expect(rankCurr).toBeGreaterThan(rankNext)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
