import { describe, it, expect } from "vitest"
import type { SessionLeaderboardEntry } from "@games-of-chance/shared"
import { computeSessionRanks } from "../SessionScoringStrategy"

/** Build a rank-less session entry for ranking. */
function entry(
  playerId: string,
  sessionPoints: number
): Omit<SessionLeaderboardEntry, "rank"> {
  return { playerId, playerName: playerId, sessionPoints, gamesPlayed: 1 }
}

describe("computeSessionRanks", () => {
  it("ranks strictly-descending points as 1,2,3", () => {
    const ranked = computeSessionRanks([
      entry("a", 30),
      entry("b", 20),
      entry("c", 10),
    ])

    expect(ranked.map((e) => e.playerId)).toEqual(["a", "b", "c"])
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it("sorts unordered input by points descending", () => {
    const ranked = computeSessionRanks([
      entry("a", 10),
      entry("b", 30),
      entry("c", 20),
    ])

    expect(ranked.map((e) => e.playerId)).toEqual(["b", "c", "a"])
    expect(ranked.map((e) => e.sessionPoints)).toEqual([30, 20, 10])
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it("assigns equal rank to tied players", () => {
    const ranked = computeSessionRanks([
      entry("a", 20),
      entry("b", 20),
      entry("c", 5),
    ])

    const byId = Object.fromEntries(ranked.map((e) => [e.playerId, e]))
    // a and b tie at the top -> rank 1; c follows.
    expect(byId.a.rank).toBe(1)
    expect(byId.b.rank).toBe(1)
    expect(byId.c.rank).toBe(3)
  })

  it("carries a tie in the middle of the standings", () => {
    const ranked = computeSessionRanks([
      entry("a", 30),
      entry("b", 15),
      entry("c", 15),
      entry("d", 5),
    ])

    const byId = Object.fromEntries(ranked.map((e) => [e.playerId, e]))
    expect(byId.a.rank).toBe(1)
    expect(byId.b.rank).toBe(2)
    expect(byId.c.rank).toBe(2)
    expect(byId.d.rank).toBe(4)
  })

  it("returns an empty array for empty input", () => {
    expect(computeSessionRanks([])).toEqual([])
  })
})
