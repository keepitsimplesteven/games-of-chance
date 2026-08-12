import { describe, it, expect, beforeEach } from "vitest"
import type { GameSettings } from "@games-of-chance/shared"
import {
  battleBotsPlugin,
  resetGameState,
  getGameState,
} from "../BattleBotsPlugin"
import type { BattleBotsRoundResult } from "../BattleBotsPlugin"
import type { FFABracketState, FinalRanking, BattleBotsPick } from "../types"
import { BATTLE_BOTS } from "../constants"

const defaultSettings: GameSettings = {
  roundCount: 3,
  pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,
  tuning: {
    PREP_TIMER_MS: "60",
    CHIPS_MULTIPLIER: "10",
    GAME_SPEED: "100",
  },
}

describe("Integration: Single player game", () => {
  beforeEach(() => {
    resetGameState()
  })

  it("creates a bot persona for the solo player", () => {
    // Round 1: single player picks parts
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
    }
    const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(result.round).toBe(1)

    const state = getGameState()!
    // Bot persona created for solo player
    expect(state.botPersonas).toHaveLength(1)
    expect(state.botPersonas[0].id).toMatch(/^bot_/)
    expect(state.botPersonas[0].isBot).toBe(true)
    expect(state.botPersonas[0].name).toMatch(/^MechBot-\d+$/)
    // 2 total participants: player + bot persona
    expect(state.participants).toHaveLength(2)
    expect(state.participants).toContain("p1")
    expect(state.participants).toContain(state.botPersonas[0].id)
  })

  it("pairs the player with the bot persona in Round 2 (1v1)", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
    }
    // Round 1
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    // Round 2
    const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(result.round).toBe(2)

    const state = getGameState()!
    const botId = state.botPersonas[0].id

    // Should have exactly 1 pairing: p1 vs bot persona
    expect(state.pairings).toHaveLength(1)
    const pairing = state.pairings[0]
    const pairingIds = [pairing.player1Id, pairing.player2Id]
    expect(pairingIds).toContain("p1")
    expect(pairingIds).toContain(botId)

    // Battle should have resolved with a winner and loser
    expect(pairing.winnerId).not.toBeNull()
    expect(pairing.loserId).not.toBeNull()
    expect(pairing.tickLog.length).toBeGreaterThan(0)
  })

  it("gives the human player rank 1 or 2 in final rankings", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
    }
    // Round 1
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    // Round 2
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    // Round 3
    const result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(result.round).toBe(3)

    const state = getGameState()!
    const botId = state.botPersonas[0].id
    const finalRankings = result.finalRankings as FinalRanking[]

    // Should have rankings for both participants
    expect(finalRankings).toHaveLength(2)

    // Winners bracket has 1 robot (the Round 2 winner) — auto-win
    const winnersBracket = result.winnersBracket as FFABracketState
    expect(winnersBracket.participantIds).toHaveLength(1)
    expect(winnersBracket.tickLog).toHaveLength(0) // single robot = no FFA needed

    // Losers bracket has 1 robot (the Round 2 loser) — auto-win
    const losersBracket = result.losersBracket as FFABracketState
    expect(losersBracket.participantIds).toHaveLength(1)
    expect(losersBracket.tickLog).toHaveLength(0)

    // The human player's ranking
    const humanRanking = finalRankings.find((r) => r.playerId === "p1")!
    expect(humanRanking).toBeDefined()
    expect(humanRanking.rank).toBeGreaterThanOrEqual(1)
    expect(humanRanking.rank).toBeLessThanOrEqual(2)

    // The bot persona's ranking
    const botRanking = finalRankings.find((r) => r.playerId === botId)!
    expect(botRanking).toBeDefined()
    expect(botRanking.isBot).toBe(true)

    // The winner of 1v1 is in winners bracket, loser in losers bracket
    const winnerId = state.pairings[0].winnerId!
    const winnerRanking = finalRankings.find((r) => r.playerId === winnerId)!
    expect(winnerRanking.bracket).toBe("winners")

    const loserId = state.pairings[0].loserId!
    const loserRanking = finalRankings.find((r) => r.playerId === loserId)!
    expect(loserRanking.bracket).toBe("losers")
  })

  it("completes full 3-round lifecycle with correct state transitions", () => {
    const picks: Record<string, BattleBotsPick> = {
      p1: { weapon: "drill", head: "square", body: "square" },
    }

    // Round 1: Prep Phase
    const round1Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(round1Result.round).toBe(1)
    const state = getGameState()!
    expect(state.builds!["p1"]).toBeDefined()
    expect(state.builds![state.botPersonas[0].id]).toBeDefined()

    // Round 2: 1v1 Battles
    const round2Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(round2Result.round).toBe(2)
    expect(state.pairings).toHaveLength(1)
    expect(state.pairings[0].winnerId).not.toBeNull()

    // Round 3: FFA (auto-win for both single-participant brackets)
    const round3Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(round3Result.round).toBe(3)
    expect(state.finalRankings).toHaveLength(2)
    expect(state.winnersBracket).not.toBeNull()
    expect(state.losersBracket).not.toBeNull()
  })
})
