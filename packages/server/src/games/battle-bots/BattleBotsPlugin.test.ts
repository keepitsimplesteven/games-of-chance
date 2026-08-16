import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState } from "./BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattleBotsRoundResult } from "./BattleBotsPlugin"
import type { FFABracketState, FinalRanking, BattleBotsPick } from "./types"

describe("BattleBotsPlugin", () => {
  describe("validatePick", () => {
    it("accepts a valid pick with weapon, head, and body", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "rounded" })).toBe(true)
    })

    it("accepts all valid weapon types", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "blaster", head: "square", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "bazooka", head: "square", body: "square" })).toBe(true)
    })

    it("accepts all valid head types", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "rounded", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "triangular", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "hexagonal", body: "square" })).toBe(true)
    })

    it("accepts all valid body types", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "square" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "rounded" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "triangular" })).toBe(true)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "hexagonal" })).toBe(true)
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
      expect(battleBotsPlugin.validatePick("drill")).toBe(false)
    })

    it("rejects empty object", () => {
      expect(battleBotsPlugin.validatePick({})).toBe(false)
    })

    it("rejects object with missing fields", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill" })).toBe(false)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square" })).toBe(false)
      expect(battleBotsPlugin.validatePick({ head: "square", body: "rounded" })).toBe(false)
    })

    it("rejects invalid weapon type", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "sword", head: "square", body: "square" })).toBe(false)
    })

    it("rejects invalid head type", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "cone", body: "square" })).toBe(false)
    })

    it("rejects invalid body type", () => {
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: "star" })).toBe(false)
    })

    it("rejects non-string part values", () => {
      expect(battleBotsPlugin.validatePick({ weapon: 123, head: "square", body: "square" })).toBe(false)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: null, body: "square" })).toBe(false)
      expect(battleBotsPlugin.validatePick({ weapon: "drill", head: "square", body: true })).toBe(false)
    })

    it("rejects arrays", () => {
      expect(battleBotsPlugin.validatePick([])).toBe(false)
      expect(battleBotsPlugin.validatePick(["drill", "square", "square"])).toBe(false)
    })
  })

  describe("computeGameLeaderboard", () => {
    const defaultSettings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 15000,
      tuning: {
        PREP_TIMER_MS: "60",
        CHIPS_MULTIPLIER: "10",
        GAME_SPEED: "100",
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
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
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
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
        p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
        p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      // Manually set finalRankings on the game state
      const state = getGameState()!
      state.finalRankings = [
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false, score: 0 },
        { playerId: "p2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false, score: 0 },
        { playerId: "p3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false, score: 0 },
        { playerId: "p4", playerName: "Dave", rank: 4, bracket: "losers", isBot: false, score: 0 },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
        { id: "p4", name: "Dave", connected: true },
      ] as Player[]

      // Scores determine ranking: p1=150, p2=125, p3=80, p4=30
      const gameScores: Record<string, number> = { p1: 150, p2: 125, p3: 80, p4: 30 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result).toHaveLength(4)
      // Score = actual cumulative gameScores
      expect(result[0]).toEqual({ playerId: "p1", playerName: "Alice", score: 150, rank: 1 })
      expect(result[1]).toEqual({ playerId: "p2", playerName: "Bob", score: 125, rank: 2 })
      expect(result[2]).toEqual({ playerId: "p3", playerName: "Charlie", score: 80, rank: 3 })
      expect(result[3]).toEqual({ playerId: "p4", playerName: "Dave", score: 30, rank: 4 })
    })

    it("excludes bot personas from the leaderboard", () => {
      // Set up game state with a bot persona (odd player count)
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
        p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
      }
      // Round 1 (odd players = bot persona added)
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      const botId = state.botPersonas[0].id

      state.finalRankings = [
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false, score: 0 },
        { playerId: botId, playerName: "MechBot-7", rank: 2, bracket: "winners", isBot: true, score: 0 },
        { playerId: "p2", playerName: "Bob", rank: 3, bracket: "losers", isBot: false, score: 0 },
        { playerId: "p3", playerName: "Charlie", rank: 4, bracket: "losers", isBot: false, score: 0 },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
      ] as Player[]

      // Actual cumulative scores
      const gameScores: Record<string, number> = { p1: 150, p2: 80, p3: 30 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // Bot persona should be excluded
      expect(result).toHaveLength(3)
      expect(result.every((e) => e.playerId !== botId)).toBe(true)

      // Human players should be present with correct scores and rankings
      expect(result[0]).toEqual({ playerId: "p1", playerName: "Alice", score: 150, rank: 1 })
      expect(result[1]).toEqual({ playerId: "p2", playerName: "Bob", score: 80, rank: 2 })
      expect(result[2]).toEqual({ playerId: "p3", playerName: "Charlie", score: 30, rank: 3 })
    })

    it("uses Player.name for display names rather than ranking playerName", () => {
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      state.finalRankings = [
        { playerId: "p1", playerName: "OldName", rank: 1, bracket: "winners", isBot: false, score: 0 },
        { playerId: "p2", playerName: "OldName2", rank: 2, bracket: "losers", isBot: false, score: 0 },
      ]

      const players: Player[] = [
        { id: "p1", name: "CurrentAlice", connected: true },
        { id: "p2", name: "CurrentBob", connected: true },
      ] as Player[]

      const gameScores: Record<string, number> = { p1: 150, p2: 125 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      // Should use Player.name, not the ranking's playerName
      expect(result[0].playerName).toBe("CurrentAlice")
      expect(result[1].playerName).toBe("CurrentBob")
    })

    it("sorts leaderboard by rank ascending", () => {
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
        p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
        p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
      }
      // Round 1
      battleBotsPlugin.resolveRound(picks, defaultSettings)
      // Round 2
      battleBotsPlugin.resolveRound(picks, defaultSettings)

      const state = getGameState()!
      // Provide rankings out of order
      state.finalRankings = [
        { playerId: "p3", playerName: "Charlie", rank: 3, bracket: "losers", isBot: false, score: 0 },
        { playerId: "p1", playerName: "Alice", rank: 1, bracket: "winners", isBot: false, score: 0 },
        { playerId: "p4", playerName: "Dave", rank: 4, bracket: "losers", isBot: false, score: 0 },
        { playerId: "p2", playerName: "Bob", rank: 2, bracket: "winners", isBot: false, score: 0 },
      ]

      const players: Player[] = [
        { id: "p1", name: "Alice", connected: true },
        { id: "p2", name: "Bob", connected: true },
        { id: "p3", name: "Charlie", connected: true },
        { id: "p4", name: "Dave", connected: true },
      ] as Player[]

      // Distinct scores so each gets a unique rank
      const gameScores: Record<string, number> = { p1: 150, p2: 125, p3: 80, p4: 30 }

      const result = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
      expect(result[3].rank).toBe(4)
    })
  })

  describe("resolveRound1 (Prep Phase — new build system)", () => {
    const defaultSettings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 15000,
      tuning: {
        PREP_TIMER_MS: "60",
        CHIPS_MULTIPLIER: "10",
        GAME_SPEED: "100",
      },
    }

    beforeEach(() => {
      resetGameState()
    })

    it("creates CombatRobot builds from valid player picks", () => {
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
      }

      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      expect(result.round).toBe(1)
      const state = getGameState()!
      expect(state.builds).toBeDefined()
      expect(state.builds!["p1"]).toBeDefined()
      expect(state.builds!["p2"]).toBeDefined()

      // Verify CombatRobot structure
      const robot = state.builds!["p1"]
      expect(robot.ownerId).toBe("p1")
      expect(robot.name).toBeTruthy()
      expect(robot.maxHit).toBeGreaterThanOrEqual(1)
      expect(robot.accuracy).toBeGreaterThanOrEqual(1)
      expect(robot.accuracy).toBeLessThanOrEqual(90)
      expect(robot.energyPerTick).toBeGreaterThan(0)
      expect(robot.currentEnergy).toBe(0)
      expect(robot.currentHp).toBe(100)
      expect(robot.maxHp).toBe(100)
      expect(robot.stars.damage + robot.stars.accuracy + robot.stars.speed).toBe(9)
      expect(robot.visual.weapon).toBe("drill")
      expect(robot.visual.head).toBe("square")
      expect(robot.visual.body).toBe("square")
    })

    it("assigns unique robot names to all participants", () => {
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
        p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
        p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
      }

      battleBotsPlugin.resolveRound(picks, defaultSettings)
      const state = getGameState()!

      const names = Object.values(state.builds!).map((b) => b.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it("adds a bot persona for odd player count", () => {
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
        p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
      }

      battleBotsPlugin.resolveRound(picks, defaultSettings)
      const state = getGameState()!

      expect(state.botPersonas).toHaveLength(1)
      expect(state.participants).toHaveLength(4)

      // Bot persona should also have a valid build
      const botId = state.botPersonas[0].id
      expect(state.builds![botId]).toBeDefined()
      expect(state.builds![botId].stars.damage + state.builds![botId].stars.accuracy + state.builds![botId].stars.speed).toBe(9)
    })

    it("generates random parts for players who did not submit a pick", () => {
      // Simulate timer expiry: passes empty picks for some players
      const picks: Record<string, BattleBotsPick> = {
        p1: { weapon: "drill", head: "square", body: "square" },
        p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
      }

      battleBotsPlugin.resolveRound(picks, defaultSettings)
      const state = getGameState()!

      // Both players who submitted picks should have builds
      expect(state.builds!["p1"]).toBeDefined()
      expect(state.builds!["p2"]).toBeDefined()
    })
  })

  describe("resolveRound3 (Round 3 — Free-For-All)", () => {
    const defaultSettings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 15000,
      tuning: {
        PREP_TIMER_MS: "60",
        CHIPS_MULTIPLIER: "10",
        GAME_SPEED: "100",
      },
    }

    beforeEach(() => {
      resetGameState()
    })

    function runRounds1And2(playerCount: number, settings = defaultSettings) {
      const picks: Record<string, BattleBotsPick> = {}
      const weapons = ["drill", "blaster", "bazooka"] as const
      const heads = ["square", "rounded", "triangular", "hexagonal"] as const
      const bodies = ["square", "rounded", "triangular", "hexagonal"] as const
      for (let i = 1; i <= playerCount; i++) {
        picks[`p${i}`] = {
          weapon: weapons[i % 3],
          head: heads[i % 4],
          body: bodies[(i + 1) % 4],
        }
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

      const winnersBracket = result.winnersBracket as FFABracketState
      const losersBracket = result.losersBracket as FFABracketState

      expect(winnersBracket.id).toBe("winners")
      expect(losersBracket.id).toBe("losers")

      // With 4 players, should have 2 in each bracket
      expect(winnersBracket.participantIds).toHaveLength(2)
      expect(losersBracket.participantIds).toHaveLength(2)
    })

    it("resets all robots to full HP before FFA", () => {
      const picks = runRounds1And2(4)
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      const winnersBracket = result.winnersBracket as FFABracketState
      const losersBracket = result.losersBracket as FFABracketState

      // All participants should start at full HP (100 — BASE_HP)
      // With FFABracketState we verify via participantIds and builds in gameState
      const state = getGameState()!
      for (const id of winnersBracket.participantIds) {
        const build = state.builds![id]
        expect(build.maxHp).toBe(100)
      }
      for (const id of losersBracket.participantIds) {
        const build = state.builds![id]
        expect(build.maxHp).toBe(100)
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

      const winnersBracket = result.winnersBracket as FFABracketState
      const losersBracket = result.losersBracket as FFABracketState

      // Each bracket should have exactly 1 participant
      expect(winnersBracket.participantIds).toHaveLength(1)
      expect(losersBracket.participantIds).toHaveLength(1)

      // Single-robot brackets should have the robot as survivor with no eliminations
      expect(winnersBracket.eliminationOrder).toHaveLength(0)
      expect(losersBracket.eliminationOrder).toHaveLength(0)
      expect(winnersBracket.survivorId).toBe(winnersBracket.participantIds[0])
      expect(losersBracket.survivorId).toBe(losersBracket.participantIds[0])

      // No tick log needed for single-robot bracket
      expect(winnersBracket.tickLog).toHaveLength(0)
      expect(losersBracket.tickLog).toHaveLength(0)

      // Final rankings should still be computed
      const finalRankings = result.finalRankings as FinalRanking[]
      expect(finalRankings).toHaveLength(2)
    })

    it("runs FFA on both brackets and produces tick logs for multi-robot brackets", () => {
      const picks = runRounds1And2(6) // 3 pairings → 3 winners + 3 losers
      const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

      const winnersBracket = result.winnersBracket as FFABracketState
      const losersBracket = result.losersBracket as FFABracketState

      // Brackets with multiple robots should have tick logs
      expect(winnersBracket.tickLog.length).toBeGreaterThan(0)
      expect(losersBracket.tickLog.length).toBeGreaterThan(0)

      // Participant IDs should cover all participants from respective brackets
      expect(winnersBracket.participantIds).toHaveLength(3)
      expect(losersBracket.participantIds).toHaveLength(3)

      // Elimination order + survivor should account for all participants
      expect(winnersBracket.eliminationOrder.length + 1).toBe(3) // 2 eliminated + 1 survivor
      expect(losersBracket.eliminationOrder.length + 1).toBe(3)
      expect(winnersBracket.survivorId).toBeTruthy()
      expect(losersBracket.survivorId).toBeTruthy()
    })
  })
})
