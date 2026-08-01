import { describe, it, expect } from "vitest"
import { StatisticsReporter } from "./statistics"
import type { GameResult } from "./core"

function makeGame(gameIndex: number, finalScores: Record<string, number>, roundCount = 5): GameResult {
  return {
    gameIndex,
    rounds: Array.from({ length: roundCount }, (_, i) => ({
      roundNumber: i + 1,
      picks: {},
      result: null,
      deltas: {},
      cumulativeScores: {},
    })),
    leaderboard: [],
    finalScores,
  }
}

describe("StatisticsReporter", () => {
  const reporter = new StatisticsReporter()

  describe("compute() - core score statistics", () => {
    it("computes correct mean score across all players and games", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 10, "p2": 20 }),
        makeGame(1, { "p1": 30, "p2": 40 }),
      ]

      const stats = reporter.compute(games, 2)

      // All scores: [10, 20, 30, 40] → mean = 100/4 = 25
      expect(stats.meanScore).toBe(25)
    })

    it("computes correct standard deviation", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 10, "p2": 20 }),
        makeGame(1, { "p1": 30, "p2": 40 }),
      ]

      const stats = reporter.compute(games, 2)

      // All scores: [10, 20, 30, 40], mean = 25
      // Variance = ((10-25)^2 + (20-25)^2 + (30-25)^2 + (40-25)^2) / 4
      //          = (225 + 25 + 25 + 225) / 4 = 500 / 4 = 125
      // StdDev = sqrt(125) ≈ 11.18
      expect(stats.stdDevScore).toBeCloseTo(Math.sqrt(125), 10)
    })

    it("computes correct min and max scores", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 5, "p2": 100 }),
        makeGame(1, { "p1": 15, "p2": 50 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.minScore).toBe(5)
      expect(stats.maxScore).toBe(100)
    })

    it("computes maxMinRatio correctly", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 10, "p2": 50 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.maxMinRatio).toBe(5)
    })

    it("returns Infinity for maxMinRatio when min score is 0", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 0, "p2": 10 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.maxMinRatio).toBe(Infinity)
    })

    it("handles single game single player", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 42 }),
      ]

      const stats = reporter.compute(games, 1)

      expect(stats.meanScore).toBe(42)
      expect(stats.stdDevScore).toBe(0)
      expect(stats.minScore).toBe(42)
      expect(stats.maxScore).toBe(42)
      expect(stats.maxMinRatio).toBe(1)
    })

    it("handles empty game list", () => {
      const stats = reporter.compute([], 2)

      expect(stats.meanScore).toBe(0)
      expect(stats.stdDevScore).toBe(0)
      expect(stats.minScore).toBe(0)
      expect(stats.maxScore).toBe(0)
      expect(stats.gameCount).toBe(0)
    })

    it("correctly sets metadata fields", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 10, "p2": 20, "p3": 30 }, 7),
        makeGame(1, { "p1": 15, "p2": 25, "p3": 35 }, 7),
        makeGame(2, { "p1": 5, "p2": 10, "p3": 15 }, 7),
      ]

      const stats = reporter.compute(games, 3)

      expect(stats.playerCount).toBe(3)
      expect(stats.gameCount).toBe(3)
      expect(stats.roundCount).toBe(7)
    })

    it("computes winRateDistribution with correct dimensions", () => {
      const games: GameResult[] = [
        {
          gameIndex: 0,
          rounds: [],
          leaderboard: [
            { playerId: "bot-0", playerName: "Bot 1", score: 10, rank: 1 },
            { playerId: "bot-1", playerName: "Bot 2", score: 5, rank: 2 },
          ],
          finalScores: { "bot-0": 10, "bot-1": 5 },
        },
      ]

      const stats = reporter.compute(games, 2)

      // 2 players → 2x2 distribution
      expect(stats.winRateDistribution).toHaveLength(2)
      expect(stats.winRateDistribution[0]).toHaveLength(2)
      expect(stats.winRateDistribution[1]).toHaveLength(2)
    })

    it("returns 0 earlyLeadCorrelation for games with no rounds", () => {
      const games: GameResult[] = [
        {
          gameIndex: 0,
          rounds: [],
          leaderboard: [
            { playerId: "bot-0", playerName: "Bot 1", score: 10, rank: 1 },
          ],
          finalScores: { "bot-0": 10 },
        },
      ]

      const stats = reporter.compute(games, 1)
      expect(stats.earlyLeadCorrelation).toBe(0)
    })

    it("handles negative scores", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": -10, "p2": 20 }),
        makeGame(1, { "p1": -5, "p2": 15 }),
      ]

      const stats = reporter.compute(games, 2)

      // All scores: [-10, 20, -5, 15], mean = 20/4 = 5
      expect(stats.meanScore).toBe(5)
      expect(stats.minScore).toBe(-10)
      expect(stats.maxScore).toBe(20)
    })

    it("integrates Gini coefficient into compute() output", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 10, "p2": 10, "p3": 10 }),
      ]

      const stats = reporter.compute(games, 3)

      // All equal scores → Gini should be 0
      expect(stats.giniCoefficient).toBe(0)
    })

    it("computes non-zero Gini for unequal scores", () => {
      const games: GameResult[] = [
        makeGame(0, { "p1": 0, "p2": 0, "p3": 0, "p4": 100 }),
      ]

      const stats = reporter.compute(games, 4)

      // Highly unequal → Gini should be close to 1
      expect(stats.giniCoefficient).toBeGreaterThan(0.5)
    })
  })

  describe("computeGini()", () => {
    it("returns 0 for empty array", () => {
      expect(reporter.computeGini([])).toBe(0)
    })

    it("returns 0 when all scores are zero", () => {
      expect(reporter.computeGini([0, 0, 0, 0])).toBe(0)
    })

    it("returns 0 when all scores are identical", () => {
      expect(reporter.computeGini([50, 50, 50, 50])).toBe(0)
    })

    it("returns close to 1 when one player has all the score", () => {
      // [0, 0, 0, ..., 100] → approaches (n-1)/n as n grows
      const scores = [0, 0, 0, 0, 0, 0, 0, 0, 0, 100]
      const gini = reporter.computeGini(scores)
      // For n=10, max Gini = 9/10 = 0.9
      expect(gini).toBeCloseTo(0.9, 5)
    })

    it("is invariant under uniform scalar multiplication", () => {
      const scores = [10, 20, 30, 40, 50]
      const scaledScores = scores.map(s => s * 7)

      const gini = reporter.computeGini(scores)
      const scaledGini = reporter.computeGini(scaledScores)

      expect(scaledGini).toBeCloseTo(gini, 10)
    })

    it("produces result in [0, 1] range", () => {
      const testCases = [
        [1, 2, 3, 4, 5],
        [0, 0, 0, 100],
        [10, 10, 10, 10],
        [1, 1000],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 100],
      ]

      for (const scores of testCases) {
        const gini = reporter.computeGini(scores)
        expect(gini).toBeGreaterThanOrEqual(0)
        expect(gini).toBeLessThanOrEqual(1)
      }
    })

    it("handles negative scores by shifting", () => {
      // With negative scores, Gini should still produce a valid result
      const scores = [-10, -5, 0, 5, 10]
      const gini = reporter.computeGini(scores)

      expect(gini).toBeGreaterThanOrEqual(0)
      expect(gini).toBeLessThanOrEqual(1)
    })

    it("handles single element array", () => {
      // Single value: can't have inequality
      const gini = reporter.computeGini([42])
      expect(gini).toBe(0)
    })
  })

  describe("compute() - streak analysis", () => {
    function makeGameWithDeltas(
      gameIndex: number,
      rounds: Record<string, number>[],
      finalScores: Record<string, number>
    ): GameResult {
      return {
        gameIndex,
        rounds: rounds.map((deltas, i) => ({
          roundNumber: i + 1,
          picks: {},
          result: null,
          deltas,
          cumulativeScores: {},
        })),
        leaderboard: [],
        finalScores,
      }
    }

    it("detects consecutive wins for a single player", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": 3, "bot-1": -3 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.maxConsecutiveWins[0]).toBe(3)
      expect(stats.maxConsecutiveLosses[0]).toBe(1)
    })

    it("detects consecutive losses for a player", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": -3, "bot-1": 3 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.maxConsecutiveLosses[0]).toBe(4)
      expect(stats.maxConsecutiveWins[0]).toBe(1)
    })

    it("tracks streaks across multiple games as one continuous sequence", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": 2, "bot-1": -2 }),
        makeGameWithDeltas(1, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": 2, "bot-1": -2 }),
      ]

      const stats = reporter.compute(games, 2)

      // Streak continues across games: 4 consecutive wins
      expect(stats.maxConsecutiveWins[0]).toBe(4)
      expect(stats.maxConsecutiveLosses[1]).toBe(4)
    })

    it("resets streak when delta is zero", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 0, "bot-1": 0 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": 4, "bot-1": -4 }),
      ]

      const stats = reporter.compute(games, 2)

      // Zero delta breaks streak: max win streak is 3 (not 5)
      expect(stats.maxConsecutiveWins[0]).toBe(3)
    })

    it("returns arrays of correct length for playerCount", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1, "bot-2": 0 },
        ], { "bot-0": 1, "bot-1": -1, "bot-2": 0 }),
      ]

      const stats = reporter.compute(games, 3)

      expect(stats.maxConsecutiveWins).toHaveLength(3)
      expect(stats.maxConsecutiveLosses).toHaveLength(3)
    })

    it("handles player with no wins or losses (all zeros)", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 0, "bot-1": 0 },
          { "bot-0": 0, "bot-1": 0 },
          { "bot-0": 0, "bot-1": 0 },
        ], { "bot-0": 0, "bot-1": 0 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.maxConsecutiveWins[0]).toBe(0)
      expect(stats.maxConsecutiveLosses[0]).toBe(0)
    })

    it("handles empty game list", () => {
      const stats = reporter.compute([], 2)

      expect(stats.maxConsecutiveWins).toEqual([0, 0])
      expect(stats.maxConsecutiveLosses).toEqual([0, 0])
    })
  })

  describe("compute() - scoreVarianceByRound", () => {
    function makeGameWithDeltas(
      gameIndex: number,
      rounds: Record<string, number>[],
      finalScores: Record<string, number>
    ): GameResult {
      return {
        gameIndex,
        rounds: rounds.map((deltas, i) => ({
          roundNumber: i + 1,
          picks: {},
          result: null,
          deltas,
          cumulativeScores: {},
        })),
        leaderboard: [],
        finalScores,
      }
    }

    it("computes variance of deltas at each round position", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 2, "bot-1": 2 },
        ], { "bot-0": 3, "bot-1": 1 }),
        makeGameWithDeltas(1, [
          { "bot-0": -1, "bot-1": 1 },
          { "bot-0": 0, "bot-1": 0 },
        ], { "bot-0": -1, "bot-1": 1 }),
      ]

      const stats = reporter.compute(games, 2)

      // Round 0 deltas: [1, -1, -1, 1] → mean=0, variance = (1+1+1+1)/4 = 1
      expect(stats.scoreVarianceByRound[0]).toBe(1)
      // Round 1 deltas: [2, 2, 0, 0] → mean=1, variance = (1+1+1+1)/4 = 1
      expect(stats.scoreVarianceByRound[1]).toBe(1)
    })

    it("returns zero variance when all deltas are identical", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 5, "bot-1": 5 },
          { "bot-0": 5, "bot-1": 5 },
        ], { "bot-0": 10, "bot-1": 10 }),
        makeGameWithDeltas(1, [
          { "bot-0": 5, "bot-1": 5 },
          { "bot-0": 5, "bot-1": 5 },
        ], { "bot-0": 10, "bot-1": 10 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.scoreVarianceByRound[0]).toBe(0)
      expect(stats.scoreVarianceByRound[1]).toBe(0)
    })

    it("returns array of correct length (roundCount)", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
          { "bot-0": 1, "bot-1": -1 },
        ], { "bot-0": 3, "bot-1": -3 }),
      ]

      const stats = reporter.compute(games, 2)

      expect(stats.scoreVarianceByRound).toHaveLength(3)
    })

    it("handles empty game list", () => {
      const stats = reporter.compute([], 2)

      expect(stats.scoreVarianceByRound).toEqual([])
    })

    it("computes higher variance for more spread-out deltas", () => {
      const games: GameResult[] = [
        makeGameWithDeltas(0, [
          { "bot-0": 10, "bot-1": -10 },  // high spread
          { "bot-0": 1, "bot-1": -1 },    // low spread
        ], { "bot-0": 11, "bot-1": -11 }),
      ]

      const stats = reporter.compute(games, 2)

      // Round 0: [10, -10] → mean=0, var=100
      // Round 1: [1, -1] → mean=0, var=1
      expect(stats.scoreVarianceByRound[0]).toBe(100)
      expect(stats.scoreVarianceByRound[1]).toBe(1)
      expect(stats.scoreVarianceByRound[0]).toBeGreaterThan(stats.scoreVarianceByRound[1])
    })
  })
})
