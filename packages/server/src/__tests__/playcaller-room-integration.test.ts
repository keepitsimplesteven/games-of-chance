/**
 * Integration tests: Playcaller room server integration
 *
 * Tests full lifecycle, host-gated advancement, and player count validation.
 *
 * Validates: Requirements 1.2, 3.3, 3.5, 10.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createTestGameRoom,
  createMockConnection,
  joinPlayer,
  getLastSent,
  getStateFromBroadcast,
} from "./helpers"

// Ensure playcaller plugin is registered (side-effect import)
import "../games/playcaller/PlaycallerPlugin"
import { resetPlaycallerState } from "../games/playcaller/PlaycallerPlugin"

describe("Playcaller room integration", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetPlaycallerState()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetPlaycallerState()
  })

  /**
   * Helper: sets up a playcaller game room with the host switching game type to "playcaller"
   * and joining the specified number of players.
   */
  async function setupPlaycallerRoom(playerCount: number) {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    // Join the host in endless mode (playcaller is finale, unavailable in tournament without prerequisites)
    const conn = createMockConnection("conn-host-1")
    await gameRoom.onConnect(conn as any)
    const joinMsg = JSON.stringify({
      type: "JOIN",
      payload: { name: "Host", role: "host", clientId: "host-1", progressionMode: "endless" },
    })
    await gameRoom.onMessage(joinMsg, conn as any)
    const hostConn = conn

    // Switch game type to playcaller
    const setGameTypeMsg = JSON.stringify({
      type: "SET_GAME_TYPE",
      payload: { gameType: "playcaller" },
    })
    await gameRoom.onMessage(setGameTypeMsg, hostConn as any)

    // Join additional players
    const playerConns = []
    for (let i = 1; i < playerCount; i++) {
      const pConn = await joinPlayer(gameRoom, {
        name: `Player${i}`,
        clientId: `player-${i}`,
      })
      playerConns.push(pConn)
    }

    return { gameRoom, mockRoom, hostConn, playerConns }
  }

  describe("Full lifecycle: lobby → bracket → resolve all rounds → END_GAME", () => {
    it("completes a 4-player tournament through all bracket rounds", async () => {
      const { gameRoom, mockRoom, hostConn } = await setupPlaycallerRoom(4)

      // Verify we're in LOBBY with playcaller game type
      let state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("LOBBY")
      expect(state.room.gameType).toBe("playcaller")

      // For 4 players: totalRounds = ceil(log2(4)) = 2 rounds
      // Round 1: 2 matchups (4 players, 0 byes)
      // Round 2: 1 matchup (final)

      // Start the first round (triggers bracket initialization)
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, hostConn as any)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("PICKING")
      expect(state.playcallerGameState).not.toBeNull()
      expect(state.playcallerGameState.bracket.totalRounds).toBe(2)

      // Advance time past pick window (3000ms) to trigger resolution
      vi.advanceTimersByTime(3100)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")
      // Bracket round 0 should be resolved
      expect(state.playcallerGameState.bracket.rounds[0].resolved).toBe(true)

      // Host advances to the next bracket round
      await gameRoom.onMessage(startMsg, hostConn as any)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("PICKING")
      expect(state.round.roundNumber).toBe(2)

      // Advance time past pick window to resolve the final round
      vi.advanceTimersByTime(3100)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")
      // Final round should be resolved
      expect(state.playcallerGameState.bracket.rounds[1].resolved).toBe(true)

      // After the final round, host advances → should transition to END_GAME
      await gameRoom.onMessage(startMsg, hostConn as any)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("END_GAME")
    })
  })

  describe("Host-gated advancement", () => {
    it("stays in RESULT phase until host sends START_ROUND", async () => {
      const { gameRoom, mockRoom, hostConn } = await setupPlaycallerRoom(4)

      // Start the game
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, hostConn as any)

      let state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("PICKING")

      // Advance past pick window to resolve
      vi.advanceTimersByTime(3100)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")

      // Wait a long time — phase should NOT auto-advance
      vi.advanceTimersByTime(30000)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")

      // Host sends START_ROUND to advance
      await gameRoom.onMessage(startMsg, hostConn as any)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("PICKING")
      expect(state.round.roundNumber).toBe(2)
    })
  })

  describe("Player count validation", () => {
    it("rejects game start with fewer than 2 players and stays in LOBBY", async () => {
      const { gameRoom, mockRoom, hostConn } = await setupPlaycallerRoom(1)

      // Verify we're in LOBBY
      let state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("LOBBY")

      // Remove all bots from the room's internal state so only 1 player (host) remains.
      // This simulates the edge case where the room has < 2 players at game start.
      const internalState = (gameRoom as any).state
      const playerIds = Object.keys(internalState.players)
      for (const id of playerIds) {
        if (id !== "host-1") {
          delete internalState.players[id]
          delete internalState.gameScores[id]
        }
      }

      // Patch the mock room to return the host connection so getHostConnection works
      const connections = [hostConn]
      ;(mockRoom as any).getConnections = () => connections[Symbol.iterator]()

      // Attempt to start the game with only 1 player (the host)
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, hostConn as any)

      // Verify ERROR was sent with INVALID_PLAYER_COUNT
      const lastSent = getLastSent(hostConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("INVALID_PLAYER_COUNT")

      // Verify phase stays in LOBBY
      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("LOBBY")
    })
  })
})
