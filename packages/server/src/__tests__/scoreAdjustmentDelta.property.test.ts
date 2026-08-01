import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("Feature: host-control-panel, Property 8: Score adjustment applies delta correctly", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 8: Score adjustment applies delta correctly
   *
   * For any player, any integer delta (positive or negative), and any score type
   * ("game" or "session"), after a valid ADJUST_SCORE message, the target player's
   * specified score shall equal the previous value plus the delta.
   *
   * **Validates: Requirements 4.3**
   */
  it("score equals previous + delta for any valid adjustment", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate player count between 2 and 6
        fc.integer({ min: 2, max: 6 }),
        // Generate a target player index (non-host players start at index 1)
        fc.integer({ min: 0, max: 100 }),
        // Generate a delta between -1000 and +1000
        fc.integer({ min: -1000, max: 1000 }),
        // Generate score type
        fc.constantFrom("game" as const, "session" as const),
        async (playerCount, targetIndexSeed, delta, scoreType) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join players: first player is host, rest are regular players
          const connections: Awaited<ReturnType<typeof joinPlayer>>[] = []
          for (let i = 0; i < playerCount; i++) {
            const conn = await joinPlayer(gameRoom, {
              name: `Player${i}`,
              clientId: `player-${i}`,
            })
            connections.push(conn)
          }

          // Get current state to determine available players
          const stateBefore = getStateFromBroadcast(mockRoom)

          // Pick a target player (can be any player including host for score adjustment)
          const targetIndex = targetIndexSeed % stateBefore.players.length
          const targetPlayer = stateBefore.players[targetIndex]

          // Determine the previous score for the target player
          let previousScore: number
          if (scoreType === "game") {
            const leaderboardEntry = stateBefore.gameLeaderboard.find(
              (e: any) => e.playerId === targetPlayer.id
            )
            previousScore = leaderboardEntry?.score ?? 0
          } else {
            const leaderboardEntry = stateBefore.sessionLeaderboard.find(
              (e: any) => e.playerId === targetPlayer.id
            )
            previousScore = leaderboardEntry?.sessionPoints ?? 0
          }

          // Host (player-0, connections[0]) sends ADJUST_SCORE
          const adjustMsg = JSON.stringify({
            type: "ADJUST_SCORE",
            payload: {
              targetPlayerId: targetPlayer.id,
              delta,
              scoreType,
            },
          })
          await gameRoom.onMessage(adjustMsg, connections[0] as any)

          // Get state after adjustment
          const stateAfter = getStateFromBroadcast(mockRoom)

          // Verify the score equals previous + delta
          if (scoreType === "game") {
            const entryAfter = stateAfter.gameLeaderboard.find(
              (e: any) => e.playerId === targetPlayer.id
            )
            expect(entryAfter).toBeDefined()
            expect(entryAfter.score).toBe(previousScore + delta)
          } else {
            const entryAfter = stateAfter.sessionLeaderboard.find(
              (e: any) => e.playerId === targetPlayer.id
            )
            expect(entryAfter).toBeDefined()
            expect(entryAfter.sessionPoints).toBe(previousScore + delta)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
