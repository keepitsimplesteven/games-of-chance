import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"
import { resetCoinTossStreakState } from "../games/coin-toss/CoinTossPlugin"

describe("Integration: Full round lifecycle with streaks", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetCoinTossStreakState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Test 1: Play 3 rounds with streak scoring, verify multipliers applied correctly.
   *
   * Round 1: player picks correctly → basePoints * 1 (streak was 0)
   * Round 2: player picks correctly → basePoints * 2 (streak was 1)
   * Round 3: player picks correctly → basePoints * 3 (streak was 2)
   * Cumulative score = basePoints * (1 + 2 + 3) = basePoints * 6
   *
   * Validates: Requirements 6.5
   */
  it("applies streak multipliers correctly across 3 consecutive correct rounds", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    // Join host (only human player so we can control their picks)
    const hostConn = await joinPlayer(gameRoom, {
      name: "Host",
      clientId: "host-1",
    })

    // Configure 3 rounds
    const settingsMsg = JSON.stringify({
      type: "UPDATE_SETTINGS",
      payload: { changes: { roundCount: 3 } },
    })
    await gameRoom.onMessage(settingsMsg, hostConn as any)

    // Get basePoints from settings
    const settingsState = getStateFromBroadcast(mockRoom)
    const basePoints =
      Number(settingsState.gameSettings?.tuning?.CORRECT_GUESS_CHIPS) || 10

    // We need to ensure the host always guesses correctly.
    // We'll mock Math.random to control the coin flip outcome (HEADS).
    const originalRandom = Math.random
    let coinOutcome: "HEADS" | "TAILS" = "HEADS"

    // Override Math.random so the coin always lands on our desired outcome
    // The coin-toss resolveRound uses: Math.random() < 0.5 ? "HEADS" : "TAILS"
    // So returning 0.1 gives HEADS
    vi.spyOn(Math, "random").mockImplementation(() => 0.1)

    for (let round = 1; round <= 3; round++) {
      // Start the round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, hostConn as any)

      // Verify we're in PICKING
      let state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("PICKING")

      // Host picks HEADS (which will match since we mocked random → HEADS)
      const pickMsg = JSON.stringify({
        type: "SUBMIT_PICK",
        payload: { pick: { side: "HEADS" } },
      })
      await gameRoom.onMessage(pickMsg, hostConn as any)

      // Advance timers to resolve (bot picks + resolution)
      vi.advanceTimersByTime(1)

      state = getStateFromBroadcast(mockRoom)

      if (round < 3) {
        expect(state.round.phase).toBe("RESULT")
      } else {
        // Last round stays in RESULT until host triggers END_GAME
        expect(state.round.phase).toBe("RESULT")

        // Host sends START_ROUND to trigger END_GAME
        const nextMsg = JSON.stringify({ type: "START_ROUND" })
        await gameRoom.onMessage(nextMsg, hostConn as any)
        state = getStateFromBroadcast(mockRoom)
        expect(state.round.phase).toBe("END_GAME")
      }
    }

    // Verify the host's cumulative score
    // The host's player ID is determined by the JOIN message (clientId "host-1")
    const finalState = getStateFromBroadcast(mockRoom)
    const hostEntry = finalState.gameLeaderboard.find(
      (e: any) => e.playerName === "Host"
    )

    // Expected: basePoints * 1 + basePoints * 2 + basePoints * 3 = basePoints * 6
    expect(hostEntry).toBeDefined()
    expect(hostEntry.score).toBe(basePoints * 6)

    // Restore Math.random
    vi.restoreAllMocks()
  })

  /**
   * Test 2: END_GAME → RETURN_TO_LOBBY → LOBBY full flow with score reset.
   *
   * Play through all rounds until END_GAME, then host sends RETURN_TO_LOBBY.
   * Verify state: phase = LOBBY, scores = 0, leaderboard empty.
   *
   * Validates: Requirements 5.6
   */
  it("resets scores and transitions to LOBBY when host sends RETURN_TO_LOBBY from END_GAME", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    // Join host
    const hostConn = await joinPlayer(gameRoom, {
      name: "Host",
      clientId: "host-1",
    })

    // Configure 1 round so we quickly reach END_GAME
    const settingsMsg = JSON.stringify({
      type: "UPDATE_SETTINGS",
      payload: { changes: { roundCount: 1 } },
    })
    await gameRoom.onMessage(settingsMsg, hostConn as any)

    // Mock random to ensure a consistent outcome
    vi.spyOn(Math, "random").mockImplementation(() => 0.1) // HEADS outcome

    // Start the round
    const startMsg = JSON.stringify({ type: "START_ROUND" })
    await gameRoom.onMessage(startMsg, hostConn as any)

    // Host picks HEADS (correct)
    const pickMsg = JSON.stringify({
      type: "SUBMIT_PICK",
      payload: { pick: { side: "HEADS" } },
    })
    await gameRoom.onMessage(pickMsg, hostConn as any)

    // Resolve
    vi.advanceTimersByTime(1)

    // Last round stays in RESULT — host must trigger END_GAME
    let state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("RESULT")

    // Host sends START_ROUND to trigger END_GAME transition
    const nextMsg = JSON.stringify({ type: "START_ROUND" })
    await gameRoom.onMessage(nextMsg, hostConn as any)

    // Verify we're in END_GAME with non-zero scores
    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("END_GAME")
    expect(state.gameLeaderboard.length).toBeGreaterThan(0)

    // Verify host has scored something
    const hostEntry = state.gameLeaderboard.find(
      (e: any) => e.playerName === "Host"
    )
    expect(hostEntry).toBeDefined()
    expect(hostEntry.score).toBeGreaterThan(0)

    // Host sends RETURN_TO_LOBBY
    const returnMsg = JSON.stringify({ type: "RETURN_TO_LOBBY" })
    await gameRoom.onMessage(returnMsg, hostConn as any)

    // Verify state after return to lobby
    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("LOBBY")
    expect(state.gameLeaderboard).toEqual([])

    // All game scores should be 0
    if (state.gameScores) {
      for (const score of Object.values(state.gameScores)) {
        expect(score).toBe(0)
      }
    }

    vi.restoreAllMocks()
  })

  /**
   * Test 3: Streak broadcast — resolve a round and verify gameLeaderboard entries
   * include streak, coldStreak, and lastMultiplier fields.
   *
   * Validates: Requirements 7.7
   */
  it("includes streak, coldStreak, and lastMultiplier in broadcast leaderboard entries after resolution", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    // Join host
    const hostConn = await joinPlayer(gameRoom, {
      name: "Host",
      clientId: "host-1",
    })

    // Configure 3 rounds
    const settingsMsg = JSON.stringify({
      type: "UPDATE_SETTINGS",
      payload: { changes: { roundCount: 3 } },
    })
    await gameRoom.onMessage(settingsMsg, hostConn as any)

    // Mock random: HEADS outcome
    vi.spyOn(Math, "random").mockImplementation(() => 0.1)

    // Start round 1
    const startMsg = JSON.stringify({ type: "START_ROUND" })
    await gameRoom.onMessage(startMsg, hostConn as any)

    // Host picks HEADS (correct)
    const pickMsg = JSON.stringify({
      type: "SUBMIT_PICK",
      payload: { pick: { side: "HEADS" } },
    })
    await gameRoom.onMessage(pickMsg, hostConn as any)

    // Resolve
    vi.advanceTimersByTime(1)

    // Get the broadcast state after resolution
    const state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("RESULT")
    expect(state.gameLeaderboard.length).toBeGreaterThan(0)

    // Verify each leaderboard entry has streak data fields
    for (const entry of state.gameLeaderboard) {
      expect(entry).toHaveProperty("streak")
      expect(entry).toHaveProperty("coldStreak")
      expect(entry).toHaveProperty("lastMultiplier")

      // Types should be numbers
      expect(typeof entry.streak).toBe("number")
      expect(typeof entry.coldStreak).toBe("number")
      expect(typeof entry.lastMultiplier).toBe("number")
    }

    // Specifically check the host entry — they guessed correctly so:
    // streak should be 1 (first correct), coldStreak should be 0, lastMultiplier should be 1
    const hostEntry = state.gameLeaderboard.find(
      (e: any) => e.playerName === "Host"
    )
    expect(hostEntry).toBeDefined()
    expect(hostEntry.streak).toBe(1) // After first correct guess, streak increments to 1
    expect(hostEntry.coldStreak).toBe(0)
    expect(hostEntry.lastMultiplier).toBe(1) // Streak was 0 before → 1x multiplier

    vi.restoreAllMocks()
  })
})
