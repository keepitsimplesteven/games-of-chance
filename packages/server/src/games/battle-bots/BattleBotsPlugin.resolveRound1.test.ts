import { describe, it, expect, beforeEach } from "vitest"
import type { GameSettings } from "@games-of-chance/shared"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
  getRobotTemplates,
} from "./BattleBotsPlugin"
import { BATTLE_BOTS } from "./constants"

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,
  tuning: {
    BOT_HP: BATTLE_BOTS.BOT_HP,
    ACCURACY: BATTLE_BOTS.ACCURACY,
    DAMAGE_MIN: BATTLE_BOTS.DAMAGE_MIN,
    DAMAGE_MAX: BATTLE_BOTS.DAMAGE_MAX,
  },
}

describe("BattleBotsPlugin resolveRound (Round 1 — Prep Phase)", () => {
  beforeEach(() => {
    resetGameState()
  })

  describe("getRobotTemplates", () => {
    it("returns 3 robot templates with settings-derived stats", () => {
      const templates = getRobotTemplates(defaultSettings)
      expect(templates).toHaveLength(3)
      for (const t of templates) {
        expect(t.hp).toBe(BATTLE_BOTS.BOT_HP)
        expect(t.accuracy).toBe(BATTLE_BOTS.ACCURACY)
        expect(t.damageMin).toBe(BATTLE_BOTS.DAMAGE_MIN)
        expect(t.damageMax).toBe(BATTLE_BOTS.DAMAGE_MAX)
      }
    })

    it("uses custom settings when provided", () => {
      const customSettings: GameSettings = {
        roundCount: 3,
        pickWindowMs: 60_000,
        tuning: { BOT_HP: 200, ACCURACY: 50, DAMAGE_MIN: 5, DAMAGE_MAX: 20 },
      }
      const templates = getRobotTemplates(customSettings)
      expect(templates[0].hp).toBe(200)
      expect(templates[0].accuracy).toBe(50)
      expect(templates[0].damageMin).toBe(5)
      expect(templates[0].damageMax).toBe(20)
    })

    it("returns templates with unique IDs and visualIds", () => {
      const templates = getRobotTemplates(defaultSettings)
      const ids = templates.map((t) => t.id)
      const visualIds = templates.map((t) => t.visualId)
      expect(new Set(ids).size).toBe(3)
      expect(new Set(visualIds).size).toBe(3)
    })
  })

  describe("resolveRound1 — basic behavior", () => {
    it("returns round: 1 in the result", () => {
      const result = battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      expect(result.round).toBe(1)
    })

    it("stores game state after resolution", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      const state = getGameState()
      expect(state).not.toBeNull()
      expect(state!.participants).toContain("p1")
      expect(state!.participants).toContain("p2")
    })

    it("generates robotOptions for all participants", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.robotOptions["p1"].options).toHaveLength(3)
      expect(state.robotOptions["p2"].options).toHaveLength(3)
    })
  })

  describe("resolveRound1 — player picks", () => {
    it("uses player's valid pick when submitted", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.selectedRobots["p1"].templateId).toBe("bot-alpha")
      expect(state.selectedRobots["p2"].templateId).toBe("bot-beta")
    })

    it("randomly assigns a robot when player pick is missing (empty object)", () => {
      const picks = { p1: { robotTemplateId: "" }, p2: { robotTemplateId: "bot-beta" } }
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      const state = getGameState()!
      // p1 should have been randomly assigned one of the 3 templates
      const validIds = ["bot-alpha", "bot-beta", "bot-gamma"]
      expect(validIds).toContain(state.selectedRobots["p1"].templateId)
      expect(state.selectedRobots["p2"].templateId).toBe("bot-beta")
    })

    it("randomly assigns a robot when player pick references an invalid template", () => {
      const picks = { p1: { robotTemplateId: "non-existent" }, p2: { robotTemplateId: "bot-gamma" } }
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      const state = getGameState()!
      // p1 has invalid pick → random assignment
      const validIds = ["bot-alpha", "bot-beta", "bot-gamma"]
      expect(validIds).toContain(state.selectedRobots["p1"].templateId)
      expect(state.selectedRobots["p2"].templateId).toBe("bot-gamma")
    })
  })

  describe("resolveRound1 — RobotInstance creation", () => {
    it("creates RobotInstances with correct stats from template", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      const state = getGameState()!
      const robot = state.selectedRobots["p1"]
      expect(robot.ownerId).toBe("p1")
      expect(robot.currentHp).toBe(BATTLE_BOTS.BOT_HP)
      expect(robot.maxHp).toBe(BATTLE_BOTS.BOT_HP)
      expect(robot.accuracy).toBe(BATTLE_BOTS.ACCURACY)
      expect(robot.damageMin).toBe(BATTLE_BOTS.DAMAGE_MIN)
      expect(robot.damageMax).toBe(BATTLE_BOTS.DAMAGE_MAX)
    })

    it("creates RobotInstances with custom settings values", () => {
      const customSettings: GameSettings = {
        roundCount: 3,
        pickWindowMs: 60_000,
        tuning: { BOT_HP: 150, ACCURACY: 60, DAMAGE_MIN: 3, DAMAGE_MAX: 15 },
      }
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        customSettings
      )
      const state = getGameState()!
      const robot = state.selectedRobots["p1"]
      expect(robot.currentHp).toBe(150)
      expect(robot.maxHp).toBe(150)
      expect(robot.accuracy).toBe(60)
      expect(robot.damageMin).toBe(3)
      expect(robot.damageMax).toBe(15)
    })
  })

  describe("resolveRound1 — bot persona handling", () => {
    it("creates a bot persona when player count is odd", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" }, p3: { robotTemplateId: "bot-gamma" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(1)
      expect(state.botPersonas[0].isBot).toBe(true)
      expect(state.participants.length).toBe(4) // 3 players + 1 bot
    })

    it("creates a bot persona when only 1 player", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(1)
      expect(state.participants.length).toBe(2) // 1 player + 1 bot
    })

    it("does not create a bot persona for even player count >= 2", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(0)
      expect(state.participants.length).toBe(2)
    })

    it("assigns robot options and selection to bot persona", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" } },
        defaultSettings
      )
      const state = getGameState()!
      const botId = state.botPersonas[0].id
      // Bot should have options
      expect(state.robotOptions[botId]).toBeDefined()
      expect(state.robotOptions[botId].options).toHaveLength(3)
      // Bot should have a selected robot
      expect(state.selectedRobots[botId]).toBeDefined()
      const validIds = ["bot-alpha", "bot-beta", "bot-gamma"]
      expect(validIds).toContain(state.selectedRobots[botId].templateId)
    })
  })

  describe("resolveRound1 — result shape", () => {
    it("includes participants, botPersonas, robotOptions, selectedRobots in result", () => {
      const result = battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      expect(result).toHaveProperty("participants")
      expect(result).toHaveProperty("botPersonas")
      expect(result).toHaveProperty("robotOptions")
      expect(result).toHaveProperty("selectedRobots")
    })
  })

  describe("resetGameState", () => {
    it("clears game state and round counter", () => {
      battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      expect(getGameState()).not.toBeNull()

      resetGameState()
      expect(getGameState()).toBeNull()

      // After reset, the next resolveRound should be round 1 again
      const result = battleBotsPlugin.resolveRound(
        { p1: { robotTemplateId: "bot-alpha" }, p2: { robotTemplateId: "bot-beta" } },
        defaultSettings
      )
      expect(result.round).toBe(1)
    })
  })
})
