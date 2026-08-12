import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState, type BattleBotsRoundResult } from "./BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattleBotsPick, BattleBotsGameState } from "./types"

/**
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 *
 * Round 2: WIN_BONUS (25) to each 1v1 winner, 0 points to each loser
 * Round 3: Survival-tick-based scoring for FFA eliminated players, 125 (100 + 25) for survivor
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

// Helper picks using valid BattleBotsPick format
const PICK_A: BattleBotsPick = { weapon: "drill", head: "square", body: "square" }
const PICK_B: BattleBotsPick = { weapon: "blaster", head: "rounded", body: "rounded" }
const PICK_C: BattleBotsPick = { weapon: "bazooka", head: "triangular", body: "triangular" }
const PICK_D: BattleBotsPick = { weapon: "drill", head: "hexagonal", body: "hexagonal" }

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
        player1: PICK_A,
        player2: PICK_B,
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
    it("returns WIN_BONUS (25) for winners and 0 for losers", () => {
      // Set up game state by running round 1
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
        player3: PICK_C,
        player4: PICK_D,
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

      // All values should be either 0 or 25
      for (const v of values) {
        expect(v === 0 || v === 25).toBe(true)
      }

      // Exactly 2 winners (value=25) and 2 losers (value=0)
      const winners = values.filter(v => v === 25)
      const losers = values.filter(v => v === 0)
      expect(winners).toHaveLength(2)
      expect(losers).toHaveLength(2)
    })

    it("excludes bot personas from deltas", () => {
      // Set up game with 3 players (odd → bot persona added)
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
        player3: PICK_C,
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

  describe("Round 3 — FFA Survival-Tick Scoring", () => {
    it("returns survival-tick-based points for eliminated players and 125 for survivor", () => {
      // Set up game with 4 players
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
        player3: PICK_C,
        player4: PICK_D,
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2 to build up game state
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      // Manually set bracket data for survival-tick scoring
      const state = getGameState()!
      state.winnersBracket = {
        id: "winners",
        participantIds: ["player1", "player2"],
        eliminationOrder: [
          { ownerId: "player2", eliminatedOnTick: 50 },
        ],
        survivorId: "player1",
        tickLog: [],
      }
      state.losersBracket = {
        id: "losers",
        participantIds: ["player3", "player4"],
        eliminationOrder: [
          { ownerId: "player4", eliminatedOnTick: 30 },
        ],
        survivorId: "player3",
        tickLog: [],
      }

      const round3Result: BattleBotsRoundResult = { round: 3 }
      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
        createPlayer("player4", "Diana"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round3Result, players, settings)

      // Winners bracket: totalTicks = 50
      // player2 eliminated on tick 50: ceil(50 / (50 * 1.1) * 100) = ceil(90.90) = 91
      // player1 survivor: 100 + 25 = 125
      // Losers bracket: totalTicks = 30
      // player4 eliminated on tick 30: ceil(30 / (30 * 1.1) * 100) = ceil(90.90) = 91
      // player3 survivor: 100 + 25 = 125
      expect(scoreResult.deltas).toEqual({
        player1: 125,
        player2: 91,
        player3: 125,
        player4: 91,
      })
    })

    it("excludes bot personas from Round 3 deltas", () => {
      // Set up game with 3 players (odd → bot persona added)
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
        player3: PICK_C,
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      const state = getGameState()!
      const botId = state.botPersonas[0].id

      // Set up brackets with bot persona included in elimination
      state.winnersBracket = {
        id: "winners",
        participantIds: ["player1", botId],
        eliminationOrder: [
          { ownerId: botId, eliminatedOnTick: 40 },
        ],
        survivorId: "player1",
        tickLog: [],
      }
      state.losersBracket = {
        id: "losers",
        participantIds: ["player2", "player3"],
        eliminationOrder: [
          { ownerId: "player3", eliminatedOnTick: 60 },
        ],
        survivorId: "player2",
        tickLog: [],
      }

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

    it("awards higher points to later-eliminated players", () => {
      // Set up game with 4 players
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
        player3: PICK_C,
        player4: PICK_D,
      }
      const settings = createSettings()

      // Resolve rounds 1 and 2
      battleBotsPlugin.resolveRound(picks, settings) // Round 1
      battleBotsPlugin.resolveRound({}, settings)    // Round 2

      const state = getGameState()!
      // Single bracket with multiple eliminations at different ticks
      state.winnersBracket = {
        id: "winners",
        participantIds: ["player1", "player2", "player3", "player4"],
        eliminationOrder: [
          { ownerId: "player4", eliminatedOnTick: 10 },
          { ownerId: "player3", eliminatedOnTick: 30 },
          { ownerId: "player2", eliminatedOnTick: 50 },
        ],
        survivorId: "player1",
        tickLog: [],
      }
      state.losersBracket = null

      const round3Result: BattleBotsRoundResult = { round: 3 }
      const players = [
        createPlayer("player1", "Alice"),
        createPlayer("player2", "Bob"),
        createPlayer("player3", "Charlie"),
        createPlayer("player4", "Diana"),
      ]

      const scoreResult = battleBotsPlugin.scoreRound(picks, round3Result, players, settings)

      // totalTicks = 50 (last elimination)
      // player4 eliminated on tick 10: ceil(10 / (50 * 1.1) * 100) = ceil(18.18) = 19
      // player3 eliminated on tick 30: ceil(30 / (50 * 1.1) * 100) = ceil(54.54) = 55
      // player2 eliminated on tick 50: ceil(50 / (50 * 1.1) * 100) = ceil(90.90) = 91
      // player1 survivor: 125
      expect(scoreResult.deltas["player1"]).toBeGreaterThan(scoreResult.deltas["player2"])
      expect(scoreResult.deltas["player2"]).toBeGreaterThan(scoreResult.deltas["player3"])
      expect(scoreResult.deltas["player3"]).toBeGreaterThan(scoreResult.deltas["player4"])

      // Verify exact values
      expect(scoreResult.deltas["player1"]).toBe(125)
      expect(scoreResult.deltas["player2"]).toBe(91)
      expect(scoreResult.deltas["player3"]).toBe(55)
      expect(scoreResult.deltas["player4"]).toBe(19)
    })
  })

  describe("unknown round", () => {
    it("returns empty deltas for unknown round numbers", () => {
      // Set up game state
      const picks: Record<string, BattleBotsPick> = {
        player1: PICK_A,
        player2: PICK_B,
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
