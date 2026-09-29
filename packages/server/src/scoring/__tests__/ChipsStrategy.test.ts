import { describe, it, expect } from "vitest"
import type { Player, GameLeaderboardEntry } from "@games-of-chance/shared"
import { ChipsStrategy } from "../ChipsStrategy"

/** Build a minimal but fully-typed Player fixture. */
function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    role: "player",
    connected: true,
    connectionId: id,
  }
}

describe("ChipsStrategy", () => {
  it("exposes mode 'chips'", () => {
    expect(new ChipsStrategy().mode).toBe("chips")
  })

  it("passes raw scores through directly as session points", () => {
    const strategy = new ChipsStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const rawScores = { a: 42, b: 17 }

    const { sessionScores } = strategy.applyGameResult(players, [], rawScores)

    expect(sessionScores).toEqual({ a: 42, b: 17 })
  })

  it("assigns 0 to a player missing from rawScores", () => {
    const strategy = new ChipsStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const rawScores = { a: 25 } // Bob absent

    const { sessionScores } = strategy.applyGameResult(players, [], rawScores)

    expect(sessionScores.a).toBe(25)
    expect(sessionScores.b).toBe(0)
  })

  it("ignores the game leaderboard entirely (only raw scores matter)", () => {
    const strategy = new ChipsStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const gameLeaderboard: GameLeaderboardEntry[] = [
      { playerId: "a", playerName: "Alice", score: 999, rank: 1 },
      { playerId: "b", playerName: "Bob", score: 500, rank: 2 },
    ]
    const rawScores = { a: 3, b: 7 }

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      rawScores
    )

    // Session scores derive from rawScores, not the leaderboard rank/score.
    expect(sessionScores).toEqual({ a: 3, b: 7 })
  })

  it("emits a gamesPlayed delta of 1 for every entry", () => {
    const strategy = new ChipsStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const rawScores = { a: 10, b: 20 }

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      [],
      rawScores
    )

    expect(sessionLeaderboard).toHaveLength(2)
    for (const entry of sessionLeaderboard) {
      expect(entry.gamesPlayed).toBe(1)
    }
  })

  it("orders the session leaderboard by session points descending with ranks 1,2,3", () => {
    const strategy = new ChipsStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
    ]
    const rawScores = { a: 5, b: 30, c: 15 }

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      [],
      rawScores
    )

    expect(sessionLeaderboard.map((e) => e.playerId)).toEqual(["b", "c", "a"])
    expect(sessionLeaderboard.map((e) => e.sessionPoints)).toEqual([30, 15, 5])
    expect(sessionLeaderboard.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it("gives tied players equal rank", () => {
    const strategy = new ChipsStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
    ]
    const rawScores = { a: 20, b: 20, c: 5 }

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      [],
      rawScores
    )

    // Alice and Bob both have 20 points -> equal top rank; Carol trails.
    const byId = Object.fromEntries(
      sessionLeaderboard.map((e) => [e.playerId, e])
    )
    expect(byId.a.rank).toBe(1)
    expect(byId.b.rank).toBe(1)
    expect(byId.c.rank).toBe(3)
  })
})
