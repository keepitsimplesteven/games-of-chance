import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState, type BattleBotsRoundResult } from "./BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattleBotsPick, BattleBotsGameState } from "./types"

/**
 * Validates: Requirements 6.2, 9.1
 *
 * 6.2 — 1 intermediate point to each 1v1 winner, 0 points to each loser
 * 9.1 — GameLeaderboardEntry array from computeGameLeaderboard maps final rankings to player positions
 */

// Helper to create a minimal settings object
function createSettings(): GameSettings {
  return {
    roundCount: 3,
    pickWindowMs: 15000,
    tuning: {
      BOT_HP: "100",
      ACCURACY: "80",
      DAMAGE_MIN: "1",
      DAMAGE_MAX: "10",
    },
  }
}

// Helper to create a minimal player
function createPlayer(id: string, name: string): Player {
  return { id, name } as Player
}

describe("BattleBotsPlugin.scoreRound", () => {
  beforeEach(() => {
    resetGameState()
  })

  describe("when gameState is null", () => {
    it("returns empty deltas", () => {
      const result = battleBotsPlugin.scoreRound(
        {},
        { round: 1 } as BattleBotsRoundResult,
        [],
        createSettings()
      )
      expect(result).toEqual({ deltas: {} })
    })
  })

  describe("Round 1 — Prep Phase", () => {
    it("returns empty deltas (no scoring in prep phase)", () => {
      // Set up game state via resolveRound1
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
      }
      const settings = createSettings()

      // Resolve round 1 to initialize gameState
      const round1Result = battleBotsPlugin.resolveRound(picks, settings)

      const scoreResult = battleBotsPlugin.scoreRound(
        picks,
        round1Result,
        [createPlayer("player1", "Alice"), createPlayer("player2", "Bob")],
        settings
      )

      expect(scoreResult).toEqual({ deltas: {} })
    })
  })

  describe("Round 2 — 1v1 Battles", () => {
    it("returns 1 for winners and 0 for losers", () => {
      // Set up game state by running round 1
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
        player3: { robotTemplateId: "bot-gamma" },
        player4: { robotTemplateId: "bot-alpha" },
      }
      const settings = createSettings()

      // Resolve round 1 to initialize gameState
      battleBotsPlugin.resolveRound(picks, settings)

      // Resolve round 2 (runs battles)
      const round2Result = battleBotsPlugin.resolveRound({}, settings)

      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
        createPlayer("player4", "Diana"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round2Result, players, settings)

      // Should have deltas for all 4 players
      const deltas = scoreResult.deltas
      const values = Object.values(deltas)

      // All values should be either 0 or 1
      for (const v of values) {
        expect(v === 0 || v === 1).toBe(true)
      }

      // Exactly 2 winners (value=1) and 2 losers (value=0)
      const winners = values.filter(v => v === 1)
      const losers = values.filter(v => v === 0)
      expect(winners).toHaveLength(2)
      expect(losers).toHaveLength(2)
    })

    it("excludes bot personas from deltas", () => {
      // Set up game with 3 players (odd → bot persona added)
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
        player3: { robotTemplateId: "bot-gamma" },
      }
      const settings = createSettings()

      // Resolve round 1
      battleBotsPlugin.resolveRound(picks, settings)

      // Resolve round 2
      const round2Result = battleBotsPlugin.resolveRound({}, settings)

      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round2Result, players, settings)

      // No bot persona IDs in deltas
      for (const key of Object.keys(scoreResult.deltas)) {
        expect(key.startsWith("bot_")).toBe(false)
      }
    })
  })

  describe("Round 3 — Final Rankings", () => {
    it("returns ranking-based points (totalParticipants - rank)", () => {
      // Set up game with 4 players
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
        player3: { robotTemplateId: "bot-gamma" },
        player4: { robotTemplateId: "bot-alpha" },
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2 to build up game state
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      // Manually set finalRankings since Round 3 isn't fully implemented yet
      const state = getGameState()!
      state.finalRankings = [
        { playerId: "player1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: "player2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false },
        { playerId: "player3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false },
        { playerId: "player4", playerName: "Diana", rank: 4, bracket: "losers", isBot: false },
      ]

      const round3Result: BattleBotsRoundResult = { round: 3 }
      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
        createPlayer("player4", "Diana"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round3Result, players, settings)

      // totalParticipants = 4, so:
      // rank 1 → 4 - 1 = 3 points
      // rank 2 → 4 - 2 = 2 points
      // rank 3 → 4 - 3 = 1 point
      // rank 4 → 4 - 4 = 0 points
      expect(scoreResult.deltas).toEqual({
        player1: 3,
        player2: 2,
        player3: 1,
        player4: 0,
      })
    })

    it("excludes bot personas from Round 3 deltas", () => {
      // Set up game with 3 players (odd → bot persona added)
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
        player3: { robotTemplateId: "bot-gamma" },
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      const state = getGameState()!
      const botId = state.botPersonas[0].id

      // Manually set finalRankings with bot persona included
      state.finalRankings = [
        { playerId: "player1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: botId, playerName: "MechBot-7", rank: 2, bracket: "winners", isBot: true },
        { playerId: "player2", playerName: "Bob", rank: 3, bracket: "losers", isBot: false },
        { playerId: "player3", playerName: "Charlie", rank: 4, bracket: "losers", isBot: false },
      ]

      const round3Result: BattleBotsRoundResult = { round: 3 }
      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round3Result, players, settings)

      // No bot persona IDs in deltas
      for (const key of Object.keys(scoreResult.deltas)) {
        expect(key.startsWith("bot_")).toBe(false)
      }

      // Only human players get scores
      expect(Object.keys(scoreResult.deltas)).toHaveLength(3)
      expect(scoreResult.deltas).toHaveProperty("player1")
      expect(scoreResult.deltas).toHaveProperty("player2")
      expect(scoreResult.deltas).toHaveProperty("player3")
    })

    it("awards higher points to better ranks", () => {
      // Set up game with 4 players
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
        player3: { robotTemplateId: "bot-gamma" },
        player4: { robotTemplateId: "bot-alpha" },
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      const state = getGameState()!
      state.finalRankings = [
        { playerId: "player1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: "player2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false },
        { playerId: "player3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false },
        { playerId: "player4", playerName: "Diana", rank: 4, bracket: "losers", isBot: false },
      ]

      const round3Result: BattleBotsRoundResult = { round: 3 }
      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
        createPlayer("player4", "Diana"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round3Result, players, settings)

      // rank 1 gets more than rank 2, rank 2 more than rank 3, etc.
      expect(scoreResult.deltas["player1"]).toBeGreaterThan(scoreResult.deltas["player2"])
      expect(scoreResult.deltas["player2"]).toBeGreaterThan(scoreResult.deltas["player3"])
      expect(scoreResult.deltas["player3"]).toBeGreaterThan(scoreResult.deltas["player4"])
    })
  })

  describe("unknown round", () => {
    it("returns empty deltas for unknown round numbers", () => {
      // Set up game state
      const picks: Record<string, BattleBotsPick> = {
        player1: { robotTemplateId: "bot-alpha" },
        player2: { robotTemplateId: "bot-beta" },
      }
      const settings = createSettings()

      battleBotsPlugin.resolveRound(picks, settings)

      const result = battleBotsPlugin.scoreRound(
        picks,
        { round: 99 } as BattleBotsRoundResult,
        [createPlayer("player1", "Alice"), createPlayer("player2", "Bob")],
        settings
      )

      expect(result).toEqual({ deltas: {} })
    })
  })
})
