import { describe, it, expect } from "vitest"
import { computeFinalRankings, type ParticipantInfo } from "./RankingEngine"
import type { FFABracketState } from "../types"

/** Helper to create a bracket with specified elimination order and survivor */
function makeBracket(
  id: string,
  participantIds: string[],
  eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }>,
  survivorId: string | null
): FFABracketState {
  return {
    id,
    participantIds,
    eliminationOrder,
    survivorId,
    tickLog: [], // tick log not needed for ranking (eliminatedOnTick is in eliminationOrder)
  }
}

function makeParticipantInfo(
  ids: string[]
): Map<string, ParticipantInfo> {
  const info = new Map<string, ParticipantInfo>()
  for (const id of ids) {
    info.set(id, {
      name: `Player ${id}`,
      isBot: id.startsWith("bot_"),
    })
  }
  return info
}

describe("RankingEngine - computeFinalRankings", () => {
  it("assigns rank 1 to player with highest cumulative score", () => {
    // 3 players in winners: A eliminated tick 3, B eliminated tick 5, C survives
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      [
        { ownerId: "A", eliminatedOnTick: 3 },
        { ownerId: "B", eliminatedOnTick: 5 },
      ],
      "C"
    )
    const losers = makeBracket(
      "losers",
      ["D", "E", "F"],
      [
        { ownerId: "D", eliminatedOnTick: 2 },
        { ownerId: "E", eliminatedOnTick: 4 },
      ],
      "F"
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E", "F"])
    // C has highest score (150), should get rank 1
    const gameScores: Record<string, number> = {
      A: 30, B: 80, C: 150, D: 20, E: 60, F: 125,
    }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    const cRanking = rankings.find((r) => r.playerId === "C")
    expect(cRanking?.rank).toBe(1)
    expect(cRanking?.bracket).toBe("winners")
    expect(cRanking?.score).toBe(150)
  })

  it("ranks players by cumulative score descending regardless of bracket", () => {
    // A eliminated tick 2, B eliminated tick 4, C survives in winners
    // D is alone in losers
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      [
        { ownerId: "A", eliminatedOnTick: 2 },
        { ownerId: "B", eliminatedOnTick: 4 },
      ],
      "C"
    )
    const losers = makeBracket("losers", ["D"], [], "D")

    const info = makeParticipantInfo(["A", "B", "C", "D"])
    // D (losers bracket) has higher score than B (winners bracket)
    const gameScores: Record<string, number> = { A: 10, B: 50, C: 150, D: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(1) // 150
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(2) // 125 (losers bracket)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(3) // 50
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(4) // 10
  })

  it("losers bracket player can outrank winners bracket player by score", () => {
    // 2 winners, 2 losers
    const winners = makeBracket(
      "winners",
      ["A", "B"],
      [{ ownerId: "A", eliminatedOnTick: 3 }],
      "B"
    )
    const losers = makeBracket(
      "losers",
      ["C", "D"],
      [{ ownerId: "C", eliminatedOnTick: 2 }],
      "D"
    )

    const info = makeParticipantInfo(["A", "B", "C", "D"])
    // D (losers survivor) has higher score than A (winners eliminated)
    const gameScores: Record<string, number> = { A: 30, B: 150, C: 10, D: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    // B=1 (150), D=2 (125, losers!), A=3 (30), C=4 (10)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(2)
    expect(rankings.find((r) => r.playerId === "D")?.bracket).toBe("losers")
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(3)
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(4)
    expect(rankings.find((r) => r.playerId === "C")?.bracket).toBe("losers")
  })

  it("assigns same rank to players with the same cumulative score", () => {
    // 4 players in winners, 1 in losers
    const winners = makeBracket(
      "winners",
      ["A", "B", "C", "D"],
      [
        { ownerId: "A", eliminatedOnTick: 3 },
        { ownerId: "B", eliminatedOnTick: 3 },
        { ownerId: "C", eliminatedOnTick: 5 },
      ],
      "D"
    )
    const losers = makeBracket("losers", ["E"], [], "E")

    const info = makeParticipantInfo(["A", "B", "C", "D", "E"])
    // A and B have the same score → tied rank
    const gameScores: Record<string, number> = { A: 30, B: 30, C: 80, D: 150, E: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(1)  // 150
    expect(rankings.find((r) => r.playerId === "E")?.rank).toBe(2)  // 125
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(3)  // 80
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(4)  // 30 (tied)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(4)  // 30 (tied)
  })

  it("handles ties across brackets", () => {
    // 2 winners, 3 losers: some with same scores across brackets
    const winners = makeBracket(
      "winners",
      ["A", "B"],
      [{ ownerId: "A", eliminatedOnTick: 2 }],
      "B"
    )
    const losers = makeBracket(
      "losers",
      ["C", "D", "E"],
      [
        { ownerId: "C", eliminatedOnTick: 1 },
        { ownerId: "D", eliminatedOnTick: 1 },
      ],
      "E"
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E"])
    // E and A have same score, C and D have same score
    const gameScores: Record<string, number> = { A: 50, B: 150, C: 10, D: 10, E: 50 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(1)  // 150
    // A and E tied at 50
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(2)
    expect(rankings.find((r) => r.playerId === "E")?.rank).toBe(2)
    // C and D tied at 10
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(4)
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(4)
  })

  it("populates playerName and isBot from participantInfo", () => {
    const winners = makeBracket(
      "winners",
      ["player1", "bot_1"],
      [{ ownerId: "bot_1", eliminatedOnTick: 2 }],
      "player1"
    )
    const losers = makeBracket("losers", ["player2"], [], "player2")

    const info = new Map<string, ParticipantInfo>([
      ["player1", { name: "Alice", isBot: false }],
      ["bot_1", { name: "MechBot-7", isBot: true }],
      ["player2", { name: "Bob", isBot: false }],
    ])

    const gameScores: Record<string, number> = { player1: 150, bot_1: 50, player2: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    const aliceRanking = rankings.find((r) => r.playerId === "player1")
    expect(aliceRanking?.playerName).toBe("Alice")
    expect(aliceRanking?.isBot).toBe(false)

    const botRanking = rankings.find((r) => r.playerId === "bot_1")
    expect(botRanking?.playerName).toBe("MechBot-7")
    expect(botRanking?.isBot).toBe(true)
  })

  it("handles single player in each bracket ranked by score", () => {
    // 1 winner, 1 loser (minimum game)
    const winners = makeBracket("winners", ["A"], [], "A")
    const losers = makeBracket("losers", ["B"], [], "B")

    const info = makeParticipantInfo(["A", "B"])
    // Winner got 25 (Round 2) + 125 (survivor) = 150
    // Loser got 0 (Round 2) + 125 (survivor in losers) = 125
    const gameScores: Record<string, number> = { A: 150, B: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "A")?.score).toBe(150)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(2)
    expect(rankings.find((r) => r.playerId === "B")?.score).toBe(125)
  })

  it("returns all participants in final rankings", () => {
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      [
        { ownerId: "A", eliminatedOnTick: 1 },
        { ownerId: "B", eliminatedOnTick: 3 },
      ],
      "C"
    )
    const losers = makeBracket(
      "losers",
      ["D", "E", "F"],
      [
        { ownerId: "D", eliminatedOnTick: 1 },
        { ownerId: "E", eliminatedOnTick: 2 },
      ],
      "F"
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E", "F"])
    const gameScores: Record<string, number> = { A: 10, B: 50, C: 150, D: 5, E: 40, F: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    expect(rankings).toHaveLength(6)
    const playerIds = rankings.map((r) => r.playerId).sort()
    expect(playerIds).toEqual(["A", "B", "C", "D", "E", "F"])
  })

  it("preserves bracket indicator regardless of rank", () => {
    // Verify that bracket labels are maintained even when losers outrank winners
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      [
        { ownerId: "A", eliminatedOnTick: 1 },
        { ownerId: "B", eliminatedOnTick: 3 },
      ],
      "C"
    )
    const losers = makeBracket(
      "losers",
      ["D", "E", "F"],
      [
        { ownerId: "D", eliminatedOnTick: 1 },
        { ownerId: "E", eliminatedOnTick: 2 },
      ],
      "F"
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E", "F"])
    // F (losers survivor) outranks A and B (winners eliminated)
    const gameScores: Record<string, number> = { A: 10, B: 50, C: 150, D: 5, E: 40, F: 125 }
    const rankings = computeFinalRankings(winners, losers, info, gameScores)

    // F is rank 2 but still labeled as losers bracket
    const fRanking = rankings.find((r) => r.playerId === "F")
    expect(fRanking?.rank).toBe(2)
    expect(fRanking?.bracket).toBe("losers")

    // All winners bracket players still labeled as winners
    for (const id of ["A", "B", "C"]) {
      expect(rankings.find((r) => r.playerId === id)?.bracket).toBe("winners")
    }
  })

  it("defaults to score 0 when gameScores not provided", () => {
    // When no gameScores provided, all scores are 0 and all get rank 1 (tied)
    const winners = makeBracket("winners", ["A"], [], "A")
    const losers = makeBracket("losers", ["B"], [], "B")

    const info = makeParticipantInfo(["A", "B"])
    const rankings = computeFinalRankings(winners, losers, info)

    // Both have score 0, both get rank 1
    expect(rankings.find((r) => r.playerId === "A")?.score).toBe(0)
    expect(rankings.find((r) => r.playerId === "B")?.score).toBe(0)
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(1)
  })
})
