import { describe, it, expect, beforeEach } from "vitest"
import type { GameSettings } from "@games-of-chance/shared"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
} from "../BattleBotsPlugin"
import { BATTLE_BOTS, BATTLE_BOTS_SETTINGS_SCHEMA } from "../constants"

/**
 * Settings integration test
 * Validates: Requirements 1.2, 2.4, 12.2
 *
 * Verifies that custom HP, accuracy, damage range values from settingsSchema
 * are applied to robot instances and that prep timer uses configured pickWindowMs.
 */
describe("Settings integration", () => {
  beforeEach(() => {
    resetGameState()
  })

  const customSettings: GameSettings = {
    roundCount: 3,
    pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,
    tuning: {
      BOT_HP: 200,
      ACCURACY: 50,
      DAMAGE_MIN: 5,
      DAMAGE_MAX: 20,
    },
  }

  it("applies custom HP to all robot instances after Round 1", () => {
    const picks = {
      p1: { robotTemplateId: "bot-alpha" },
      p2: { robotTemplateId: "bot-beta" },
    }

    battleBotsPlugin.resolveRound(picks, customSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.selectedRobots)) {
      expect(state.selectedRobots[id].currentHp).toBe(200)
      expect(state.selectedRobots[id].maxHp).toBe(200)
    }
  })

  it("applies custom accuracy to all robot instances after Round 1", () => {
    const picks = {
      p1: { robotTemplateId: "bot-alpha" },
      p2: { robotTemplateId: "bot-beta" },
    }

    battleBotsPlugin.resolveRound(picks, customSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.selectedRobots)) {
      expect(state.selectedRobots[id].accuracy).toBe(50)
    }
  })

  it("applies custom damage range to all robot instances after Round 1", () => {
    const picks = {
      p1: { robotTemplateId: "bot-alpha" },
      p2: { robotTemplateId: "bot-beta" },
    }

    battleBotsPlugin.resolveRound(picks, customSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.selectedRobots)) {
      expect(state.selectedRobots[id].damageMin).toBe(5)
      expect(state.selectedRobots[id].damageMax).toBe(20)
    }
  })

  it("applies all custom stats together (HP, accuracy, damage range)", () => {
    const picks = {
      p1: { robotTemplateId: "bot-alpha" },
      p2: { robotTemplateId: "bot-beta" },
      p3: { robotTemplateId: "bot-gamma" },
      p4: { robotTemplateId: "bot-alpha" },
    }

    battleBotsPlugin.resolveRound(picks, customSettings)

    const state = getGameState()!
    for (const id of Object.keys(state.selectedRobots)) {
      const robot = state.selectedRobots[id]
      expect(robot.currentHp).toBe(200)
      expect(robot.maxHp).toBe(200)
      expect(robot.accuracy).toBe(50)
      expect(robot.damageMin).toBe(5)
      expect(robot.damageMax).toBe(20)
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
    expect(keys).toContain("BOT_HP")
    expect(keys).toContain("DAMAGE_MIN")
    expect(keys).toContain("DAMAGE_MAX")
    expect(keys).toContain("ACCURACY")
    expect(keys).toContain("CHIPS_MULTIPLIER")
  })

  it("settings schema default values match BATTLE_BOTS constants", () => {
    const schema = BATTLE_BOTS_SETTINGS_SCHEMA

    const botHpField = schema.find((f) => f.key === "BOT_HP")!
    expect(botHpField.defaultValue).toBe(BATTLE_BOTS.BOT_HP)

    const damageMinField = schema.find((f) => f.key === "DAMAGE_MIN")!
    expect(damageMinField.defaultValue).toBe(BATTLE_BOTS.DAMAGE_MIN)

    const damageMaxField = schema.find((f) => f.key === "DAMAGE_MAX")!
    expect(damageMaxField.defaultValue).toBe(BATTLE_BOTS.DAMAGE_MAX)

    const accuracyField = schema.find((f) => f.key === "ACCURACY")!
    expect(accuracyField.defaultValue).toBe(BATTLE_BOTS.ACCURACY)

    const chipsField = schema.find((f) => f.key === "CHIPS_MULTIPLIER")!
    expect(chipsField.defaultValue).toBe(BATTLE_BOTS.CHIPS_MULTIPLIER)
  })

  it("plugin exposes the settings schema via settingsSchema property", () => {
    expect(battleBotsPlugin.settingsSchema).toBe(BATTLE_BOTS_SETTINGS_SCHEMA)
  })
})
