/**
 * Feature: big-wheel, Property 5: Leaderboard ordering invariant
 *
 * For any set of connected players with game scores, the game leaderboard SHALL
 * be sorted by score descending, with ties broken by session leaderboard rank
 * ascending (lower rank number first). Only connected players SHALL appear in
 * the leaderboard.
 *
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */
import { describe, it, expect, afterEach } from "vitest"
import * as fc from "fast-check"
import { bigWheelPlugin, setBigWheelState, resetBigWheelState } from "../BigWheelPlugin"
import type { Player } from "@games-of-chance/shared"
import { BIG_WHEEL } from "../constants"

// ── Helpers ────────────────────────────────────────────────────────────────

afterEach(() => {
  resetBigWheelState()
})

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a list of players (2-15) with a mix of connected and disconnected */
const playersArb = fc
  .integer({ min: 2, max: 15 })
  .chain((count) =>
    fc.tuple(
      fc.uniqueArray(fc.uuid(), { minLength: count, maxLength: count }),
      fc.array(fc.boolean(), { minLength: count, maxLength: count }),
      fc.array(
        fc.stringOf(fc.char(), { minLength: 1, maxLength: 8 }),
        { minLength: count, maxLength: count }
      )
    ).map(([ids, connectedFlags, names]) => {
      // Ensure at least one player is connected
      const players: Player[] = ids.map((id, i) => ({
        id,
        name: names[i] || `Player${i}`,
        role: "player" as const,
        connected: connectedFlags[i],
        connectionId: connectedFlags[i] ? id : null,
      }))
      // If no one is connected, force the first player to be connected
      if (!players.some((p) => p.connected)) {
        players[0].connected = true
        players[0].connectionId = players[0].id
      }
      return players
    })
  )

/** Generate game scores for a set of player IDs (allow ties by using small range) */
function gameScoresArb(playerIds: string[]): fc.Arbitrary<Record<string, number>> {
  return fc
    .array(fc.integer({ min: 0, max: 200 }), {
      minLength: playerIds.length,
      maxLength: playerIds.length,
    })
    .map((scores) => {
      const result: Record<string, number> = {}
      for (let i = 0; i < playerIds.length; i++) {
        result[playerIds[i]] = scores[i]
      }
      return result
    })
}

/** Generate a spin order (shuffled player IDs — determines session rank) */
function spinOrderArb(playerIds: string[]): fc.Arbitrary<string[]> {
  return fc.shuffledSubarray(playerIds, {
    minLength: playerIds.length,
    maxLength: playerIds.length,
  })
}

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 5: Leaderboard ordering invariant", () => {
  /**
   * Property 5a: Only connected players appear in the leaderboard.
   *
   * **Validates: Requirements 7.4**
   */
  it("only connected players appear in the leaderboard", () => {
    fc.assert(
      fc.property(
        playersArb.chain((players) => {
          const allIds = players.map((p) => p.id)
          return fc.tuple(
            fc.constant(players),
            gameScoresArb(allIds),
            spinOrderArb(allIds)
          )
        }),
        ([players, gameScores, spinOrder]) => {
          setBigWheelState({
            spinOrder,
            currentTurnIndex: 0,
            spinResults: {},
            currentSpinNumber: 1,
            reelStrip: BIG_WHEEL.DEFAULT_REEL_STRIP,
            disconnectedPlayers: [],
          })

          const leaderboard = bigWheelPlugin.computeGameLeaderboard(players, gameScores)

          const connectedIds = new Set(
            players.filter((p) => p.connected).map((p) => p.id)
          )
          const leaderboardIds = new Set(leaderboard.map((e) => e.playerId))

          // Leaderboard should contain exactly the connected players
          expect(leaderboardIds).toEqual(connectedIds)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5b: Leaderboard is sorted by score descending.
   *
   * **Validates: Requirements 7.1**
   */
  it("leaderboard is sorted by score descending", () => {
    fc.assert(
      fc.property(
        playersArb.chain((players) => {
          const allIds = players.map((p) => p.id)
          return fc.tuple(
            fc.constant(players),
            gameScoresArb(allIds),
            spinOrderArb(allIds)
          )
        }),
        ([players, gameScores, spinOrder]) => {
          setBigWheelState({
            spinOrder,
            currentTurnIndex: 0,
            spinResults: {},
            currentSpinNumber: 1,
            reelStrip: BIG_WHEEL.DEFAULT_REEL_STRIP,
            disconnectedPlayers: [],
          })

          const leaderboard = bigWheelPlugin.computeGameLeaderboard(players, gameScores)

          // Scores should be in non-increasing order
          for (let i = 0; i < leaderboard.length - 1; i++) {
            expect(leaderboard[i].score).toBeGreaterThanOrEqual(leaderboard[i + 1].score)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5c: Ties are broken by session rank ascending (lower spinOrder index first).
   *
   * **Validates: Requirements 7.2**
   */
  it("ties are broken by session rank ascending (lower spinOrder index first)", () => {
    fc.assert(
      fc.property(
        playersArb.chain((players) => {
          const allIds = players.map((p) => p.id)
          return fc.tuple(
            fc.constant(players),
            gameScoresArb(allIds),
            spinOrderArb(allIds)
          )
        }),
        ([players, gameScores, spinOrder]) => {
          setBigWheelState({
            spinOrder,
            currentTurnIndex: 0,
            spinResults: {},
            currentSpinNumber: 1,
            reelStrip: BIG_WHEEL.DEFAULT_REEL_STRIP,
            disconnectedPlayers: [],
          })

          const leaderboard = bigWheelPlugin.computeGameLeaderboard(players, gameScores)

          // For adjacent entries with the same score, verify session rank ordering
          for (let i = 0; i < leaderboard.length - 1; i++) {
            if (leaderboard[i].score === leaderboard[i + 1].score) {
              const rankA = spinOrder.indexOf(leaderboard[i].playerId)
              const rankB = spinOrder.indexOf(leaderboard[i + 1].playerId)
              // Lower index (better session rank) should come first
              expect(rankA).toBeLessThanOrEqual(rankB)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5d: Sequential ranks are assigned (1, 2, 3, ...).
   *
   * **Validates: Requirements 7.1**
   */
  it("sequential ranks are assigned starting from 1", () => {
    fc.assert(
      fc.property(
        playersArb.chain((players) => {
          const allIds = players.map((p) => p.id)
          return fc.tuple(
            fc.constant(players),
            gameScoresArb(allIds),
            spinOrderArb(allIds)
          )
        }),
        ([players, gameScores, spinOrder]) => {
          setBigWheelState({
            spinOrder,
            currentTurnIndex: 0,
            spinResults: {},
            currentSpinNumber: 1,
            reelStrip: BIG_WHEEL.DEFAULT_REEL_STRIP,
            disconnectedPlayers: [],
          })

          const leaderboard = bigWheelPlugin.computeGameLeaderboard(players, gameScores)

          // Ranks should be sequential 1, 2, 3, ..., N
          for (let i = 0; i < leaderboard.length; i++) {
            expect(leaderboard[i].rank).toBe(i + 1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
