import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { runBatch } from "./batch-runner"
import { SeededRng } from "./rng"
import type { SimulationConfig } from "./types"
import { InvalidConfigError } from "./errors"

// Side-effect imports: register plugin and pick generator
import "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"
import "./pick-generators/coin-toss"

describe("runBatch", () => {
  const baseConfig: SimulationConfig = {
    gameType: "coin-toss",
    playerCount: 4,
    roundCount: 5,
    gameCount: 10,
    seed: 42,
  }

  it("produces the correct number of game results", () => {
    const result = runBatch(baseConfig)
    expect(result.games).toHaveLength(10)
  })

  it("each game result has the expected structure", () => {
    const result = runBatch(baseConfig)
    for (const game of result.games) {
      expect(game.rounds).toHaveLength(5)
      expect(game.leaderboard).toHaveLength(4)
      expect(Object.keys(game.finalScores)).toHaveLength(4)
    }
  })

  it("returns config and elapsedMs in the result", () => {
    const result = runBatch(baseConfig)
    expect(result.config).toEqual(baseConfig)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it("validates config and throws on invalid input", () => {
    const badConfig = { ...baseConfig, playerCount: 1 }
    expect(() => runBatch(badConfig)).toThrow(InvalidConfigError)
  })

  describe("progress callback", () => {
    it("fires at expected intervals (every 1000 games)", () => {
      const config: SimulationConfig = {
        ...baseConfig,
        gameCount: 3000,
      }
      const progressCalls: [number, number][] = []
      runBatch(config, (completed, total) => {
        progressCalls.push([completed, total])
      })

      expect(progressCalls).toHaveLength(3)
      expect(progressCalls[0]).toEqual([1000, 3000])
      expect(progressCalls[1]).toEqual([2000, 3000])
      expect(progressCalls[2]).toEqual([3000, 3000])
    })

    it("does not fire when gameCount < 1000", () => {
      const config: SimulationConfig = {
        ...baseConfig,
        gameCount: 999,
      }
      const progressCalls: [number, number][] = []
      runBatch(config, (completed, total) => {
        progressCalls.push([completed, total])
      })

      expect(progressCalls).toHaveLength(0)
    })

    it("does not fire when no callback is provided", () => {
      // Should not throw when onProgress is undefined
      const result = runBatch(baseConfig)
      expect(result.games).toHaveLength(10)
    })
  })

  describe("seed determinism", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it("same config + seed produces identical results", () => {
      const config = { ...baseConfig, gameCount: 10, seed: 42 }

      // First run: stub Math.random for plugin determinism
      vi.setSystemTime(1000)
      const mathRng1 = new SeededRng(42 + 999_999)
      vi.spyOn(Math, "random").mockImplementation(() => mathRng1.next())

      const result1 = runBatch(config)
      vi.restoreAllMocks()

      // Second run: same stubs
      vi.setSystemTime(1000)
      const mathRng2 = new SeededRng(42 + 999_999)
      vi.spyOn(Math, "random").mockImplementation(() => mathRng2.next())

      const result2 = runBatch(config)
      vi.restoreAllMocks()

      expect(result1.games.length).toBe(result2.games.length)
      for (let i = 0; i < result1.games.length; i++) {
        expect(result1.games[i].finalScores).toEqual(result2.games[i].finalScores)
        expect(result1.games[i].leaderboard).toEqual(result2.games[i].leaderboard)
        expect(result1.games[i].rounds).toEqual(result2.games[i].rounds)
      }
    })

    it("different seeds produce different results", () => {
      // Stub Math.random the same way for both, but use different seeds for RNG
      vi.setSystemTime(1000)
      const mathRng1 = new SeededRng(1 + 999_999)
      vi.spyOn(Math, "random").mockImplementation(() => mathRng1.next())
      const result1 = runBatch({ ...baseConfig, seed: 1 })
      vi.restoreAllMocks()

      vi.setSystemTime(1000)
      const mathRng2 = new SeededRng(2 + 999_999)
      vi.spyOn(Math, "random").mockImplementation(() => mathRng2.next())
      const result2 = runBatch({ ...baseConfig, seed: 2 })
      vi.restoreAllMocks()

      // With different seeds, at least some games should differ
      const hasDifference = result1.games.some(
        (game, i) =>
          JSON.stringify(game.finalScores) !==
          JSON.stringify(result2.games[i].finalScores)
      )
      expect(hasDifference).toBe(true)
    })
  })
})
