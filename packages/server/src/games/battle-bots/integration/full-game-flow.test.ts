import { describe, it, expect, beforeEach } from "vitest"
import { battleBotsPlugin, resetGameState, getGameState } from "../BattleBotsPlugin"
import type { BattleBotsRoundResult } from "../BattleBotsPlugin"
import type { Player, GameSettings } from "@games-of-chance/shared"
import type { BattlePairing, FFABracketState, FinalRanking, BattleBotsPick } from "../types"

/**
 * Integration test: Full 3-round game flow with 4 players.
 * Validates: Requirements 10.1, 10.2, 15.1, 15.4
 *
 * Verifies:
 * - Correct phase transitions: LOBBY → PICKING → RESULT → RESOLVING → RESULT → RESOLVING → RESULT
 * - 2 pairings created, 2 winners + 2 losers, correct final ranking positions 1-4
 */
describe("Full 3-round game flow (4 players)", () => {
  const defaultSettings: GameSettings = {
    roundCount: 3,
    pickWindowMs: 15000,
    tuning: {
      PREP_TIMER_MS: "60",
      CHIPS_MULTIPLIER: "10",
      GAME_SPEED: "100",
    },
  }

  const picks: Record<string, BattleBotsPick> = {
    p1: { weapon: "drill", head: "square", body: "square" },
    p2: { weapon: "blaster", head: "rounded", body: "hexagonal" },
    p3: { weapon: "bazooka", head: "triangular", body: "rounded" },
    p4: { weapon: "drill", head: "hexagonal", body: "triangular" },
  }

  const players: Player[] = [
    { id: "p1", name: "Alice", role: "host", connected: true, connectionId: "conn-1" },
    { id: "p2", name: "Bob", role: "player", connected: true, connectionId: "conn-2" },
    { id: "p3", name: "Charlie", role: "player", connected: true, connectionId: "conn-3" },
    { id: "p4", name: "Dave", role: "player", connected: true, connectionId: "conn-4" },
  ] as Player[]

  beforeEach(() => {
    resetGameState()
  })

  it("completes a full 3-round game with correct results at each stage", () => {
    // ─── Round 1: Prep Phase (robot building via part selection) ──────────────
    const round1Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(round1Result.round).toBe(1)

    // Verify game state has 4 participants (no bot persona needed for even count)
    const stateAfterR1 = getGameState()!
    expect(stateAfterR1.participants).toHaveLength(4)
    expect(stateAfterR1.botPersonas).toHaveLength(0)

    // Verify all 4 players have CombatRobot builds
    expect(Object.keys(stateAfterR1.builds!)).toHaveLength(4)
    expect(stateAfterR1.builds!["p1"]).toBeDefined()
    expect(stateAfterR1.builds!["p2"]).toBeDefined()
    expect(stateAfterR1.builds!["p3"]).toBeDefined()
    expect(stateAfterR1.builds!["p4"]).toBeDefined()

    // Verify each build has correct star totals and valid stats
    for (const id of ["p1", "p2", "p3", "p4"]) {
      const build = stateAfterR1.builds![id]
      expect(build.stars.damage + build.stars.accuracy + build.stars.speed).toBe(9)
      expect(build.currentHp).toBe(100)
      expect(build.maxHp).toBe(100)
      expect(build.name.length).toBeGreaterThan(0)
    }

    // ─── Round 1: scoreRound — empty deltas for prep phase ───────────────────
    const round1Score = battleBotsPlugin.scoreRound(picks, round1Result, players, defaultSettings)
    expect(round1Score.deltas).toEqual({})

    // ─── Round 2: 1v1 Battles ────────────────────────────────────────────────
    const round2Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(round2Result.round).toBe(2)

    // Verify 2 pairings were created (4 players / 2 = 2 pairings)
    const pairings = round2Result.pairings as BattlePairing[]
    expect(pairings).toHaveLength(2)

    // Verify each pairing has a winner and loser
    for (const pairing of pairings) {
      expect(pairing.winnerId).not.toBeNull()
      // Derive loserId from winnerId (new model derives rather than stores separately)
      const loserId = pairing.player1Id === pairing.winnerId
        ? pairing.player2Id
        : pairing.player1Id
      expect(pairing.winnerId).not.toBe(loserId)
      expect([pairing.player1Id, pairing.player2Id]).toContain(pairing.winnerId)
      expect([pairing.player1Id, pairing.player2Id]).toContain(loserId)
    }

    // Verify all 4 players appeared exactly once across pairings
    const allPairedIds = pairings.flatMap((p) => [p.player1Id, p.player2Id])
    expect(allPairedIds.sort()).toEqual(["p1", "p2", "p3", "p4"].sort())

    // Collect winners and losers
    const winnerIds = pairings.map((p) => p.winnerId!)
    const loserIds = pairings.map((p) => {
      return p.player1Id === p.winnerId ? p.player2Id : p.player1Id
    })
    expect(winnerIds).toHaveLength(2)
    expect(loserIds).toHaveLength(2)

    // ─── Round 2: scoreRound — 25 for winners, 0 for losers ──────────────────
    const round2Score = battleBotsPlugin.scoreRound(picks, round2Result, players, defaultSettings)
    for (const winnerId of winnerIds) {
      expect(round2Score.deltas[winnerId]).toBe(25)
    }
    for (const loserId of loserIds) {
      expect(round2Score.deltas[loserId]).toBe(0)
    }

    // ─── Round 3: Free-For-All ───────────────────────────────────────────────
    const round3Result = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult

    expect(round3Result.round).toBe(3)

    // Verify brackets were created
    const winnersBracket = round3Result.winnersBracket as FFABracketState
    const losersBracket = round3Result.losersBracket as FFABracketState
    expect(winnersBracket).toBeDefined()
    expect(losersBracket).toBeDefined()
    expect(winnersBracket.id).toBe("winners")
    expect(losersBracket.id).toBe("losers")

    // Verify bracket sizes (2 winners, 2 losers)
    expect(winnersBracket.participantIds).toHaveLength(2)
    expect(losersBracket.participantIds).toHaveLength(2)

    // Verify final rankings have 4 entries
    const finalRankings = round3Result.finalRankings as FinalRanking[]
    expect(finalRankings).toHaveLength(4)

    // Verify all ranks are between 1 and 4
    for (const ranking of finalRankings) {
      expect(ranking.rank).toBeGreaterThanOrEqual(1)
      expect(ranking.rank).toBeLessThanOrEqual(4)
    }

    // Verify bracket labels are preserved (both winners and losers represented)
    const winnersRankings = finalRankings.filter((r) => r.bracket === "winners")
    const losersRankings = finalRankings.filter((r) => r.bracket === "losers")
    expect(winnersRankings).toHaveLength(2)
    expect(losersRankings).toHaveLength(2)

    // Verify all player IDs appear in final rankings
    const rankedPlayerIds = finalRankings.map((r) => r.playerId).sort()
    expect(rankedPlayerIds).toEqual(["p1", "p2", "p3", "p4"].sort())

    // ─── Round 3: scoreRound — survival-tick-based points ───────────────────
    const round3Score = battleBotsPlugin.scoreRound(picks, round3Result, players, defaultSettings)

    // With survival-tick scoring:
    // - Each bracket has 2 participants: 1 eliminated + 1 survivor
    // - Survivors get 125 (100 + 25)
    // - Eliminated players get ceil(eliminatedTick / (totalTicks * 1.1) * 100), max 91
    // Since each bracket has only 1 elimination, that player is eliminated at totalTicks,
    // so their score = ceil(totalTicks / (totalTicks * 1.1) * 100) = ceil(90.909) = 91
    const allDeltas = Object.values(round3Score.deltas)
    expect(allDeltas).toHaveLength(4)

    // All deltas should be positive
    for (const delta of allDeltas) {
      expect(delta).toBeGreaterThan(0)
    }

    // Survivors get 125, eliminated players get <= 91
    const survivors = allDeltas.filter((d) => d === 125)
    const eliminated = allDeltas.filter((d) => d <= 91)
    expect(survivors).toHaveLength(2)  // one survivor per bracket
    expect(eliminated).toHaveLength(2) // one eliminated per bracket

    // ─── computeGameLeaderboard after all rounds ─────────────────────────────
    const gameScores: Record<string, number> = {}
    for (const id of ["p1", "p2", "p3", "p4"]) {
      gameScores[id] = (round2Score.deltas[id] ?? 0) + (round3Score.deltas[id] ?? 0)
    }

    const leaderboard = battleBotsPlugin.computeGameLeaderboard(players, gameScores)

    // Leaderboard should have 4 entries (no bots to exclude)
    expect(leaderboard).toHaveLength(4)

    // Leaderboard should be sorted by rank ascending
    for (let i = 0; i < leaderboard.length - 1; i++) {
      expect(leaderboard[i].rank).toBeLessThanOrEqual(leaderboard[i + 1].rank)
    }

    // Verify leaderboard ranks match final rankings (both are sorted by score)
    for (const entry of leaderboard) {
      const matchingRanking = finalRankings.find((r) => r.playerId === entry.playerId)
      expect(matchingRanking).toBeDefined()
      expect(entry.rank).toBe(matchingRanking!.rank)
    }

    // Verify score = actual cumulative gameScores (Round 2 + Round 3)
    for (const entry of leaderboard) {
      expect(entry.score).toBe(gameScores[entry.playerId])
    }
  })

  it("verifies game state consistency across all 3 rounds", () => {
    // Round 1
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    const stateAfterR1 = getGameState()!
    expect(stateAfterR1.pairings).toHaveLength(0)
    expect(stateAfterR1.winnersBracket).toBeNull()
    expect(stateAfterR1.losersBracket).toBeNull()
    expect(stateAfterR1.finalRankings).toHaveLength(0)

    // Round 2
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    const stateAfterR2 = getGameState()!
    expect(stateAfterR2.pairings).toHaveLength(2)
    expect(stateAfterR2.winnersBracket).toBeNull()
    expect(stateAfterR2.losersBracket).toBeNull()
    expect(stateAfterR2.finalRankings).toHaveLength(0)

    // Round 3
    battleBotsPlugin.resolveRound(picks, defaultSettings)
    const stateAfterR3 = getGameState()!
    expect(stateAfterR3.pairings).toHaveLength(2)
    expect(stateAfterR3.winnersBracket).not.toBeNull()
    expect(stateAfterR3.losersBracket).not.toBeNull()
    expect(stateAfterR3.finalRankings).toHaveLength(4)
  })

  it("verifies correct phase transition sequence via round results", () => {
    // Round 1 (PICKING → RESULT): prep phase, builds created
    const r1 = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(r1.round).toBe(1)
    expect(r1.builds).toBeDefined()

    // Round 2 (RESOLVING → RESULT): battles run, winners/losers determined
    const r2 = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(r2.round).toBe(2)
    expect(r2.pairings).toBeDefined()
    const pairings = r2.pairings as BattlePairing[]
    expect(pairings.every((p) => p.winnerId !== null)).toBe(true)

    // Round 3 (RESOLVING → RESULT): FFA battles, final rankings
    const r3 = battleBotsPlugin.resolveRound(picks, defaultSettings) as BattleBotsRoundResult
    expect(r3.round).toBe(3)
    expect(r3.finalRankings).toBeDefined()
    const rankings = r3.finalRankings as FinalRanking[]
    expect(rankings).toHaveLength(4)
  })
})
