/**
 * Feature: game-settings, Property 10: Settings broadcast on every change
 *
 * For any valid settings update accepted by the server, a STATE_SYNC message
 * containing the updated Game_Settings should be broadcast to all connected clients.
 *
 * Validates: Requirements 10.1, 10.3
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"
import type { GameSettings } from "@games-of-chance/shared"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generates valid roundCount values within [1, 50] */
const validRoundCountArb = fc.integer({ min: 1, max: 50 })

/** Generates valid pickWindowMs values within [3000, 60000] */
const validPickWindowMsArb = fc.integer({ min: 3000, max: 60000 })

/** Generates a valid tuning value for CORRECT_GUESS_CHIPS: integer in [1, 100] */
const validCorrectGuessChipsArb = fc.integer({ min: 1, max: 100 })

/** Generates a valid tuning value for STREAK_MULTIPLIER: step 0.5 in [1, 10] */
const validStreakMultiplierArb = fc
  .integer({ min: 2, max: 20 })
  .map((n) => n * 0.5) // produces 1, 1.5, 2, ... 10

/** Generates a valid tuning value for STREAK_THRESHOLD: integer in [2, 10] */
const validStreakThresholdArb = fc.integer({ min: 2, max: 10 })

/**
 * Generates a random valid partial settings update.
 * At least one field will always be present to ensure a meaningful update.
 */
const validSettingsChangeArb = fc
  .record({
    roundCount: fc.option(validRoundCountArb, { nil: undefined }),
    pickWindowMs: fc.option(validPickWindowMsArb, { nil: undefined }),
    tuningChips: fc.option(validCorrectGuessChipsArb, { nil: undefined }),
    tuningMultiplier: fc.option(validStreakMultiplierArb, { nil: undefined }),
    tuningThreshold: fc.option(validStreakThresholdArb, { nil: undefined }),
  })
  .filter(
    (rec) =>
      rec.roundCount !== undefined ||
      rec.pickWindowMs !== undefined ||
      rec.tuningChips !== undefined ||
      rec.tuningMultiplier !== undefined ||
      rec.tuningThreshold !== undefined
  )
  .map((rec) => {
    const changes: Partial<GameSettings> = {}
    if (rec.roundCount !== undefined) changes.roundCount = rec.roundCount
    if (rec.pickWindowMs !== undefined) changes.pickWindowMs = rec.pickWindowMs

    const tuning: Record<string, number | boolean | string> = {}
    if (rec.tuningChips !== undefined) tuning.CORRECT_GUESS_CHIPS = rec.tuningChips
    if (rec.tuningMultiplier !== undefined) tuning.STREAK_MULTIPLIER = rec.tuningMultiplier
    if (rec.tuningThreshold !== undefined) tuning.STREAK_THRESHOLD = rec.tuningThreshold

    if (Object.keys(tuning).length > 0) changes.tuning = tuning

    return changes
  })

// ── Property 10: Settings broadcast on every change ────────────────────────

describe("Feature: game-settings, Property 10: Settings broadcast on every change", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 10: Settings broadcast on every change
   *
   * For any valid settings update accepted by the server, a STATE_SYNC message
   * containing the updated Game_Settings should be broadcast to all connected clients.
   *
   * **Validates: Requirements 10.1, 10.3**
   */
  it("a STATE_SYNC broadcast is emitted with updated gameSettings for any valid settings update", async () => {
    await fc.assert(
      fc.asyncProperty(validSettingsChangeArb, async (changes) => {
        const { gameRoom, mockRoom } = await createTestGameRoom()

        // Join host + a second player so there are multiple clients
        const hostConn = await joinPlayer(gameRoom, {
          name: "Host",
          clientId: "host-1",
        })
        await joinPlayer(gameRoom, {
          name: "Player2",
          clientId: "player-2",
        })

        // Record broadcast count before the update
        const broadcastCountBefore = mockRoom._broadcasts.length

        // Send UPDATE_SETTINGS from host with valid changes
        const msg = JSON.stringify({
          type: "UPDATE_SETTINGS",
          payload: { changes },
        })
        await gameRoom.onMessage(hostConn as any, msg)

        // Verify a new broadcast was emitted
        expect(mockRoom._broadcasts.length).toBeGreaterThan(broadcastCountBefore)

        // Parse the latest broadcast
        const lastBroadcastRaw = mockRoom._broadcasts[mockRoom._broadcasts.length - 1]
        const lastBroadcast = JSON.parse(lastBroadcastRaw)

        // Verify it's a STATE_SYNC message
        expect(lastBroadcast.type).toBe("STATE_SYNC")

        // Verify the broadcast contains gameSettings
        const broadcastState = lastBroadcast.payload
        expect(broadcastState).toHaveProperty("gameSettings")

        // Verify the broadcast gameSettings reflect the applied changes
        if (changes.roundCount !== undefined) {
          expect(broadcastState.gameSettings.roundCount).toBe(changes.roundCount)
        }
        if (changes.pickWindowMs !== undefined) {
          expect(broadcastState.gameSettings.pickWindowMs).toBe(changes.pickWindowMs)
        }
        if (changes.tuning) {
          for (const [key, value] of Object.entries(changes.tuning)) {
            expect(broadcastState.gameSettings.tuning[key]).toBe(value)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it("broadcast count increases by exactly 1 per valid settings update", async () => {
    await fc.assert(
      fc.asyncProperty(
        validRoundCountArb,
        validPickWindowMsArb,
        async (roundCount, pickWindowMs) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host + player
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Record broadcast count before the update
          const broadcastCountBefore = mockRoom._broadcasts.length

          // Send a valid settings update
          const msg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { roundCount, pickWindowMs } },
          })
          await gameRoom.onMessage(hostConn as any, msg)

          // Exactly 1 new broadcast should have been emitted
          expect(mockRoom._broadcasts.length).toBe(broadcastCountBefore + 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("new player joining after settings change receives updated gameSettings in STATE_SYNC", async () => {
    await fc.assert(
      fc.asyncProperty(validSettingsChangeArb, async (changes) => {
        const { gameRoom, mockRoom } = await createTestGameRoom()

        // Join host
        const hostConn = await joinPlayer(gameRoom, {
          name: "Host",
          clientId: "host-1",
        })

        // Host updates settings
        const msg = JSON.stringify({
          type: "UPDATE_SETTINGS",
          payload: { changes },
        })
        await gameRoom.onMessage(hostConn as any, msg)

        // A new player joins after the settings change
        const newPlayerConn = await joinPlayer(gameRoom, {
          name: "NewPlayer",
          clientId: "new-player-1",
        })

        // The latest broadcast (triggered by new player join) should contain the updated settings
        const state = getStateFromBroadcast(mockRoom)
        expect(state).toHaveProperty("gameSettings")

        if (changes.roundCount !== undefined) {
          expect(state.gameSettings.roundCount).toBe(changes.roundCount)
        }
        if (changes.pickWindowMs !== undefined) {
          expect(state.gameSettings.pickWindowMs).toBe(changes.pickWindowMs)
        }
        if (changes.tuning) {
          for (const [key, value] of Object.entries(changes.tuning)) {
            expect(state.gameSettings.tuning[key]).toBe(value)
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})
