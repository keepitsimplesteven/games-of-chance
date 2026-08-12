import { describe, it, expect, beforeEach } from "vitest"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
  type BattleBotsRoundResult,
} from "../BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattleBotsPick } from "../types"

/**
 * Integration test: Bot Persona Scoring Exclusion
 *
 * Validates: Requirements 11.3, 11.4
 *
 * Uses an odd player count (3 players → 1 bot persona added) and runs all 3 rounds,
 * verifying that bot persona IDs never appear in scoring outputs or leaderboard entries.
 */

function createSettings(): GameSettings {
  return {
    roundCount: 3,
    pickWindowMs: 15000,
    tuning: {
      PREP_TIMER_MS: "60",
      CHIPS_MULTIPLIER: "10",
      GAME_SPEED: "100",
    },
  }
}

function createPlayer(id: string, name: string): Player {
  return { id, name } as Player
}

describe("Integration: Bot persona scoring exclusion (3 players → 1 bot persona)", () => {
  const settings = createSettings()
  const humanPlayerIds = ["player1", "player2", "player3"]
  const players = [
    createPlayer("player1", "Alice"),
    createPlayer("player2", "Bob"),
    createPlayer("player3", "Charlie"),
  ]

  let round1Result: BattleBotsRoundResult
  let round2Result: BattleBotsRoundResult
  let round3Result: BattleBotsRoundResult

  beforeEach(() => {
    resetGameState()

    const picks: Record<string, BattleBotsPick> = {
      player1: { weapon: "drill", head: "square", body: "square" },
      player2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
      player3: { weapon: "bazooka", head: "triangular", body: "rounded" },
    }

    // Round 1: Prep phase — builds finalized, bot persona created
    round1Result = battleBotsPlugin.resolveRound(picks, settings)

    // Round 2: 1v1 battles
    round2Result = battleBotsPlugin.resolveRound({}, settings)

    // Round 3: FFA brackets
    round3Result = battleBotsPlugin.resolveRound({}, settings)
  })

  it("creates exactly 1 bot persona for 3 players", () => {
    const state = getGameState()!
    expect(state.botPersonas).toHaveLength(1)
    expect(state.botPersonas[0].id).toMatch(/^bot_/)
    expect(state.botPersonas[0].isBot).toBe(true)
    expect(state.participants).toHaveLength(4)
  })

  describe("Round 2: scoreRound excludes bot persona from deltas", () => {
    it("has no bot_-prefixed IDs in round 2 deltas", () => {
      const scoreResult = battleBotsPlugin.scoreRound(
        {},
        round2Result,
        players,
        settings
      )

      const deltaKeys = Object.keys(scoreResult.deltas)

      // No bot persona IDs
      for (const key of deltaKeys) {
        expect(key.startsWith("bot_")).toBe(false)
      }
    })

    it("only contains human player IDs in round 2 deltas", () => {
      const scoreResult = battleBotsPlugin.scoreRound(
        {},
        round2Result,
        players,
        settings
      )

      const deltaKeys = Object.keys(scoreResult.deltas)

      // Every key must be a human player
      for (const key of deltaKeys) {
        expect(humanPlayerIds).toContain(key)
      }
    })
  })

  describe("Round 3: scoreRound excludes bot persona from deltas", () => {
    it("has no bot_-prefixed IDs in round 3 deltas", () => {
      const scoreResult = battleBotsPlugin.scoreRound(
        {},
        round3Result,
        players,
        settings
      )

      const deltaKeys = Object.keys(scoreResult.deltas)

      // No bot persona IDs
      for (const key of deltaKeys) {
        expect(key.startsWith("bot_")).toBe(false)
      }
    })

    it("only contains human player IDs in round 3 deltas", () => {
      const scoreResult = battleBotsPlugin.scoreRound(
        {},
        round3Result,
        players,
        settings
      )

      const deltaKeys = Object.keys(scoreResult.deltas)

      // Every key must be a human player
      for (const key of deltaKeys) {
        expect(humanPlayerIds).toContain(key)
      }
    })

    it("awards points to all 3 human players", () => {
      const scoreResult = battleBotsPlugin.scoreRound(
        {},
        round3Result,
        players,
        settings
      )

      // All 3 human players should receive scoring deltas
      expect(Object.keys(scoreResult.deltas)).toHaveLength(3)
      expect(scoreResult.deltas).toHaveProperty("player1")
      expect(scoreResult.deltas).toHaveProperty("player2")
      expect(scoreResult.deltas).toHaveProperty("player3")
    })
  })

  describe("computeGameLeaderboard excludes bot persona", () => {
    it("has no bot_-prefixed IDs in leaderboard entries", () => {
      const round2Scores = battleBotsPlugin.scoreRound({}, round2Result, players, settings)
      const round3Scores = battleBotsPlugin.scoreRound({}, round3Result, players, settings)

      const gameScores: Record<string, number> = {}
      for (const id of humanPlayerIds) {
        gameScores[id] = (round2Scores.deltas[id] ?? 0) + (round3Scores.deltas[id] ?? 0)
      }

      const leaderboard = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // No bot persona IDs in leaderboard
      for (const entry of leaderboard) {
        expect(entry.playerId.startsWith("bot_")).toBe(false)
      }
    })

    it("contains only human players in leaderboard", () => {
      const gameScores: Record<string, number> = {
        player1: 3,
        player2: 2,
        player3: 1,
      }

      const leaderboard = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // All entries must be human players
      for (const entry of leaderboard) {
        expect(humanPlayerIds).toContain(entry.playerId)
      }

      // Should have exactly 3 entries (one per human player)
      expect(leaderboard).toHaveLength(3)
    })

    it("leaderboard entries have valid rank, score, and playerName", () => {
      const gameScores: Record<string, number> = {
        player1: 3,
        player2: 2,
        player3: 1,
      }

      const leaderboard = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      for (const entry of leaderboard) {
        expect(entry.rank).toBeGreaterThan(0)
        expect(typeof entry.score).toBe("number")
        expect(entry.playerName).toBeTruthy()
      }
    })
  })

  describe("session leaderboard exclusion (bot persona not in scoring outputs)", () => {
    it("bot persona ID from game state never appears in any scoring output", () => {
      const state = getGameState()!
      const botId = state.botPersonas[0].id

      // Round 2 deltas
      const round2Scores = battleBotsPlugin.scoreRound({}, round2Result, players, settings)
      expect(round2Scores.deltas).not.toHaveProperty(botId)

      // Round 3 deltas
      const round3Scores = battleBotsPlugin.scoreRound({}, round3Result, players, settings)
      expect(round3Scores.deltas).not.toHaveProperty(botId)

      // Game leaderboard
      const gameScores: Record<string, number> = {}
      for (const id of humanPlayerIds) {
        gameScores[id] = (round2Scores.deltas[id] ?? 0) + (round3Scores.deltas[id] ?? 0)
      }
      const leaderboard = battleBotsPlugin.computeGameLeaderboard(players, gameScores)
      const leaderboardIds = leaderboard.map((e) => e.playerId)
      expect(leaderboardIds).not.toContain(botId)
    })
  })
})
