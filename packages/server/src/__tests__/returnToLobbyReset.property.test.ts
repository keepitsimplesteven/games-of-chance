import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"
import { getStreakState, resetCoinTossStreakState } from "../games/coin-toss/CoinTossPlugin"

describe("Feature: coin-toss-gameplay-enhancements, Property 5: Return to Lobby Resets State", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 5: Return to Lobby Resets State
   *
   * For any game in END_GAME phase with arbitrary player scores and streak states,
   * when the RETURN_TO_LOBBY transition is triggered, the resulting state SHALL have
   * phase equal to "LOBBY", all game scores equal to 0, and all streak counters
   * (correct and wrong) equal to 0.
   *
   * **Validates: Requirements 5.6**
   */
  it("RETURN_TO_LOBBY transitions to LOBBY with all scores at 0 and all streak counters at 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Random number of rounds to play (1-5) before END_GAME
        fc.integer({ min: 1, max: 5 }),
        // Random pick side for the host each round
        fc.array(fc.constantFrom("HEADS" as const, "TAILS" as const), { minLength: 5, maxLength: 5 }),
        async (roundCount, hostPicks) => {
          // Reset module-level streak state to avoid cross-iteration pollution
          resetCoinTossStreakState()

          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Set round count to the random value so the game ends after that many rounds
          const settingsMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { roundCount } },
          })
          await gameRoom.onMessage(hostConn as any, settingsMsg)

          // Play through all rounds to reach END_GAME
          for (let r = 0; r < roundCount; r++) {
            // Start round
            const startMsg = JSON.stringify({ type: "START_ROUND" })
            await gameRoom.onMessage(hostConn as any, startMsg)

            // Host submits pick (bots already picked instantly in scheduleBotPicks)
            const pickMsg = JSON.stringify({
              type: "SUBMIT_PICK",
              payload: { pick: { side: hostPicks[r] } },
            })
            await gameRoom.onMessage(hostConn as any, pickMsg)

            // Advance timers to fire scheduleResolve(0) → resolveRound → finishResolving
            vi.advanceTimersByTime(1)

            const state = getStateFromBroadcast(mockRoom)

            // All rounds land on RESULT (no auto-transition to END_GAME)
            expect(state.round.phase).toBe("RESULT")
          }

          // Host sends START_ROUND after the last round to trigger END_GAME
          const endMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(hostConn as any, endMsg)

          // Verify we reached END_GAME
          const stateBeforeReturn = getStateFromBroadcast(mockRoom)
          expect(stateBeforeReturn.round.phase).toBe("END_GAME")

          // At this point, some players likely have non-zero scores and streaks
          // from playing rounds. Now send RETURN_TO_LOBBY from host.
          const returnMsg = JSON.stringify({ type: "RETURN_TO_LOBBY" })
          await gameRoom.onMessage(hostConn as any, returnMsg)

          // Get state after return to lobby
          const stateAfter = getStateFromBroadcast(mockRoom)

          // ASSERT: phase is LOBBY
          expect(stateAfter.round.phase).toBe("LOBBY")

          // ASSERT: game leaderboard is empty (scores reset)
          expect(stateAfter.gameLeaderboard).toEqual([])

          // ASSERT: streak counters are all 0
          const streakStateAfter = getStreakState()
          for (const playerId of Object.keys(streakStateAfter.correctStreaks)) {
            expect(streakStateAfter.correctStreaks[playerId]).toBe(0)
          }
          for (const playerId of Object.keys(streakStateAfter.wrongStreaks)) {
            expect(streakStateAfter.wrongStreaks[playerId]).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
