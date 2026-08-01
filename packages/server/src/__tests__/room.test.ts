import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createTestGameRoom,
  joinPlayer,
  createMockConnection,
  getLastBroadcast,
  getLastSent,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("GameRoom", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Host assignment", () => {
    it("first player gets host role", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })

      const state = getStateFromBroadcast(mockRoom)
      const alice = state.players.find((p: any) => p.id === "alice-1")
      expect(alice.role).toBe("host")
    })

    it("second player gets player role", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      const state = getStateFromBroadcast(mockRoom)
      const bob = state.players.find((p: any) => p.id === "bob-1")
      expect(bob.role).toBe("player")
    })
  })

  describe("Host promotion on disconnect", () => {
    it("promotes next connected player to host when host disconnects", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Alice (host) disconnects
      await gameRoom.onClose(aliceConn as any)

      const state = getStateFromBroadcast(mockRoom)
      const bob = state.players.find((p: any) => p.id === "bob-1")
      expect(bob.role).toBe("host")
      // Alice is removed from the roster (replaced by a bot)
      const alice = state.players.find((p: any) => p.id === "alice-1")
      expect(alice).toBeUndefined()
    })
  })

  describe("START_ROUND rejects non-host", () => {
    it("returns NOT_HOST error when non-host tries to start", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      const bobConn = await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Bob (player) tries to start a round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, bobConn as any)

      const lastSent = getLastSent(bobConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("NOT_HOST")

      // State unchanged — still in LOBBY
      const state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("LOBBY")
    })
  })

  describe("START_ROUND rejects wrong phase", () => {
    it("returns WRONG_PHASE during PICKING", async () => {
      const { gameRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Start a round (transitions to PICKING)
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      // Try to start another round while in PICKING
      await gameRoom.onMessage(startMsg, aliceConn as any)

      const lastSent = getLastSent(aliceConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("WRONG_PHASE")
    })
  })

  describe("SUBMIT_PICK guards", () => {
    it("returns WRONG_PHASE when not in PICKING", async () => {
      const { gameRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })

      // Submit pick while in LOBBY
      const pickMsg = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "HEADS" } } })
      await gameRoom.onMessage(pickMsg, aliceConn as any)

      const lastSent = getLastSent(aliceConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("WRONG_PHASE")
    })

    it("returns INVALID_PICK for invalid pick data", async () => {
      const { gameRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Start round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      // Submit an invalid pick
      const pickMsg = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "BANANA" } } })
      await gameRoom.onMessage(pickMsg, aliceConn as any)

      const lastSent = getLastSent(aliceConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("INVALID_PICK")
    })
  })

  describe("Pick immutability", () => {
    it("second pick from same player is silently ignored", async () => {
      const { gameRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Start round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      // First pick
      const pick1 = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "HEADS" } } })
      await gameRoom.onMessage(pick1, aliceConn as any)

      // Clear sent messages to track second pick
      const sentBefore = aliceConn._sent.length

      // Second pick — should be silently ignored (no error, no ack)
      const pick2 = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "TAILS" } } })
      await gameRoom.onMessage(pick2, aliceConn as any)

      // No new messages sent to Alice
      expect(aliceConn._sent.length).toBe(sentBefore)
    })
  })

  describe("resolveRound idempotency (double-fire guard)", () => {
    it("calling resolveRound when not in PICKING is a no-op", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      const bobConn = await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Start round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      // Both players pick
      const pickHeads = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "HEADS" } } })
      const pickTails = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "TAILS" } } })
      await gameRoom.onMessage(pickHeads, aliceConn as any)
      await gameRoom.onMessage(pickTails, bobConn as any)

      // Run all pending timers (bot picks + resolve)
      vi.runAllTimers()

      // Now the round should be resolved (RESULT phase)
      const state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")

      // Record broadcast count after resolution
      const broadcastCountAfterResolve = mockRoom._broadcasts.length

      // Advance timers well past the pick deadline (simulates double-fire scenario)
      vi.advanceTimersByTime(15_000)

      // No additional broadcasts should have been sent — idempotency guard
      expect(mockRoom._broadcasts.length).toBe(broadcastCountAfterResolve)
    })
  })

  describe("All picks in triggers early resolve", () => {
    it("resolves immediately when all connected players have picked", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      const bobConn = await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Start round
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      // Both humans pick
      const pickHeads = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "HEADS" } } })
      await gameRoom.onMessage(pickHeads, aliceConn as any)
      await gameRoom.onMessage(pickHeads, bobConn as any)

      // Run all pending timers (bot picks + resolve)
      vi.runAllTimers()

      // Should now be in RESULT phase
      const state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")
    })
  })

  describe("END_GAME rejects non-host", () => {
    it("returns NOT_HOST error when non-host tries to end", async () => {
      const { gameRoom } = await createTestGameRoom()

      await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      const bobConn = await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Bob tries to end game
      const endMsg = JSON.stringify({ type: "END_GAME" })
      await gameRoom.onMessage(endMsg, bobConn as any)

      const lastSent = getLastSent(bobConn)
      expect(lastSent.type).toBe("ERROR")
      expect(lastSent.payload.code).toBe("NOT_HOST")
    })
  })

  describe("END_GAME resets state", () => {
    it("transitions to LOBBY and resets game scores and leaderboard", async () => {
      const { gameRoom, mockRoom } = await createTestGameRoom()

      const aliceConn = await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-1" })
      const bobConn = await joinPlayer(gameRoom, { name: "Bob", clientId: "bob-1" })

      // Play a round to accumulate scores
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, aliceConn as any)

      const pickHeads = JSON.stringify({ type: "SUBMIT_PICK", payload: { pick: { side: "HEADS" } } })
      await gameRoom.onMessage(pickHeads, aliceConn as any)
      await gameRoom.onMessage(pickHeads, bobConn as any)

      // Run all pending timers (bot picks + resolve)
      vi.runAllTimers()

      // Verify we're in RESULT
      let state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("RESULT")

      // End game
      const endMsg = JSON.stringify({ type: "END_GAME" })
      await gameRoom.onMessage(endMsg, aliceConn as any)

      state = getStateFromBroadcast(mockRoom)
      expect(state.round.phase).toBe("LOBBY")
      expect(state.round.roundNumber).toBe(0)
      expect(state.gameLeaderboard).toEqual([])
    })
  })
})
