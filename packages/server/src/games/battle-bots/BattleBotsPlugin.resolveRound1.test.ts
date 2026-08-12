import { describe, it, expect, beforeEach } from "vitest"
import type { GameSettings } from "@games-of-chance/shared"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
} from "./BattleBotsPlugin"
import { BATTLE_BOTS } from "./constants"
import type { BattleBotsPick, CombatRobot } from "./types"

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,
  tuning: {
    PREP_TIMER_MS: "60",
    CHIPS_MULTIPLIER: "10",
    GAME_SPEED: "100",
  },
}

describe("BattleBotsPlugin resolveRound (Round 1 — Prep Phase)", () => {
  beforeEach(() => {
    resetGameState()
  })

  describe("resolveRound1 — basic behavior", () => {
    it("returns round: 1 in the result", () => {
      const result = battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      expect(result.round).toBe(1)
    })

    it("stores game state after resolution", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()
      expect(state).not.toBeNull()
      expect(state!.participants).toContain("p1")
      expect(state!.participants).toContain("p2")
    })

    it("stores builds for all participants", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.builds).toBeDefined()
      expect(state.builds!["p1"]).toBeDefined()
      expect(state.builds!["p2"]).toBeDefined()
    })
  })

  describe("resolveRound1 — CombatRobot creation", () => {
    it("creates CombatRobot with correct star distribution from parts", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()!
      const robot = state.builds!["p1"]

      // drill (1d, 0a, 2s) + square head (1d, 1a, 1s) + square body (1d, 1a, 1s) = 3d, 2a, 4s
      expect(robot.stars.damage).toBe(3)
      expect(robot.stars.accuracy).toBe(2)
      expect(robot.stars.speed).toBe(4)
      expect(robot.stars.damage + robot.stars.accuracy + robot.stars.speed).toBe(9)
    })

    it("creates CombatRobot with correct visual config", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "bazooka", head: "hexagonal", body: "rounded" }, p2: { weapon: "blaster", head: "triangular", body: "triangular" } },
        defaultSettings
      )
      const state = getGameState()!
      const robot = state.builds!["p1"]

      expect(robot.visual.weapon).toBe("bazooka")
      expect(robot.visual.head).toBe("hexagonal")
      expect(robot.visual.body).toBe("rounded")
    })

    it("creates CombatRobot with BASE_HP as currentHp and maxHp", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()!
      const robot = state.builds!["p1"]

      expect(robot.currentHp).toBe(100)
      expect(robot.maxHp).toBe(100)
    })

    it("derives combat stats (maxHit, accuracy, tickInterval) from stars", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()!
      const robot = state.builds!["p1"]

      // All derived stats should be positive integers
      expect(robot.maxHit).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(robot.maxHit)).toBe(true)
      expect(robot.accuracy).toBeGreaterThanOrEqual(1)
      expect(robot.accuracy).toBeLessThanOrEqual(90)
      expect(Number.isInteger(robot.accuracy)).toBe(true)
      expect(robot.tickInterval).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(robot.tickInterval)).toBe(true)
    })

    it("assigns unique robot names to all participants", () => {
      battleBotsPlugin.resolveRound(
        {
          p1: { weapon: "drill", head: "square", body: "square" },
          p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
          p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
          p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
        },
        defaultSettings
      )
      const state = getGameState()!
      const names = Object.values(state.builds!).map((b) => b.name)
      expect(new Set(names).size).toBe(names.length)
      for (const name of names) {
        expect(name.length).toBeGreaterThan(0)
      }
    })
  })

  describe("resolveRound1 — bot persona handling", () => {
    it("creates a bot persona when player count is odd", () => {
      battleBotsPlugin.resolveRound(
        {
          p1: { weapon: "drill", head: "square", body: "square" },
          p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
          p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
        },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(1)
      expect(state.botPersonas[0].isBot).toBe(true)
      expect(state.participants.length).toBe(4) // 3 players + 1 bot
    })

    it("creates a bot persona when only 1 player", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(1)
      expect(state.participants.length).toBe(2) // 1 player + 1 bot
    })

    it("does not create a bot persona for even player count >= 2", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      const state = getGameState()!
      expect(state.botPersonas).toHaveLength(0)
      expect(state.participants.length).toBe(2)
    })

    it("assigns a valid CombatRobot build to bot persona", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" } },
        defaultSettings
      )
      const state = getGameState()!
      const botId = state.botPersonas[0].id

      expect(state.builds![botId]).toBeDefined()
      const botRobot = state.builds![botId]
      expect(botRobot.ownerId).toBe(botId)
      expect(botRobot.name.length).toBeGreaterThan(0)
      expect(botRobot.stars.damage + botRobot.stars.accuracy + botRobot.stars.speed).toBe(9)
      expect(botRobot.currentHp).toBe(100)
      expect(botRobot.maxHp).toBe(100)
    })
  })

  describe("resolveRound1 — result shape", () => {
    it("includes participants, botPersonas, and builds in result", () => {
      const result = battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      expect(result).toHaveProperty("participants")
      expect(result).toHaveProperty("botPersonas")
      expect(result).toHaveProperty("builds")
    })
  })

  describe("resetGameState", () => {
    it("clears game state and round counter", () => {
      battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      expect(getGameState()).not.toBeNull()

      resetGameState()
      expect(getGameState()).toBeNull()

      // After reset, the next resolveRound should be round 1 again
      const result = battleBotsPlugin.resolveRound(
        { p1: { weapon: "drill", head: "square", body: "square" }, p2: { weapon: "blaster", head: "rounded", body: "hexagonal" } },
        defaultSettings
      )
      expect(result.round).toBe(1)
    })
  })
})
