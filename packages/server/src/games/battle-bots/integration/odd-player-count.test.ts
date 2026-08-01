import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState } from "../BattleBotsPlugin"
import type { BattleBotsRoundResult } from "../BattleBotsPlugin"
import type { GameSettings } from "@games-of-chance/shared"
import type { FFABracket, FinalRanking } from "../types"

/**
 * Integration test: Odd player count (3 players)
 * Validates: Requirements 3.4, 4.1
 *
 * - Verifies bot persona added to make 4 participants
 * - Verifies 2 pairings created with even count
 * - Verifies correct bracket sizes (2 winners, 2 losers)
 */
describe("Integration: Odd player count (3 players)", () => {
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

  const threePlayers = {
    p1: { robotTemplateId: "bot-alpha" },
    p2: { robotTemplateId: "bot-beta" },
    p3: { robotTemplateId: "bot-gamma" },
  }

  beforeEach(() => {
    resetGameState()
  })

  it("Round 1: adds 1 bot persona to make 4 participants from 3 players", () => {
    // Round 1 with 3 player picks
    const result = battleBotsPlugin.resolveRound(threePlayers, defaultSettings) as BattleBotsRoundResult

    const state = getGameState()!

    // Verify bot persona was created
    expect(state.botPersonas).toHaveLength(1)
    expect(state.botPersonas[0].id).toMatch(/^bot_/)
    expect(state.botPersonas[0].isBot).toBe(true)

    // Verify total participants is now 4 (3 players + 1 bot)
    expect(state.participants).toHaveLength(4)
    expect(state.participants).toContain("p1")
    expect(state.participants).toContain("p2")
    expect(state.participants).toContain("p3")
    expect(state.participants).toContain(state.botPersonas[0].id)
  })

  it("Round 2: creates 2 pairings from 4 participants", () => {
    // Round 1
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)
    // Round 2
    const result = battleBotsPlugin.resolveRound(threePlayers, defaultSettings) as BattleBotsRoundResult

    const state = getGameState()!

    // 4 participants / 2 = 2 pairings
    expect(state.pairings).toHaveLength(2)

    // Each pairing should have a winner and loser decided
    for (const pairing of state.pairings) {
      expect(pairing.winnerId).not.toBeNull()
      expect(pairing.loserId).not.toBeNull()
    }

    // Every participant should appear in exactly one pairing
    const allParticipantsInPairings = state.pairings.flatMap((p) => [p.player1Id, p.player2Id])
    expect(allParticipantsInPairings.sort()).toEqual([...state.participants].sort())
  })

  it("Round 3: creates correct bracket sizes (2 winners, 2 losers)", () => {
    // Round 1
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)
    // Round 2
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)
    // Round 3
    const result = battleBotsPlugin.resolveRound(threePlayers, defaultSettings) as BattleBotsRoundResult

    const state = getGameState()!

    const winnersBracket = result.winnersBracket as FFABracket
    const losersBracket = result.losersBracket as FFABracket

    // 2 pairings → 2 winners + 2 losers
    expect(winnersBracket.participants).toHaveLength(2)
    expect(losersBracket.participants).toHaveLength(2)

    expect(winnersBracket.id).toBe("winners")
    expect(losersBracket.id).toBe("losers")
  })

  it("produces final rankings with 4 entries total", () => {
    // Round 1
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)
    // Round 2
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)
    // Round 3
    battleBotsPlugin.resolveRound(threePlayers, defaultSettings)

    const state = getGameState()!

    // Final rankings should cover all 4 participants (3 players + 1 bot)
    expect(state.finalRankings).toHaveLength(4)

    // All ranks should be between 1 and 4
    for (const ranking of state.finalRankings) {
      expect(ranking.rank).toBeGreaterThanOrEqual(1)
      expect(ranking.rank).toBeLessThanOrEqual(4)
    }

    // Exactly 1 bot persona in rankings
    const botRankings = state.finalRankings.filter((r) => r.isBot)
    expect(botRankings).toHaveLength(1)

    // 3 human players in rankings
    const humanRankings = state.finalRankings.filter((r) => !r.isBot)
    expect(humanRankings).toHaveLength(3)

    // Winners bracket rankings should be better (lower) than losers bracket
    const winnersRanks = state.finalRankings
      .filter((r) => r.bracket === "winners")
      .map((r) => r.rank)
    const losersRanks = state.finalRankings
      .filter((r) => r.bracket === "losers")
      .map((r) => r.rank)

    expect(Math.max(...winnersRanks)).toBeLessThanOrEqual(Math.min(...losersRanks))
  })
})
