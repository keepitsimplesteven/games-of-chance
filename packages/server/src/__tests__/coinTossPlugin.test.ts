import { describe, it, expect } from "vitest"
import { coinTossPlugin } from "../games/coin-toss/CoinTossPlugin"
import type { Player } from "@games-of-chance/shared"

describe("CoinTossPlugin", () => {
  describe("validatePick", () => {
    it("accepts HEADS", () => {
      expect(coinTossPlugin.validatePick({ side: "HEADS" })).toBe(true)
    })

    it("accepts TAILS", () => {
      expect(coinTossPlugin.validatePick({ side: "TAILS" })).toBe(true)
    })

    it("rejects null", () => {
      expect(coinTossPlugin.validatePick(null)).toBe(false)
    })

    it("rejects numbers", () => {
      expect(coinTossPlugin.validatePick(42)).toBe(false)
    })

    it("rejects wrong keys", () => {
      expect(coinTossPlugin.validatePick({ face: "HEADS" })).toBe(false)
    })

    it("rejects invalid side value", () => {
      expect(coinTossPlugin.validatePick({ side: "BANANA" })).toBe(false)
    })

    it("rejects undefined", () => {
      expect(coinTossPlugin.validatePick(undefined)).toBe(false)
    })

    it("rejects empty object", () => {
      expect(coinTossPlugin.validatePick({})).toBe(false)
    })
  })

  describe("resolveRound", () => {
    it("returns a valid CoinSide outcome", () => {
      const result = coinTossPlugin.resolveRound({ p1: { side: "HEADS" } })
      expect(["HEADS", "TAILS"]).toContain(result.outcome)
    })

    it("returns a flippedAt timestamp", () => {
      const result = coinTossPlugin.resolveRound({ p1: { side: "TAILS" } })
      expect(result.flippedAt).toBeTypeOf("number")
      expect(result.flippedAt).toBeGreaterThan(0)
    })
  })

  describe("scoreRound", () => {
    const createPlayer = (id: string, connected = true): Player => ({
      id,
      name: `Player ${id}`,
      role: "player",
      connected,
      connectionId: connected ? `conn-${id}` : null,
    })

    it("awards 10 chips for correct pick", () => {
      const players = [createPlayer("p1"), createPlayer("p2")]
      const picks = { p1: { side: "HEADS" as const }, p2: { side: "TAILS" as const } }
      const result = { outcome: "HEADS" as const, flippedAt: Date.now() }

      const scoreResult = coinTossPlugin.scoreRound(picks, result, players)

      expect(scoreResult.deltas.p1).toBe(10)
      expect(scoreResult.deltas.p2).toBe(0)
    })

    it("awards 0 chips for wrong pick", () => {
      const players = [createPlayer("p1")]
      const picks = { p1: { side: "TAILS" as const } }
      const result = { outcome: "HEADS" as const, flippedAt: Date.now() }

      const scoreResult = coinTossPlugin.scoreRound(picks, result, players)

      expect(scoreResult.deltas.p1).toBe(0)
    })

    it("ignores disconnected players", () => {
      const players = [createPlayer("p1", true), createPlayer("p2", false)]
      const picks = { p1: { side: "HEADS" as const }, p2: { side: "HEADS" as const } }
      const result = { outcome: "HEADS" as const, flippedAt: Date.now() }

      const scoreResult = coinTossPlugin.scoreRound(picks, result, players)

      expect(scoreResult.deltas.p1).toBe(10)
      expect(scoreResult.deltas.p2).toBeUndefined()
    })
  })

  describe("computeGameLeaderboard", () => {
    const createPlayer = (id: string, name: string, connected = true): Player => ({
      id,
      name,
      role: "player",
      connected,
      connectionId: connected ? `conn-${id}` : null,
    })

    it("ranks correctly in descending score order", () => {
      const players = [
        createPlayer("p1", "Alice"),
        createPlayer("p2", "Bob"),
        createPlayer("p3", "Charlie"),
      ]
      const scores = { p1: 30, p2: 50, p3: 10 }

      const leaderboard = coinTossPlugin.computeGameLeaderboard(players, scores)

      expect(leaderboard[0].playerId).toBe("p2")
      expect(leaderboard[0].rank).toBe(1)
      expect(leaderboard[1].playerId).toBe("p1")
      expect(leaderboard[1].rank).toBe(2)
      expect(leaderboard[2].playerId).toBe("p3")
      expect(leaderboard[2].rank).toBe(3)
    })

    it("assigns equal rank for ties", () => {
      const players = [
        createPlayer("p1", "Alice"),
        createPlayer("p2", "Bob"),
        createPlayer("p3", "Charlie"),
      ]
      const scores = { p1: 20, p2: 20, p3: 10 }

      const leaderboard = coinTossPlugin.computeGameLeaderboard(players, scores)

      expect(leaderboard[0].rank).toBe(1)
      expect(leaderboard[1].rank).toBe(1)
      expect(leaderboard[2].rank).toBe(3)
    })

    it("excludes disconnected players", () => {
      const players = [
        createPlayer("p1", "Alice", true),
        createPlayer("p2", "Bob", false),
        createPlayer("p3", "Charlie", true),
      ]
      const scores = { p1: 30, p2: 50, p3: 10 }

      const leaderboard = coinTossPlugin.computeGameLeaderboard(players, scores)

      expect(leaderboard).toHaveLength(2)
      expect(leaderboard.find((e) => e.playerId === "p2")).toBeUndefined()
    })
  })
})
