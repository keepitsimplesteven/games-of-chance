import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("Feature: coin-toss-gameplay-enhancements, Property 3: Last Round Triggers END_GAME", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 3: Last Round Triggers END_GAME
   *
   * For any configured total round count N (1–20), when the round number equals N
   * and the RESULT phase completes, the game server SHALL transition to END_GAME
   * phase rather than LOBBY.
   *
   * **Validates: Requirements 5.1**
   */
  it("transitions to END_GAME when the last round's RESULT phase completes for any totalRounds N", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random totalRounds between 1 and 20
        fc.integer({ min: 1, max: 20 }),
        async (totalRounds) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host and a second player
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          const playerConn = await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Configure the round count via UPDATE_SETTINGS
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: {
              changes: { roundCount: totalRounds },
            },
          })
          await gameRoom.onMessage(hostConn as any, updateMsg)

          // Verify settings applied
          const settingsState = getStateFromBroadcast(mockRoom)
          expect(settingsState.gameSettings.roundCount).toBe(totalRounds)

          // Play through all N rounds
          for (let round = 1; round <= totalRounds; round++) {
            // Start the round
            const startMsg = JSON.stringify({ type: "START_ROUND" })
            await gameRoom.onMessage(hostConn as any, startMsg)

            // Verify we're in PICKING phase
            let state = getStateFromBroadcast(mockRoom)
            expect(state.round.phase).toBe("PICKING")
            expect(state.round.roundNumber).toBe(round)

            // Both human players submit picks
            const pickMsg = JSON.stringify({
              type: "SUBMIT_PICK",
              payload: { pick: { side: "HEADS" } },
            })
            await gameRoom.onMessage(hostConn as any, pickMsg)
            await gameRoom.onMessage(playerConn as any, pickMsg)

            // Run timers to trigger resolution (bot picks + resolve)
            vi.runAllTimers()

            // After resolution, check phase
            state = getStateFromBroadcast(mockRoom)

            if (round < totalRounds) {
              // Intermediate rounds should land on RESULT
              expect(state.round.phase).toBe("RESULT")
            } else {
              // The last round stays in RESULT until the host sends START_ROUND
              expect(state.round.phase).toBe("RESULT")

              // Host sends START_ROUND which triggers END_GAME on the last round
              const nextMsg = JSON.stringify({ type: "START_ROUND" })
              await gameRoom.onMessage(hostConn as any, nextMsg)

              state = getStateFromBroadcast(mockRoom)
              expect(state.round.phase).toBe("END_GAME")
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
