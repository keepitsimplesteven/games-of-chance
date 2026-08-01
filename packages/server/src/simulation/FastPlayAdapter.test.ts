import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Side-effect imports: register pick generator and game plugin
import "@games-of-chance/simulation/src/pick-generators/coin-toss"
import "../games/coin-toss/CoinTossPlugin"

import { FastPlayAdapter } from "./FastPlayAdapter"

function createMockRoom() {
  return {
    id: "test-room",
    broadcast: vi.fn(),
    // Minimal Party.Room stub — only the fields FastPlayAdapter uses
    internalId: "test-internal",
    env: {},
    storage: {},
    context: {},
    parties: {},
  } as any
}

describe("FastPlayAdapter", () => {
  describe("STATE_SYNC broadcasts occur with correct shape and simulation marker", () => {
    it("broadcasts STATE_SYNC with simulation: true and incrementing round numbers", async () => {
      const room = createMockRoom()
      const adapter = new FastPlayAdapter(room, 0)

      await adapter.run("coin-toss", 4, 3, 42)

      // Should have multiple broadcasts: 3 round broadcasts + 1 final RESULT broadcast = 4
      expect(room.broadcast).toHaveBeenCalledTimes(4)

      const calls = room.broadcast.mock.calls.map((call: any[]) =>
        JSON.parse(call[0] as string)
      )

      // All messages should have type STATE_SYNC
      for (const msg of calls) {
        expect(msg.type).toBe("STATE_SYNC")
        expect(msg.payload.simulation).toBe(true)
        expect(msg.payload.players).toHaveLength(4)
        expect(msg.payload.gameLeaderboard).toBeDefined()
        expect(Array.isArray(msg.payload.gameLeaderboard)).toBe(true)
      }

      // Verify round numbers increment (first 3 are round broadcasts)
      expect(calls[0].payload.round.roundNumber).toBe(1)
      expect(calls[1].payload.round.roundNumber).toBe(2)
      expect(calls[2].payload.round.roundNumber).toBe(3)

      // The last broadcast should have phase "RESULT"
      const lastMsg = calls[calls.length - 1]
      expect(lastMsg.payload.round.phase).toBe("RESULT")
    })
  })

  describe("Abort stops execution and preserves partial state", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("stops simulation mid-run and has fewer broadcasts than a full run", async () => {
      const room = createMockRoom()
      const adapter = new FastPlayAdapter(room, 100)

      // Start the simulation but don't await — it will hang after abort
      adapter.run("coin-toss", 4, 10, 42)

      // First round fires immediately (synchronous part before first delay)
      await vi.advanceTimersByTimeAsync(0)
      const afterFirst = room.broadcast.mock.calls.length
      expect(afterFirst).toBeGreaterThanOrEqual(1)

      // Advance one interval to let another round fire
      await vi.advanceTimersByTimeAsync(100)
      const afterSecond = room.broadcast.mock.calls.length
      expect(afterSecond).toBeGreaterThan(afterFirst)

      // Abort mid-simulation
      adapter.abort()

      // Try advancing more time — no additional broadcasts should fire
      await vi.advanceTimersByTimeAsync(1000)
      const afterAbort = room.broadcast.mock.calls.length
      expect(afterAbort).toBe(afterSecond)

      // Should have fewer broadcasts than a full run (10 rounds + 1 final = 11)
      expect(afterAbort).toBeLessThan(11)

      // The partial broadcasts that DID fire should have valid structure
      const calls = room.broadcast.mock.calls.map((call: any[]) =>
        JSON.parse(call[0] as string)
      )

      for (const msg of calls) {
        expect(msg.type).toBe("STATE_SYNC")
        expect(msg.payload.simulation).toBe(true)
        expect(msg.payload.players).toHaveLength(4)
        expect(msg.payload.round.roundNumber).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe("Round interval timing behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("delays between rounds by the configured interval", async () => {
      const room = createMockRoom()
      const adapter = new FastPlayAdapter(room, 500)

      const runPromise = adapter.run("coin-toss", 4, 3, 42)

      // After starting, the first round broadcasts immediately (no delay before first round)
      await vi.advanceTimersByTimeAsync(0)
      expect(room.broadcast).toHaveBeenCalledTimes(1)

      // Advance 500ms — second round should fire
      await vi.advanceTimersByTimeAsync(500)
      expect(room.broadcast).toHaveBeenCalledTimes(2)

      // Advance another 500ms — third round + final broadcast
      await vi.advanceTimersByTimeAsync(500)
      expect(room.broadcast).toHaveBeenCalledTimes(4) // round 3 + final RESULT

      await runPromise
    })
  })
})
