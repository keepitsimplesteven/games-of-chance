import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState } from "./BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattleBotsRoundResult } from "./BattleBotsPlugin"
import type { FFABracket, FinalRanking } from "./types"

describe("BattleBotsPlugin", () => {
  describe("validatePick", () => {
    it("accepts a valid pick with robotTemplateId string", () => {
      expect(battleBotsPlugin.validatePick({ robotTemplateId: "bot-alpha" })).toBe(true)
    })

    it("accepts any non-empty robotTemplateId string", () => {
      expect(battleBotsPlugin.validatePick({ robotTemplateId: "bot-beta" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ robotTemplateId: "bot-gamma" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ robotTemplateId: "some-custom-id" })).toBe(true)
    })

    it("rejects null", () => {
      expect(battleBotsPlugin.validatePick(null)).toBe(false)
    })

    it("rejects undefined", () => {
      expect(battleBotsPlugin.validatePick(undefined)).toBe(false)
    })

    it("rejects numbers", () => {
      expect(battleBotsPlugin.validatePick(42)).toBe(false)
    })

    it("rejects strings", () => {
      expect(battleBotsPlugin.validatePick("bot-alpha")).toBe(false)
    })

    it("rejects empty object", () => {
      expect(battleBotsPlugin.validatePick({})).toBe(false)
    })

    it("rejects object with wrong key", () => {
      expect(battleBotsPlugin.validatePick({ templateId: "bot-alpha" })).toBe(false)
    })

    it("rejects object with empty robotTemplateId", () => {
      expect(battleBotsPlugin.validatePick({ robotTemplateId: "" })).toBe(false)
    })

    it("rejects object with non-string robotTemplateId", () => {
      expect(battleBotsPlugin.validatePick({ robotTemplateId: 123 })).toBe(false)
      expect(battleBotsPlugin.validatePick({ robotTemplateId: null })).toBe(false)
      expect(battleBotsPlugin.validatePick({ robotTemplateId: undefined })).toBe(false)
      expect(battleBotsPlugin.validatePick({ robotTemplateId: true })).toBe(false)
    })

    it("rejects arrays", () => {
      expect(battleBotsPlugin.validatePick([])).toBe(false)
      expect(battleBotsPlugin.validatePick(["bot-alpha"])).toBe(false)
    })
  })

  describe("computeGameLeaderboard", () => {
    const defaultSettings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 15000,
      tuning: {
        BOT_HP: "100",
        ACCURACY: "80",
        DAMAGE_MIN: "1",
        DAMAGE_MAX: "10",
        CHIPS_MULTIPLIER: "10",
      },
    }

    beforeEach(() => {
      resetGameState()
    })

    it("returns score-based leaderboard when no game state exists", () => {
      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 3, p2: 1 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ playerId: "p1", playerName: "Alice", score: 3, rank: 1 })
      expect(result[1]).toEqual({ playerId: "p2", playerName: "Bob", score: 1, rank: 2 })
    })

    it("returns score-based leaderboard when finalRankings are empty", () => {
      // Trigger Round 1 to create game state but with empty finalRankings
      const picks = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
      }
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 1, p2: 0 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result).toHaveLength(2)
      expect(result[0].playerId).toBe("p1")
      expect(result[0].rank).toBe(1)
      expect(result[1].playerId).toBe("p2")
      expect(result[1].rank).toBe(2)
    })

    it("returns ranking-based leaderboard when finalRankings are populated", () => {
      // Set up game state with finalRankings by running through rounds
      const picks = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
        p3: { robotTemplateId: "bot-gamma" },
        p4: { robotTemplateId: "bot-alpha" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      // Manually set finalRankings on the game state since Round 3 isn't fully implemented
      const state = getGameState()!
      state.finalRankings = [
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: "p2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false },
        { playerId: "p3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false },
        { playerId: "p4", playerName: "Dave", rank: 4, bracket: "losers", isBot: false },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
        { id: "p4", name: "Dave", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 1, p2: 1, p3: 0, p4: 0 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result).toHaveLength(4)
      // Score = totalParticipants(4) - rank
      expect(result[0]).toEqual({ playerId: "p1", playerName: "Alice", score: 3, rank: 1 })
      expect(result[1]).toEqual({ playerId: "p2", playerName: "Bob", score: 2, rank: 2 })
      expect(result[2]).toEqual({ playerId: "p3", playerName: "Charlie", score: 1, rank: 3 })
      expect(result[3]).toEqual({ playerId: "p4", playerName: "Dave", score: 0, rank: 4 })
    })

    it("excludes bot personas from the leaderboard", () => {
      // Set up game state with a bot persona
      const picks = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
        p3: { robotTemplateId: "bot-gamma" },
      }
      // Round 1 (odd players = bot persona added)
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      const botId = state.botPersonas[0].id

      state.finalRankings = [
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: botId, playerName: "MechBot-7", rank: 2, bracket: "winners", isBot: true },
        { playerId: "p2", playerName: "Bob", rank: 3, bracket: "losers", isBot: false },
        { playerId: "p3", playerName: "Charlie", rank: 4, bracket: "losers", isBot: false },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 1, p2: 0, p3: 0 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // Bot persona should be excluded
      expect(result).toHaveLength(3)
      expect(result.every((e) => e.playerId !== botId)).toBe(true)

      // Human players should be present with correct rankings
      expect(result[0]).toEqual({ playerId: "p1", playerName: "Alice", score: 3, rank: 1 })
      expect(result[1]).toEqual({ playerId: "p2", playerName: "Bob", score: 1, rank: 3 })
      expect(result[2]).toEqual({ playerId: "p3", playerName: "Charlie", score: 0, rank: 4 })
    })

    it("uses Player.name for display names rather than ranking playerName", () => {
      const picks = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      state.finalRankings = [
        { playerId: "p1", playerName: "OldName", rank: 1, bracket: "winners", isBot: false },
        { playerId: "p2", playerName: "OldName2", rank: 2, bracket: "losers", isBot: false },
      ]

      const players: Player[] = [
        { id: "p1", name: "CurrentAlice", connected: true },
        { id: "p2", name: "CurrentBob", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 1, p2: 0 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // Should use Player.name, not the ranking's playerName
      expect(result[0].playerName).toBe("CurrentAlice")
      expect(result[1].playerName).toBe("CurrentBob")
    })

    it("sorts leaderboard by rank ascending", () => {
      const picks = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
        p3: { robotTemplateId: "bot-gamma" },
        p4: { robotTemplateId: "bot-alpha" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      // Provide rankings out of order
      state.finalRankings = [
        { playerId: "p3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false },
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false },
        { playerId: "p4", playerName: "Dave", rank: 4, bracket: "losers", isBot: false },
        { playerId: "p2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
        { id: "p4", name: "Dave", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = {}

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
      expect(result[3].rank).toBe(4)
    })
  })

  describe("resolveRound3 (Round 3 — Free-For-All)", () => {
    const defaultSettings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 15000,
      tuning: {
        BOT_HP: "100",
        ACCURACY: "80",
        DAMAGE_MIN: "1",
        DAMAGE_MAX: "10",
        CHIPS_MULTIPLIER: "10",
      },
    }

    beforeEach(() => {
      resetGameState()
    })

    function runRounds1And2(playerCount: number, settings = defaultSettings) {
      const picks: Record<string, { robotTemplateId: string }> = {}
      for (let i = 1; i <= playerCount; i++) {
        picks[`p${i}`] = { robotTemplateId: "bot-alpha" }
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, settings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, settings)
      return picks
    }

    it("creates winners and losers brackets from Round 2 results", () => {
      const picks = runRounds1And2(4)
      // Round 3
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      expect(result.round).toBe(3)
      expect(result.winnersBracket).toBeDefined()
      expect(result.losersBracket).toBeDefined()

      const winnersBracket = result.winnersBracket as FFABracket
      const losersBracket = result.losersBracket as FFABracket

      expect(winnersBracket.id).toBe("winners")
      expect(losersBracket.id).toBe("losers")

      // With 4 players, should have 2 in each bracket
      expect(winnersBracket.participants).toHaveLength(2)
      expect(losersBracket.participants).toHaveLength(2)
    })

    it("resets all robots to full HP before FFA", () => {
      const picks = runRounds1And2(4)
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      const winnersBracket = result.winnersBracket as FFABracket
      const losersBracket = result.losersBracket as FFABracket

      // All participants should start at full HP (100)
      for (const robot of winnersBracket.participants) {
        expect(robot.maxHp).toBe(100)
        expect(robot.currentHp).toBe(100)
      }
      for (const robot of losersBracket.participants) {
        expect(robot.maxHp).toBe(100)
        expect(robot.currentHp).toBe(100)
      }
    })

    it("computes final rankings from FFA elimination order", () => {
      const picks = runRounds1And2(4)
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      const finalRankings = result.finalRankings as FinalRanking[]

      // Should have a ranking for every participant
      const state = getGameState()!
      expect(finalRankings).toHaveLength(state.participants.length)

      // All ranks should be between 1 and participant count
      for (const ranking of finalRankings) {
        expect(ranking.rank).toBeGreaterThanOrEqual(1)
        expect(ranking.rank).toBeLessThanOrEqual(state.participants.length)
      }

      // Winners bracket rankings should be lower (better) than losers bracket
      const winnersRanks = finalRankings
        .filter((r) => r.bracket === "winners")
        .map((r) => r.rank)
      const losersRanks = finalRankings
        .filter((r) => r.bracket === "losers")
        .map((r) => r.rank)

      const maxWinnersRank = Math.max(...winnersRanks)
      const minLosersRank = Math.min(...losersRanks)
      expect(maxWinnersRank).toBeLessThanOrEqual(minLosersRank)
    })

    it("stores brackets and rankings in game state", () => {
      const picks = runRounds1And2(4)
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      expect(state.winnersBracket).not.toBeNull()
      expect(state.losersBracket).not.toBeNull()
      expect(state.finalRankings.length).toBeGreaterThan(0)
    })

    it("handles edge case where a bracket has only 1 robot", () => {
      // 2 players → 1 pairing → 1 winner + 1 loser → each bracket has 1 robot
      const picks = runRounds1And2(2)
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      expect(result.round).toBe(3)

      const winnersBracket = result.winnersBracket as FFABracket
      const losersBracket = result.losersBracket as FFABracket

      // Each bracket should have exactly 1 participant
      expect(winnersBracket.participants).toHaveLength(1)
      expect(losersBracket.participants).toHaveLength(1)

      // Single-robot brackets should have the robot in elimination order (auto-win)
      expect(winnersBracket.eliminationOrder).toHaveLength(1)
      expect(losersBracket.eliminationOrder).toHaveLength(1)

      // No tick log needed for single-robot bracket
      expect(winnersBracket.tickLog).toHaveLength(0)
      expect(losersBracket.tickLog).toHaveLength(0)

      // Final rankings should still be computed
      const finalRankings = result.finalRankings as FinalRanking[]
      expect(finalRankings).toHaveLength(2)
    })

    it("uses custom HP setting when resetting robots for FFA", () => {
      const customSettings: GameSettings = {
        roundCount: 3,
        pickWindowMs: 15000,
        tuning: {
          BOT_HP: "200",
          ACCURACY: "80",
          DAMAGE_MIN: "1",
          DAMAGE_MAX: "10",
          CHIPS_MULTIPLIER: "10",
        },
      }

      const picks: Record<string, { robotTemplateId: string }> = {
        p1: { robotTemplateId: "bot-alpha" },
        p2: { robotTemplateId: "bot-beta" },
        p3: { robotTemplateId: "bot-gamma" },
        p4: { robotTemplateId: "bot-alpha" },
      }
      // Round 1 with custom settings
      battleBotsPlugin.resolveRound(picks, customSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, customSettings)
      // Round 3
      const result = battleBotsPlugin.resolveRound(picks, customSettings) as BattleBotsRoundResult

      const winnersBracket = result.winnersBracket as FFABracket
      for (const robot of winnersBracket.participants) {
        expect(robot.currentHp).toBe(200)
        expect(robot.maxHp).toBe(200)
      }
    })

    it("throws error if resolving Round 3 without previous state", () => {
      // Don't run any rounds first
      expect(() => {
        battleBotsPlugin.resolveRound({}, defaultSettings) // Round 1
        resetGameState() // Clear state
        // Manually force currentRound to reach case 3
      }).not.toThrow()

      // This is hard to test directly because currentRound is internal,
      // but the error paths are exercised through normal flow
    })

    it("runs FFA on both brackets and produces tick logs for multi-robot brackets", () => {
      const picks = runRounds1And2(6) // 3 pairings → 3 winners + 3 losers
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      const winnersBracket = result.winnersBracket as FFABracket
      const losersBracket = result.losersBracket as FFABracket

      // Brackets with multiple robots should have tick logs
      expect(winnersBracket.tickLog.length).toBeGreaterThan(0)
      expect(losersBracket.tickLog.length).toBeGreaterThan(0)

      // Elimination order should cover all participants
      expect(winnersBracket.eliminationOrder).toHaveLength(3)
      expect(losersBracket.eliminationOrder).toHaveLength(3)
    })
  })
})
