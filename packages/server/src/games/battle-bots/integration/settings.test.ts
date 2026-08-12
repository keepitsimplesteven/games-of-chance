import { describe, it, expect, beforeEach } from "vitest"
import type { GameSettings } from "@games-of-chance/shared"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
} from "../BattleBotsPlugin"
import { BATTLE_BOTS, BATTLE_BOTS_SETTINGS_SCHEMA } from "../constants"
import type { BattleBotsPick } from "../types"

/**
 * Settings integration test
 * Validates: Requirements 10.5, 11.1-11.6
 *
 * Verifies that the new part-based system uses BASE_HP (100) for all robots,
 * derives stats from stars/modifier table, and settings schema is correct.
 */
describe("Settings integration", () => {
  beforeEach(() => {
    resetGameState()
  })

  const defaultSettings: GameSettings = {
    roundCount: 3,
    pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,
    tuning: {
      PREP_TIMER_MS: "60",
      CHIPS_MULTIPLIER: "10",
      GAME_SPEED: "100",
    },
  }

  it("applies BASE_HP (100) to all CombatRobot builds after Round 1", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
      p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
    }

    battleBotsPlugin.resolveRound(picks, defaultSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.builds!)) {
      expect(state.builds![id].currentHp).toBe(100)
      expect(state.builds![id].maxHp).toBe(100)
    }
  })

  it("derives accuracy from stars and modifier table (capped at 90)", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
      p2: { weapon: "blaster", head: "triangular", body: "triangular" },
    }

    battleBotsPlugin.resolveRound(picks, defaultSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.builds!)) {
      expect(state.builds![id].accuracy).toBeGreaterThanOrEqual(1)
      expect(state.builds![id].accuracy).toBeLessThanOrEqual(90)
    }
  })

  it("derives maxHit from stars and modifier table (minimum 1)", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
      p2: { weapon: "bazooka", head: "hexagonal", body: "hexagonal" },
    }

    battleBotsPlugin.resolveRound(picks, defaultSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.builds!)) {
      expect(state.builds![id].maxHit).toBeGreaterThanOrEqual(1)
    }
  })

  it("all builds have star total of 9", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
      p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
      p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
      p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
    }

    battleBotsPlugin.resolveRound(picks, defaultSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.builds!)) {
      const stars = state.builds![id].stars
      expect(stars.damage + stars.accuracy + stars.speed).toBe(9)
    }
  })

  it("plugin pickWindowMs matches BATTLE_BOTS.PICK_WINDOW_MS (60000)", () => {
    expect(battleBotsPlugin.pickWindowMs).toBe(60_000)
    expect(battleBotsPlugin.pickWindowMs).toBe(BATTLE_BOTS.PICK_WINDOW_MS)
  })

  it("roundCount is fixed at 3", () => {
    expect(BATTLE_BOTS.ROUND_COUNT).toBe(3)
  })

  it("settings schema contains expected tuning fields", () => {
    const keys = BATTLE_BOTS_SETTINGS_SCHEMA.map((field) => field.key)

    expect(keys).toContain("PREP_TIMER_MS")
    expect(keys).toContain("CHIPS_MULTIPLIER")
    expect(keys).toContain("GAME_SPEED")
    expect(keys).toHaveLength(3)
  })

  it("settings schema default values match expected constants", () => {
    const schema = BATTLE_BOTS_SETTINGS_SCHEMA

    const prepTimerField = schema.find((f) => f.key === "PREP_TIMER_MS")!
    expect(prepTimerField.defaultValue).toBe(60)

    const chipsField = schema.find((f) => f.key === "CHIPS_MULTIPLIER")!
    expect(chipsField.defaultValue).toBe(BATTLE_BOTS.CHIPS_MULTIPLIER)

    const gameSpeedField = schema.find((f) => f.key === "GAME_SPEED")!
    expect(gameSpeedField.defaultValue).toBe(100)
  })

  it("plugin exposes the settings schema via settingsSchema property", () => {
    expect(battleBotsPlugin.settingsSchema).toBe(BATTLE_BOTS_SETTINGS_SCHEMA)
  })
})
