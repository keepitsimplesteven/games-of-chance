/**
 * Feature: game-settings, Property 1: Settings update stores valid values
 * Feature: game-settings, Property 2: Range validation rejects out-of-bounds values
 * Feature: game-settings, Property 3: Configured pick window is used at runtime
 * Feature: game-settings, Property 5: Settings locked during active game
 * Feature: game-settings, Property 7: Non-host settings rejection
 *
 * Validates: Requirements 2.2, 2.3, 3.2, 3.3, 3.5, 5.4, 7.1, 7.3, 8.2
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import { validateSettingsUpdate } from "../settings/validateSettings"
import {
  createTestGameRoom,
  joinPlayer,
  getLastSent,
  getStateFromBroadcast,
} from "./helpers"
import type { GameSettings, SettingsSchema } from "@games-of-chance/shared"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

// ── Test Schema ────────────────────────────────────────────────────────────

const testSchema: SettingsSchema = [
  {
    key: "CORRECT_GUESS_CHIPS",
    label: "Points per correct guess",
    type: "number",
    defaultValue: 5,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "STREAK_MULTIPLIER",
    label: "Streak multiplier",
    type: "number",
    defaultValue: 2,
    constraints: { min: 1, max: 10, step: 0.5 },
  },
  {
    key: "STREAK_THRESHOLD",
    label: "Streak threshold",
    type: "number",
    defaultValue: 3,
    constraints: { min: 2, max: 10, step: 1 },
  },
]

const baseSettings: GameSettings = {
  roundCount: 10,
  pickWindowMs: 15000,
  tuning: {
    CORRECT_GUESS_CHIPS: 5,
    STREAK_MULTIPLIER: 2,
    STREAK_THRESHOLD: 3,
  },
}

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

/** Generates out-of-range roundCount (below min or above max) */
const outOfRangeRoundCountArb = fc.oneof(
  fc.integer({ min: -1000, max: 0 }),
  fc.integer({ min: 51, max: 1000 })
)

/** Generates out-of-range pickWindowMs (below min or above max) */
const outOfRangePickWindowMsArb = fc.oneof(
  fc.integer({ min: -10000, max: 2999 }),
  fc.integer({ min: 60001, max: 200000 })
)

/** Generates out-of-range tuning values for CORRECT_GUESS_CHIPS */
const outOfRangeChipsArb = fc.oneof(
  fc.integer({ min: -100, max: 0 }),
  fc.integer({ min: 101, max: 500 })
)

/** Generates out-of-range tuning values for STREAK_THRESHOLD */
const outOfRangeThresholdArb = fc.oneof(
  fc.integer({ min: -100, max: 1 }),
  fc.integer({ min: 11, max: 500 })
)

/** Generates active game phases (not LOBBY) */
const activePhaseArb = fc.constantFrom(
  "PICKING" as const,
  "RESOLVING" as const,
  "RESULT" as const
)

/** Generates an arbitrary partial settings change payload */
const settingsChangeArb = fc.record({
  roundCount: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
  pickWindowMs: fc.option(fc.integer({ min: 3000, max: 60000 }), { nil: undefined }),
}).map((rec) => {
  const changes: Partial<GameSettings> = {}
  if (rec.roundCount !== undefined) changes.roundCount = rec.roundCount
  if (rec.pickWindowMs !== undefined) changes.pickWindowMs = rec.pickWindowMs
  return changes
})

// ── Property 1: Settings update stores valid values ────────────────────────

describe("Feature: game-settings, Property 1: Settings update stores valid values", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 1: Settings update stores valid values
   *
   * For any valid settings field and for any value within that field's defined
   * constraints, sending an UPDATE_SETTINGS message from the host during LOBBY
   * phase should result in Game_Settings reflecting the new value.
   *
   * **Validates: Requirements 2.2, 3.2**
   */
  it("valid roundCount values are accepted and stored by validateSettingsUpdate", () => {
    fc.assert(
      fc.property(validRoundCountArb, (roundCount) => {
        const result = validateSettingsUpdate(
          { roundCount },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(true)
        if (result.valid) {
          expect(result.sanitized.roundCount).toBe(roundCount)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("valid pickWindowMs values are accepted and stored by validateSettingsUpdate", () => {
    fc.assert(
      fc.property(validPickWindowMsArb, (pickWindowMs) => {
        const result = validateSettingsUpdate(
          { pickWindowMs },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(true)
        if (result.valid) {
          expect(result.sanitized.pickWindowMs).toBe(pickWindowMs)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("valid tuning values are accepted and stored by validateSettingsUpdate", () => {
    fc.assert(
      fc.property(
        validCorrectGuessChipsArb,
        validStreakMultiplierArb,
        validStreakThresholdArb,
        (chips, multiplier, threshold) => {
          const result = validateSettingsUpdate(
            {
              tuning: {
                CORRECT_GUESS_CHIPS: chips,
                STREAK_MULTIPLIER: multiplier,
                STREAK_THRESHOLD: threshold,
              },
            },
            baseSettings,
            testSchema
          )
          expect(result.valid).toBe(true)
          if (result.valid) {
            expect(result.sanitized.tuning?.CORRECT_GUESS_CHIPS).toBe(chips)
            expect(result.sanitized.tuning?.STREAK_MULTIPLIER).toBe(multiplier)
            expect(result.sanitized.tuning?.STREAK_THRESHOLD).toBe(threshold)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("host can update valid settings in LOBBY phase via handleUpdateSettings", async () => {
    await fc.assert(
      fc.asyncProperty(
        validRoundCountArb,
        validPickWindowMsArb,
        async (roundCount, pickWindowMs) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Send UPDATE_SETTINGS with valid values
          const msg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { roundCount, pickWindowMs } },
          })
          await gameRoom.onMessage(msg, hostConn as any)

          // Verify the state was updated
          const state = getStateFromBroadcast(mockRoom)
          expect(state.gameSettings.roundCount).toBe(roundCount)
          expect(state.gameSettings.pickWindowMs).toBe(pickWindowMs)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 2: Range validation rejects out-of-bounds values ──────────────

describe("Feature: game-settings, Property 2: Range validation rejects out-of-bounds values", () => {
  /**
   * Property 2: Range validation rejects out-of-bounds values
   *
   * For any numeric settings field (roundCount, pickWindowMs, or tuning constant)
   * and for any value outside the field's [min, max] constraints, the server should
   * reject the update, never storing an out-of-range value in Game_Settings.
   *
   * **Validates: Requirements 2.3, 3.3, 5.4**
   */
  it("out-of-range roundCount values are rejected", () => {
    fc.assert(
      fc.property(outOfRangeRoundCountArb, (roundCount) => {
        const result = validateSettingsUpdate(
          { roundCount },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("out-of-range pickWindowMs values are rejected", () => {
    fc.assert(
      fc.property(outOfRangePickWindowMsArb, (pickWindowMs) => {
        const result = validateSettingsUpdate(
          { pickWindowMs },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("out-of-range tuning CORRECT_GUESS_CHIPS values are rejected", () => {
    fc.assert(
      fc.property(outOfRangeChipsArb, (chips) => {
        const result = validateSettingsUpdate(
          { tuning: { CORRECT_GUESS_CHIPS: chips } },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("out-of-range tuning STREAK_THRESHOLD values are rejected", () => {
    fc.assert(
      fc.property(outOfRangeThresholdArb, (threshold) => {
        const result = validateSettingsUpdate(
          { tuning: { STREAK_THRESHOLD: threshold } },
          baseSettings,
          testSchema
        )
        expect(result.valid).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("non-integer roundCount values (floats) are rejected", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.01, max: 49.99, noNaN: true }).filter(
          (v) => !Number.isInteger(v)
        ),
        (roundCount) => {
          const result = validateSettingsUpdate(
            { roundCount },
            baseSettings,
            testSchema
          )
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("non-integer pickWindowMs values (floats) are rejected", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3000.01, max: 59999.99, noNaN: true }).filter(
          (v) => !Number.isInteger(v)
        ),
        (pickWindowMs) => {
          const result = validateSettingsUpdate(
            { pickWindowMs },
            baseSettings,
            testSchema
          )
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 5: Settings locked during active game ─────────────────────────

describe("Feature: game-settings, Property 5: Settings locked during active game", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 5: Settings locked during active game
   *
   * For any room in an active phase (PICKING, RESOLVING, or RESULT) and for any
   * UPDATE_SETTINGS message, the server should reject the message with error code
   * "SETTINGS_LOCKED" and leave Game_Settings unchanged.
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  it("UPDATE_SETTINGS is rejected with SETTINGS_LOCKED during any active phase", async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsChangeArb,
        async (changes) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host and a second player
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Start a round to enter PICKING phase (which locks settings)
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Capture settings state BEFORE the update attempt
          const stateBefore = getStateFromBroadcast(mockRoom)
          const settingsBefore = stateBefore.gameSettings

          // Attempt to update settings while game is active
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes },
          })
          await gameRoom.onMessage(updateMsg, hostConn as any)

          // Verify rejection with SETTINGS_LOCKED error
          const lastSent = getLastSent(hostConn)
          expect(lastSent).not.toBeNull()
          expect(lastSent.type).toBe("ERROR")
          expect(lastSent.payload.code).toBe("SETTINGS_LOCKED")

          // Verify settings are unchanged
          const stateAfter = getStateFromBroadcast(mockRoom)
          expect(stateAfter.gameSettings).toEqual(settingsBefore)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 7: Non-host settings rejection ────────────────────────────────

describe("Feature: game-settings, Property 7: Non-host settings rejection", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 7: Non-host settings rejection
   *
   * For any UPDATE_SETTINGS message sent by a connection whose player role is
   * "player" (non-host), the server should reject it with error code "NOT_HOST"
   * regardless of room phase or payload content.
   *
   * **Validates: Requirements 8.2**
   */
  it("non-host players are always rejected with NOT_HOST regardless of payload", async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsChangeArb,
        fc.string({ minLength: 1, maxLength: 10 }),
        async (changes, playerName) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host first
          await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Join a non-host player
          const nonHostConn = await joinPlayer(gameRoom, {
            name: playerName,
            clientId: "non-host-1",
          })

          // Capture state before unauthorized attempt
          const stateBefore = getStateFromBroadcast(mockRoom)
          const broadcastCountBefore = mockRoom._broadcasts.length

          // Non-host attempts to update settings
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes },
          })
          await gameRoom.onMessage(updateMsg, nonHostConn as any)

          // Verify rejection with NOT_HOST error
          const lastSent = getLastSent(nonHostConn)
          expect(lastSent).not.toBeNull()
          expect(lastSent.type).toBe("ERROR")
          expect(lastSent.payload.code).toBe("NOT_HOST")

          // Verify no state broadcast occurred (state unchanged)
          expect(mockRoom._broadcasts.length).toBe(broadcastCountBefore)

          // Verify room state is identical
          const stateAfter = getStateFromBroadcast(mockRoom)
          expect(stateAfter).toEqual(stateBefore)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 3: Configured pick window is used at runtime ──────────────────

describe("Feature: game-settings, Property 3: Configured pick window is used at runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 3: Configured pick window is used at runtime
   *
   * For any configured pickWindowMs value within [3000, 60000], when a round
   * starts, the server should set pickDeadlineMs = now() + gameSettings.pickWindowMs
   * — never using the hardcoded plugin constant.
   *
   * **Validates: Requirements 3.5**
   */
  it("beginRound sets deadline to now + configured pickWindowMs for any valid value", async () => {
    await fc.assert(
      fc.asyncProperty(
        validPickWindowMsArb,
        fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }),
        async (pickWindowMs, currentTime) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host + player (need at least 2 players to start a round)
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Configure the pickWindowMs via UPDATE_SETTINGS
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { pickWindowMs } },
          })
          await gameRoom.onMessage(updateMsg, hostConn as any)

          // Set a known time before starting the round
          vi.setSystemTime(currentTime)

          // Start the round
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Verify the broadcast state has pickDeadlineMs === currentTime + pickWindowMs
          const state = getStateFromBroadcast(mockRoom)
          expect(state.round.pickDeadlineMs).toBe(currentTime + pickWindowMs)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 8: Settings persist across game sessions ──────────────────────

describe("Feature: game-settings, Property 8: Settings persist across game sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 8: Settings persist across game sessions
   *
   * For any valid GameSettings configuration, after a game ends (END_GAME → LOBBY)
   * and a new round is started without settings changes, the server should apply the
   * previously configured GameSettings values (roundCount, pickWindowMs, tuning) to
   * the new game.
   *
   * **Validates: Requirements 9.1, 9.2**
   */
  it("settings persist after END_GAME → START_ROUND without changes", async () => {
    await fc.assert(
      fc.asyncProperty(
        validRoundCountArb,
        validPickWindowMsArb,
        validCorrectGuessChipsArb,
        async (roundCount, pickWindowMs, chips) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host and a second player (needed for pick submission)
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          const playerConn = await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Configure settings to arbitrary valid values via UPDATE_SETTINGS
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: {
              changes: {
                roundCount,
                pickWindowMs,
                tuning: { CORRECT_GUESS_CHIPS: chips },
              },
            },
          })
          await gameRoom.onMessage(updateMsg, hostConn as any)

          // Capture the settings that were set
          const stateAfterUpdate = getStateFromBroadcast(mockRoom)
          const configuredSettings: GameSettings = stateAfterUpdate.gameSettings

          // Start a round (enters PICKING phase, locks settings)
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Advance time past pick window to trigger resolution → RESULT phase
          vi.advanceTimersByTime(pickWindowMs + 100)

          // End the game (returns to LOBBY, unlocks settings)
          // With the new behavior: last round stays in RESULT, host must send START_ROUND
          // to trigger END_GAME, then RETURN_TO_LOBBY to get back to LOBBY.
          // For roundCount > 1 (not at last round), just send END_GAME directly.
          const stateAfterResolve = getStateFromBroadcast(mockRoom)
          if (stateAfterResolve.round.phase === "END_GAME") {
            const returnMsg = JSON.stringify({ type: "RETURN_TO_LOBBY" })
            await gameRoom.onMessage(returnMsg, hostConn as any)
          } else if (stateAfterResolve.round.phase === "RESULT") {
            // Check if this is the last round — if so, START_ROUND triggers END_GAME
            const maxRounds = stateAfterResolve.gameSettings.roundCount
            if (maxRounds > 0 && stateAfterResolve.round.roundNumber >= maxRounds) {
              // Trigger END_GAME via START_ROUND
              const nextMsg = JSON.stringify({ type: "START_ROUND" })
              await gameRoom.onMessage(nextMsg, hostConn as any)
              // Then return to lobby
              const returnMsg = JSON.stringify({ type: "RETURN_TO_LOBBY" })
              await gameRoom.onMessage(returnMsg, hostConn as any)
            } else {
              const endMsg = JSON.stringify({ type: "END_GAME" })
              await gameRoom.onMessage(endMsg, hostConn as any)
            }
          }

          // Verify we're back in LOBBY
          const stateAfterEnd = getStateFromBroadcast(mockRoom)
          expect(stateAfterEnd.round.phase).toBe("LOBBY")
          expect(stateAfterEnd.settingsLocked).toBe(false)

          // Verify settings are still the same after END_GAME (persisted)
          expect(stateAfterEnd.gameSettings.roundCount).toBe(configuredSettings.roundCount)
          expect(stateAfterEnd.gameSettings.pickWindowMs).toBe(configuredSettings.pickWindowMs)
          expect(stateAfterEnd.gameSettings.tuning.CORRECT_GUESS_CHIPS).toBe(
            configuredSettings.tuning.CORRECT_GUESS_CHIPS
          )

          // Start a new round — verify the same settings are applied
          await gameRoom.onMessage(startMsg, hostConn as any)

          const stateNewRound = getStateFromBroadcast(mockRoom)
          expect(stateNewRound.round.phase).toBe("PICKING")
          expect(stateNewRound.gameSettings.roundCount).toBe(configuredSettings.roundCount)
          expect(stateNewRound.gameSettings.pickWindowMs).toBe(configuredSettings.pickWindowMs)
          expect(stateNewRound.gameSettings.tuning.CORRECT_GUESS_CHIPS).toBe(
            configuredSettings.tuning.CORRECT_GUESS_CHIPS
          )

          // Verify the pickDeadlineMs uses the configured pickWindowMs
          const expectedDeadline = Date.now() + configuredSettings.pickWindowMs
          // The deadline was set at the time of beginRound - verify it's roughly correct
          // (Date.now() inside fake timers is deterministic)
          expect(stateNewRound.round.pickDeadlineMs).toBe(expectedDeadline)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 6: Settings unlocked after game end ───────────────────────────

describe("Feature: game-settings, Property 6: Settings unlocked after game end", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 6: Settings unlocked after game end
   *
   * For any GameSettings state, after END_GAME transitions the room to LOBBY phase,
   * a subsequent UPDATE_SETTINGS message from the host with valid changes should be
   * accepted and stored.
   *
   * **Validates: Requirements 7.4, 9.1**
   */
  it("after END_GAME, UPDATE_SETTINGS from host is accepted (no SETTINGS_LOCKED error)", async () => {
    await fc.assert(
      fc.asyncProperty(
        validRoundCountArb,
        validPickWindowMsArb,
        async (newRoundCount, newPickWindowMs) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host and player
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })
          await joinPlayer(gameRoom, {
            name: "Player2",
            clientId: "player-2",
          })

          // Start a game (settings become locked)
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Verify settings are locked
          const stateDuringGame = getStateFromBroadcast(mockRoom)
          expect(stateDuringGame.settingsLocked).toBe(true)

          // Advance time past pick window to trigger resolution → RESULT
          vi.advanceTimersByTime(60001)

          // End the game (settings become unlocked)
          const endMsg = JSON.stringify({ type: "END_GAME" })
          await gameRoom.onMessage(endMsg, hostConn as any)

          // Verify settings are unlocked
          const stateAfterEnd = getStateFromBroadcast(mockRoom)
          expect(stateAfterEnd.settingsLocked).toBe(false)
          expect(stateAfterEnd.round.phase).toBe("LOBBY")

          // Send UPDATE_SETTINGS — verify it's accepted (no SETTINGS_LOCKED error)
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: {
              changes: { roundCount: newRoundCount, pickWindowMs: newPickWindowMs },
            },
          })
          await gameRoom.onMessage(updateMsg, hostConn as any)

          // Verify settings were accepted (no error sent)
          const lastSent = getLastSent(hostConn)
          // If an error was sent, it would be the last message — check it's NOT a SETTINGS_LOCKED error
          if (lastSent && lastSent.type === "ERROR") {
            expect(lastSent.payload.code).not.toBe("SETTINGS_LOCKED")
            // Should not be an error at all for valid inputs
            expect(lastSent.type).not.toBe("ERROR")
          }

          // Verify the settings were actually updated
          const stateAfterUpdate = getStateFromBroadcast(mockRoom)
          expect(stateAfterUpdate.gameSettings.roundCount).toBe(newRoundCount)
          expect(stateAfterUpdate.gameSettings.pickWindowMs).toBe(newPickWindowMs)
        }
      ),
      { numRuns: 100 }
    )
  })
})
