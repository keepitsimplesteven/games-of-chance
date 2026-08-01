import { describe, it, expect } from "vitest"
import { filterBotPersonasFromDeltas, filterBotPersonasFromLeaderboard } from "./scoring-utils"
import type { GameLeaderboardEntry } from "@games-of-chance/shared"

/**
 * Validates: Requirements 11.3, 11.4
 *
 * 11.3 — Bot personas shall be excluded from session scoring and the session leaderboard
 * 11.4 — Bot personas included in bracket placement but excluded from points awarded to human players
 */

describe("filterBotPersonasFromDeltas", () => {
  const botPersonaIds = new Set(["bot_abc12345", "bot_def67890"])

  it("removes bot persona IDs from score deltas", () => {
    const deltas: Record<string, number> = {
      player1: 10,
      bot_abc12345: 5,
      player2: 3,
      bot_def67890: 8,
    }

    const filtered = filterBotPersonasFromDeltas(deltas, botPersonaIds)

    expect(filtered).toEqual({ player1: 10, player2: 3 })
    expect(filtered).not.toHaveProperty("bot_abc12345")
    expect(filtered).not.toHaveProperty("bot_def67890")
  })

  it("returns all deltas when no bot personas exist", () => {
    const deltas: Record<string, number> = {
      player1: 10,
      player2: 3,
    }
    const emptyBots = new Set<string>()

    const filtered = filterBotPersonasFromDeltas(deltas, emptyBots)

    expect(filtered).toEqual({ player1: 10, player2: 3 })
  })

  it("returns empty object when all entries are bot personas", () => {
    const deltas: Record<string, number> = {
      bot_abc12345: 5,
      bot_def67890: 8,
    }

    const filtered = filterBotPersonasFromDeltas(deltas, botPersonaIds)

    expect(filtered).toEqual({})
  })

  it("returns empty object when deltas is empty", () => {
    const deltas: Record<string, number> = {}

    const filtered = filterBotPersonasFromDeltas(deltas, botPersonaIds)

    expect(filtered).toEqual({})
  })

  it("preserves zero-value deltas for human players", () => {
    const deltas: Record<string, number> = {
      player1: 0,
      bot_abc12345: 1,
      player2: 0,
    }

    const filtered = filterBotPersonasFromDeltas(deltas, botPersonaIds)

    expect(filtered).toEqual({ player1: 0, player2: 0 })
  })

  it("preserves negative deltas for human players", () => {
    const deltas: Record<string, number> = {
      player1: -5,
      bot_abc12345: 1,
    }

    const filtered = filterBotPersonasFromDeltas(deltas, botPersonaIds)

    expect(filtered).toEqual({ player1: -5 })
  })
})

describe("filterBotPersonasFromLeaderboard", () => {
  const botPersonaIds = new Set(["bot_abc12345", "bot_def67890"])

  it("removes bot persona entries from leaderboard", () => {
    const leaderboard: GameLeaderboardEntry[] = [
      { playerId: "player1", playerName: "Alice", score: 10, rank: 1 },
      { playerId: "bot_abc12345", playerName: "MechBot-42", score: 5, rank: 2 },
      { playerId: "player2", playerName: "Bob", score: 3, rank: 3 },
      { playerId: "bot_def67890", playerName: "MechBot-7", score: 1, rank: 4 },
    ]

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)

    expect(filtered).toHaveLength(2)
    expect(filtered.map((e) => e.playerId)).toEqual(["player1", "player2"])
    expect(filtered.every((e) => !e.playerId.startsWith("bot_"))).toBe(true)
  })

  it("returns all entries when no bot personas exist", () => {
    const leaderboard: GameLeaderboardEntry[] = [
      { playerId: "player1", playerName: "Alice", score: 10, rank: 1 },
      { playerId: "player2", playerName: "Bob", score: 5, rank: 2 },
    ]
    const emptyBots = new Set<string>()

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, emptyBots)

    expect(filtered).toHaveLength(2)
    expect(filtered).toEqual(leaderboard)
  })

  it("returns empty array when all entries are bot personas", () => {
    const leaderboard: GameLeaderboardEntry[] = [
      { playerId: "bot_abc12345", playerName: "MechBot-42", score: 5, rank: 1 },
      { playerId: "bot_def67890", playerName: "MechBot-7", score: 3, rank: 2 },
    ]

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)

    expect(filtered).toHaveLength(0)
  })

  it("returns empty array when leaderboard is empty", () => {
    const leaderboard: GameLeaderboardEntry[] = []

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)

    expect(filtered).toHaveLength(0)
  })

  it("preserves entry data for human players", () => {
    const leaderboard: GameLeaderboardEntry[] = [
      { playerId: "player1", playerName: "Alice", score: 10, rank: 1 },
      { playerId: "bot_abc12345", playerName: "MechBot-42", score: 5, rank: 2 },
    ]

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)

    expect(filtered[0]).toEqual({
      playerId: "player1",
      playerName: "Alice",
      score: 10,
      rank: 1,
    })
  })

  it("only filters IDs present in the bot persona set", () => {
    const leaderboard: GameLeaderboardEntry[] = [
      { playerId: "player1", playerName: "Alice", score: 10, rank: 1 },
      { playerId: "bot_unknown", playerName: "MechBot-99", score: 5, rank: 2 },
      { playerId: "bot_abc12345", playerName: "MechBot-42", score: 3, rank: 3 },
    ]

    const filtered = filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)

    // bot_unknown is NOT in the set, so it stays
    expect(filtered).toHaveLength(2)
    expect(filtered.map((e) => e.playerId)).toEqual(["player1", "bot_unknown"])
  })
})
