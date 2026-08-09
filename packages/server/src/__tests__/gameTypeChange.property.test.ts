/**
 * Feature: game-settings, Property 9: Game type change resets tuning, retains shared
 *
 * For any two game types, when the host switches from game type A to game type B
 * in the lobby, the resulting Game_Settings should have:
 * (a) roundCount unchanged from before the switch,
 * (b) pickWindowMs set to game B's plugin default,
 * (c) tuning keys and values matching game B's schema defaults.
 *
 * Validates: Requirements 9.3
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"
import type { GameSettings, SettingsSchema } from "@games-of-chance/shared"
import type { GamePlugin } from "../games/GamePlugin"
import { registry } from "../games/GameRegistry"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

// ── Test Plugin: "dice-roll" ───────────────────────────────────────────────
// A second mock plugin registered specifically for testing game type changes.

const DICE_ROLL_PICK_WINDOW_MS = 8000

const DICE_ROLL_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: "SIDES",
    label: "Number of sides",
    type: "number",
    defaultValue: 6,
    constraints: { min: 2, max: 20, step: 1 },
  },
  {
    key: "BONUS_POINTS",
    label: "Bonus points for max roll",
    type: "number",
    defaultValue: 3,
    constraints: { min: 0, max: 50, step: 1 },
  },
]

const diceRollPlugin: GamePlugin = {
  gameType: "dice-roll",
  settingsSchema: DICE_ROLL_SETTINGS_SCHEMA,
  pickWindowMs: DICE_ROLL_PICK_WINDOW_MS,

  validatePick(pick: unknown): pick is unknown {
    return typeof pick === "object" && pick !== null
  },

  resolveRound(_picks, _settings) {
    return { roll: Math.floor(Math.random() * 6) + 1 }
  },

  scoreRound(_picks, _result, players, _settings) {
    const deltas: Record<string, number> = {}
    for (const player of players) {
      deltas[player.id] = 0
    }
    return { deltas }
  },

  computeGameLeaderboard(players, gameScores) {
    return players.map((p, i) => ({
      playerId: p.id,
      playerName: p.name,
      score: gameScores[p.id] ?? 0,
      rank: i + 1,
    }))
  },
}

// Register the mock plugin
registry.register(diceRollPlugin)

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Valid roundCount values within [1, 50] */
const validRoundCountArb = fc.integer({ min: 1, max: 50 })

/** Valid pickWindowMs values within [3000, 60000] */
const validPickWindowMsArb = fc.integer({ min: 3000, max: 60000 })

/** Game type pair: switching from one to the other */
const gameTypePairArb = fc.constantFrom(
  { from: "coin-toss", to: "dice-roll" } as const,
  { from: "dice-roll", to: "coin-toss" } as const
)

// ── Property 9: Game type change resets tuning, retains shared ─────────────

describe("Feature: game-settings, Property 9: Game type change resets tuning, retains shared", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 9: Game type change resets tuning, retains shared
   *
   * For any two distinct game types A and B, when the host switches from game
   * type A to game type B in the lobby, the resulting Game_Settings should have:
   * (a) roundCount unchanged from before the switch,
   * (b) pickWindowMs set to game B's plugin default,
   * (c) tuning keys and values matching game B's schema defaults.
   *
   * **Validates: Requirements 9.3**
   */
  it("game type change retains roundCount, resets pickWindowMs and tuning to new plugin defaults", async () => {
    await fc.assert(
      fc.asyncProperty(
        gameTypePairArb,
        validRoundCountArb,
        validPickWindowMsArb,
        async ({ from, to }, roundCount, pickWindowMs) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // First set the game type to `from`
          const setFromMsg = JSON.stringify({
            type: "SET_GAME_TYPE",
            payload: { gameType: from },
          })
          await gameRoom.onMessage(hostConn as any, setFromMsg)

          // Configure settings with arbitrary valid roundCount and pickWindowMs
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { roundCount, pickWindowMs } },
          })
          await gameRoom.onMessage(hostConn as any, updateMsg)

          // Verify the roundCount and pickWindowMs are set as we expect
          const stateBefore = getStateFromBroadcast(mockRoom)
          expect(stateBefore.gameSettings.roundCount).toBe(roundCount)
          expect(stateBefore.gameSettings.pickWindowMs).toBe(pickWindowMs)

          // Now switch to the target game type
          const setToMsg = JSON.stringify({
            type: "SET_GAME_TYPE",
            payload: { gameType: to },
          })
          await gameRoom.onMessage(hostConn as any, setToMsg)

          // Verify the state after game type change
          const stateAfter = getStateFromBroadcast(mockRoom)
          const targetPlugin = registry.lookup(to)

          // (a) roundCount should be retained (unchanged)
          expect(stateAfter.gameSettings.roundCount).toBe(roundCount)

          // (b) pickWindowMs should be reset to the target plugin's default
          expect(stateAfter.gameSettings.pickWindowMs).toBe(targetPlugin.pickWindowMs)

          // (c) tuning keys and values should match the target plugin's schema defaults
          const expectedTuning: Record<string, number | boolean | string> = {}
          if (targetPlugin.settingsSchema) {
            for (const field of targetPlugin.settingsSchema) {
              expectedTuning[field.key] = field.defaultValue
            }
          }
          expect(stateAfter.gameSettings.tuning).toEqual(expectedTuning)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("switching to same game type is a no-op (settings remain unchanged)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("coin-toss", "dice-roll"),
        validRoundCountArb,
        validPickWindowMsArb,
        async (gameType, roundCount, pickWindowMs) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Set the game type initially
          const setMsg = JSON.stringify({
            type: "SET_GAME_TYPE",
            payload: { gameType },
          })
          await gameRoom.onMessage(hostConn as any, setMsg)

          // Configure settings with arbitrary roundCount and pickWindowMs
          const updateMsg = JSON.stringify({
            type: "UPDATE_SETTINGS",
            payload: { changes: { roundCount, pickWindowMs } },
          })
          await gameRoom.onMessage(hostConn as any, updateMsg)

          // Capture state before "switching" to the same type
          const stateBefore = getStateFromBroadcast(mockRoom)

          // "Switch" to the same game type (should be no-op)
          await gameRoom.onMessage(hostConn as any, setMsg)

          // State should remain identical (no-op)
          const stateAfter = getStateFromBroadcast(mockRoom)
          expect(stateAfter.gameSettings).toEqual(stateBefore.gameSettings)
        }
      ),
      { numRuns: 100 }
    )
  })
})
