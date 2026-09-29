import { describe, it, expect } from "vitest"
import type { Player, GameLeaderboardEntry } from "@games-of-chance/shared"
import { GrandPrixStrategy } from "../GrandPrixStrategy"

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

/** Build a game leaderboard entry with the given rank. */
function makeEntry(
  playerId: string,
  playerName: string,
  rank: number,
  score = 0
): GameLeaderboardEntry {
  return { playerId, playerName, score, rank }
}

describe("GrandPrixStrategy", () => {
  it("exposes mode 'grand-prix'", () => {
    expect(new GrandPrixStrategy().mode).toBe("grand-prix")
  })

  it("awards default placement points by rank (10,5,3,1,...)", () => {
    const strategy = new GrandPrixStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
      makePlayer("d", "Dave"),
      makePlayer("e", "Eve"),
    ]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1),
      makeEntry("b", "Bob", 2),
      makeEntry("c", "Carol", 3),
      makeEntry("d", "Dave", 4),
      makeEntry("e", "Eve", 5),
    ]

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    // DEFAULT_PLACEMENT_POINTS = [10,5,3,1,1,1,1,0,0,0]
    expect(sessionScores.a).toBe(10) // rank 1
    expect(sessionScores.b).toBe(5) // rank 2
    expect(sessionScores.c).toBe(3) // rank 3
    expect(sessionScores.d).toBe(1) // rank 4
    expect(sessionScores.e).toBe(1) // rank 5
  })

  it("ignores rawScores entirely (points derive only from rank)", () => {
    const strategy = new GrandPrixStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1, 12345),
      makeEntry("b", "Bob", 2, 67890),
    ]
    // Nonzero raw scores that must NOT influence session points.
    const rawScores = { a: 9999, b: 8888 }

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      rawScores
    )

    expect(sessionScores.a).toBe(10) // from rank 1, not 9999
    expect(sessionScores.b).toBe(5) // from rank 2, not 8888
  })

  it("awards 0 for a rank beyond the placement table length", () => {
    const strategy = new GrandPrixStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("k", "Kilo")]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1),
      // rank 11 -> rankIndex 10, beyond table length 10 -> 0
      makeEntry("k", "Kilo", 11),
    ]

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    expect(sessionScores.a).toBe(10)
    expect(sessionScores.k).toBe(0)
  })

  it("gives 0 to a player present in players[] but absent from the game leaderboard", () => {
    const strategy = new GrandPrixStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("z", "Zoe"), // never appears in the game leaderboard
    ]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1),
      makeEntry("b", "Bob", 2),
    ]

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    expect(sessionScores.a).toBe(10)
    expect(sessionScores.b).toBe(5)
    expect(sessionScores.z).toBe(0)
  })

  it("uses a custom placementPoints array from the constructor", () => {
    const strategy = new GrandPrixStrategy([100, 50, 25])
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
      makePlayer("d", "Dave"),
    ]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1),
      makeEntry("b", "Bob", 2),
      makeEntry("c", "Carol", 3),
      makeEntry("d", "Dave", 4), // beyond custom table length -> 0
    ]

    const { sessionScores } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    expect(sessionScores.a).toBe(100)
    expect(sessionScores.b).toBe(50)
    expect(sessionScores.c).toBe(25)
    expect(sessionScores.d).toBe(0)
  })

  it("emits a gamesPlayed delta of 1 for every entry", () => {
    const strategy = new GrandPrixStrategy()
    const players = [makePlayer("a", "Alice"), makePlayer("b", "Bob")]
    const gameLeaderboard = [
      makeEntry("a", "Alice", 1),
      makeEntry("b", "Bob", 2),
    ]

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    expect(sessionLeaderboard).toHaveLength(2)
    for (const entry of sessionLeaderboard) {
      expect(entry.gamesPlayed).toBe(1)
    }
  })

  it("orders the session leaderboard by awarded points descending with ranks 1,2,3", () => {
    const strategy = new GrandPrixStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
    ]
    // Feed ranks out of natural order to confirm sorting is by points.
    const gameLeaderboard = [
      makeEntry("a", "Alice", 3), // 3 points
      makeEntry("b", "Bob", 1), // 10 points
      makeEntry("c", "Carol", 2), // 5 points
    ]

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    expect(sessionLeaderboard.map((e) => e.playerId)).toEqual(["b", "c", "a"])
    expect(sessionLeaderboard.map((e) => e.sessionPoints)).toEqual([10, 5, 3])
    expect(sessionLeaderboard.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it("gives tied players equal rank in the session leaderboard", () => {
    const strategy = new GrandPrixStrategy()
    const players = [
      makePlayer("a", "Alice"),
      makePlayer("b", "Bob"),
      makePlayer("c", "Carol"),
    ]
    // Ranks 4 and 5 both award 1 point -> tie.
    const gameLeaderboard = [
      makeEntry("a", "Alice", 4), // 1 point
      makeEntry("b", "Bob", 5), // 1 point
      makeEntry("c", "Carol", 1), // 10 points
    ]

    const { sessionLeaderboard } = strategy.applyGameResult(
      players,
      gameLeaderboard,
      {}
    )

    const byId = Object.fromEntries(
      sessionLeaderboard.map((e) => [e.playerId, e])
    )
    expect(byId.c.sessionPoints).toBe(10)
    expect(byId.c.rank).toBe(1)
    // Alice and Bob both have 1 point -> equal rank 2.
    expect(byId.a.sessionPoints).toBe(1)
    expect(byId.b.sessionPoints).toBe(1)
    expect(byId.a.rank).toBe(2)
    expect(byId.b.rank).toBe(2)
  })
})
