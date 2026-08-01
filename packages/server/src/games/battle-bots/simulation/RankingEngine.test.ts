import { describe, it, expect } from "vitest"
import { computeFinalRankings, type ParticipantInfo } from "./RankingEngine"
import type { FFABracket, RobotInstance } from "../types"

/** Helper to create a minimal robot instance */
function makeRobot(ownerId: string): RobotInstance {
  return {
    templateId: "bot-alpha",
    ownerId,
    currentHp: 0,
    maxHp: 100,
    accuracy: 80,
    damageMin: 1,
    damageMax: 10,
  }
}

/** Helper to create a bracket with specified elimination order and tick log */
function makeBracket(
  id: string,
  participantIds: string[],
  eliminationOrder: string[],
  tickLog: { tick: number; eliminatedIds: string[] }[] = []
): FFABracket {
  const participants = participantIds.map(makeRobot)

  // Build tick log with attacks that eliminate the specified players at the given tick
  const fullTickLog = tickLog.map((entry) => ({
    tick: entry.tick,
    attacks: entry.eliminatedIds.map((targetId) => ({
      attackerId: "attacker",
      targetId,
      hit: true,
      damage: 100,
      targetHpAfter: 0,
    })),
  }))

  return { id, participants, eliminationOrder, tickLog: fullTickLog }
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
  it("assigns rank 1 to last standing in winners bracket", () => {
    // 3 players in winners: eliminated in order [A, B, C] → C is last = rank 1
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      ["A", "B", "C"],
      [
        { tick: 3, eliminatedIds: ["A"] },
        { tick: 5, eliminatedIds: ["B"] },
        // C is last standing, appended last to elimination order
      ]
    )
    const losers = makeBracket("losers", ["D", "E", "F"], ["D", "E", "F"], [
      { tick: 2, eliminatedIds: ["D"] },
      { tick: 4, eliminatedIds: ["E"] },
    ])

    const info = makeParticipantInfo(["A", "B", "C", "D", "E", "F"])
    const rankings = computeFinalRankings(winners, losers, info)

    const cRanking = rankings.find((r) => r.playerId === "C")
    expect(cRanking?.rank).toBe(1)
    expect(cRanking?.bracket).toBe("winners")
  })

  it("ranks winners bracket by reverse elimination order", () => {
    // eliminationOrder: [A, B, C] → C=1st, B=2nd, A=3rd
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      ["A", "B", "C"],
      [
        { tick: 2, eliminatedIds: ["A"] },
        { tick: 4, eliminatedIds: ["B"] },
      ]
    )
    const losers = makeBracket("losers", ["D"], ["D"], [])

    const info = makeParticipantInfo(["A", "B", "C", "D"])
    const rankings = computeFinalRankings(winners, losers, info)

    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(2)
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(3)
  })

  it("starts losers bracket ranking after winners count", () => {
    // 2 winners, 2 losers → losers start at rank 3
    const winners = makeBracket(
      "winners",
      ["A", "B"],
      ["A", "B"],
      [{ tick: 3, eliminatedIds: ["A"] }]
    )
    const losers = makeBracket(
      "losers",
      ["C", "D"],
      ["C", "D"],
      [{ tick: 2, eliminatedIds: ["C"] }]
    )

    const info = makeParticipantInfo(["A", "B", "C", "D"])
    const rankings = computeFinalRankings(winners, losers, info)

    // Winners: B=1, A=2; Losers: D=3, C=4
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(3)
    expect(rankings.find((r) => r.playerId === "D")?.bracket).toBe("losers")
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(4)
    expect(rankings.find((r) => r.playerId === "C")?.bracket).toBe("losers")
  })

  it("assigns same rank to robots eliminated on the same tick", () => {
    // 4 players in winners: A and B eliminated on tick 3, C eliminated on tick 5, D last standing
    const winners = makeBracket(
      "winners",
      ["A", "B", "C", "D"],
      ["A", "B", "C", "D"],
      [
        { tick: 3, eliminatedIds: ["A", "B"] },
        { tick: 5, eliminatedIds: ["C"] },
      ]
    )
    const losers = makeBracket("losers", ["E"], ["E"], [])

    const info = makeParticipantInfo(["A", "B", "C", "D", "E"])
    const rankings = computeFinalRankings(winners, losers, info)

    // D=1st, C=2nd, A and B tied → both get rank 3 (not 3 and 4)
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(2)
    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(3)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(3)
  })

  it("handles ties in losers bracket", () => {
    // 2 winners, 3 losers with E and F eliminated same tick
    const winners = makeBracket(
      "winners",
      ["A", "B"],
      ["A", "B"],
      [{ tick: 2, eliminatedIds: ["A"] }]
    )
    const losers = makeBracket(
      "losers",
      ["C", "D", "E"],
      ["C", "D", "E"],
      [
        { tick: 1, eliminatedIds: ["C", "D"] },
        // E is last standing
      ]
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E"])
    const rankings = computeFinalRankings(winners, losers, info)

    // Losers start at rank 3. E=3, C and D tied at rank 4
    expect(rankings.find((r) => r.playerId === "E")?.rank).toBe(3)
    expect(rankings.find((r) => r.playerId === "C")?.rank).toBe(4)
    expect(rankings.find((r) => r.playerId === "D")?.rank).toBe(4)
  })

  it("populates playerName and isBot from participantInfo", () => {
    const winners = makeBracket(
      "winners",
      ["player1", "bot_1"],
      ["bot_1", "player1"],
      [{ tick: 2, eliminatedIds: ["bot_1"] }]
    )
    const losers = makeBracket("losers", ["player2"], ["player2"], [])

    const info = new Map<string, ParticipantInfo>([
      ["player1", { name: "Alice", isBot: false }],
      ["bot_1", { name: "MechBot-7", isBot: true }],
      ["player2", { name: "Bob", isBot: false }],
    ])

    const rankings = computeFinalRankings(winners, losers, info)

    const aliceRanking = rankings.find((r) => r.playerId === "player1")
    expect(aliceRanking?.playerName).toBe("Alice")
    expect(aliceRanking?.isBot).toBe(false)

    const botRanking = rankings.find((r) => r.playerId === "bot_1")
    expect(botRanking?.playerName).toBe("MechBot-7")
    expect(botRanking?.isBot).toBe(true)
  })

  it("handles single player in each bracket", () => {
    // 1 winner, 1 loser (minimum game)
    const winners = makeBracket("winners", ["A"], ["A"], [])
    const losers = makeBracket("losers", ["B"], ["B"], [])

    const info = makeParticipantInfo(["A", "B"])
    const rankings = computeFinalRankings(winners, losers, info)

    expect(rankings.find((r) => r.playerId === "A")?.rank).toBe(1)
    expect(rankings.find((r) => r.playerId === "B")?.rank).toBe(2)
  })

  it("returns all participants in final rankings", () => {
    const winners = makeBracket(
      "winners",
      ["A", "B", "C"],
      ["A", "B", "C"],
      [
        { tick: 1, eliminatedIds: ["A"] },
        { tick: 3, eliminatedIds: ["B"] },
      ]
    )
    const losers = makeBracket(
      "losers",
      ["D", "E", "F"],
      ["D", "E", "F"],
      [
        { tick: 1, eliminatedIds: ["D"] },
        { tick: 2, eliminatedIds: ["E"] },
      ]
    )

    const info = makeParticipantInfo(["A", "B", "C", "D", "E", "F"])
    const rankings = computeFinalRankings(winners, losers, info)

    expect(rankings).toHaveLength(6)
    const playerIds = rankings.map((r) => r.playerId).sort()
    expect(playerIds).toEqual(["A", "B", "C", "D", "E", "F"])
  })
})
