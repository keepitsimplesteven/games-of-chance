import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("Feature: host-control-panel, Property 3: Kick removes player from state", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 3: Kick removes player from state
   *
   * For any room with N players (N > 1) and any connected non-host target player,
   * after a valid KICK_PLAYER message is processed, the target player shall not
   * appear in the players list and the player count shall be N - 1.
   *
   * **Validates: Requirements 2.2**
   */
  it("kicking a valid non-host target removes them from state and decreases player count by 1", () => {
    fc.assert(
      fc.asyncProperty(
        // Generate a player count between 2 and 10
        fc.integer({ min: 2, max: 10 }),
        // Generate a random index for the kick target (non-host)
        fc.integer({ min: 0, max: 100 }),
        async (playerCount, targetIndexSeed) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join the host player first
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Join additional players (playerCount - 1 non-host players)
          const nonHostIds: string[] = []
          for (let i = 1; i < playerCount; i++) {
            await joinPlayer(gameRoom, {
              name: `Player${i}`,
              clientId: `player-${i}`,
            })
            nonHostIds.push(`player-${i}`)
          }

          // Verify initial state has correct player count
          const stateBefore = getStateFromBroadcast(mockRoom)
          expect(stateBefore.players.length).toBe(playerCount)

          // Select a random non-host player as the kick target
          const targetIndex = targetIndexSeed % nonHostIds.length
          const targetId = nonHostIds[targetIndex]

          // Host sends KICK_PLAYER for the target
          const kickMsg = JSON.stringify({
            type: "KICK_PLAYER",
            payload: { playerId: targetId },
          })
          await gameRoom.onMessage(kickMsg, hostConn as any)

          // Verify the target is no longer in the players list
          const stateAfter = getStateFromBroadcast(mockRoom)
          const targetInState = stateAfter.players.find(
            (p: any) => p.id === targetId
          )
          expect(targetInState).toBeUndefined()

          // Verify player count decreased by exactly 1
          expect(stateAfter.players.length).toBe(playerCount - 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
