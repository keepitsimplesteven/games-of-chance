import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import { SeededRng } from "./rng"
import { RandomBot, createBotPlayers } from "./bot"
import { pickGeneratorRegistry } from "./pick-generator"
import { coinTossPlugin } from "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"
import { simulateGame } from "./core"
import { StatisticsReporter } from "./statistics"
import type { GameResult } from "./core"

// Side-effect import: registers the coin-toss pick generator
import "./pick-generators/coin-toss"

/**
 * Helper: creates mock GameResult objects from an array of finalScores.
 * Each score in the array becomes a player's final score in a single game.
 */
function makeGameFromScores(scores: number[]): GameResult {
  const finalScores: Record<string, number> = {}
  for (let i = 0; i < scores.length; i++) {
    finalScores[`bot-${i}`] = scores[i]
  }

  return {
    gameIndex: 0,
    rounds: [
      {
        roundNumber: 1,
        picks: {},
        result: null,
        deltas: finalScores,
        cumulativeScores: finalScores,
      },
    ],
    leaderboard: scores.map((score, i) => ({
      playerId: `bot-${i}`,
      playerName: `Bot ${i + 1}`,
      score,
      rank: i + 1,
    })),
    finalScores,
  }
}

describe("Gini Coefficient Mathematical Properties", () => {
  const reporter = new StatisticsReporter()

  /**
   * Property 6: Gini Coefficient Mathematical Properties
   *
   * **Validates: Requirements 5.2**
   */

  /**
   * (a) For any array of N identical positive values, computeGini should return 0
   */
  it("identical scores produce Gini coefficient of 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 2, max: 100 }),
        (value, count) => {
          const scores = new Array(count).fill(value)
          const gini = reporter.computeGini(scores)
          expect(gini).toBeCloseTo(0, 10)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * (b) For any array of non-negative scores, computeGini should always be in [0, 1]
   */
  it("Gini coefficient is always in [0, 1] for non-negative scores", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
          { minLength: 2, maxLength: 100 }
        ),
        (scores) => {
          const sum = scores.reduce((a, b) => a + b, 0)
          fc.pre(sum > 0)

          const gini = reporter.computeGini(scores)
          expect(gini).toBeGreaterThanOrEqual(-1e-10)
          expect(gini).toBeLessThanOrEqual(1 + 1e-10)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * (c) Scalar invariance: Gini(k*x) = Gini(x) for any scalar k > 0
   */
  it("Gini coefficient is invariant under uniform scalar multiplication", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: 0.01, max: 1e4, noNaN: true, noDefaultInfinity: true }),
          { minLength: 2, maxLength: 50 }
        ),
        fc.double({ min: 0.01, max: 1e4, noNaN: true, noDefaultInfinity: true }),
        (scores, scalar) => {
          const sum = scores.reduce((a, b) => a + b, 0)
          fc.pre(sum > 0)

          const giniOriginal = reporter.computeGini(scores)
          const scaledScores = scores.map(s => s * scalar)
          const giniScaled = reporter.computeGini(scaledScores)

          expect(giniScaled).toBeCloseTo(giniOriginal, 8)
        }
      ),
      { numRuns: 500 }
    )
  })
})


describe("Variance Non-Negativity and Mean Correctness Property Tests", () => {
  const reporter = new StatisticsReporter()

  /**
   * Property 9: Variance Non-Negativity and Mean Correctness
   * For any array of numeric scores:
   * (a) computed variance SHALL be >= 0
   * (b) computed mean SHALL equal the arithmetic mean (sum / count)
   * (c) standard deviation SHALL equal the square root of variance
   *
   * **Validates: Requirements 5.1, 5.7**
   */
  it("(a) variance is always non-negative for arbitrary score arrays", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 50 }),
        (scores) => {
          const games = [makeGameFromScores(scores)]
          const stats = reporter.compute(games, scores.length)

          // Variance = stdDev^2, and it must be >= 0
          const variance = stats.stdDevScore ** 2
          expect(variance).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("(b) mean equals sum of scores divided by count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 50 }),
        (scores) => {
          const games = [makeGameFromScores(scores)]
          const stats = reporter.compute(games, scores.length)

          const expectedMean = scores.reduce((sum, s) => sum + s, 0) / scores.length
          expect(stats.meanScore).toBeCloseTo(expectedMean, 10)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("(c) stdDev equals sqrt(variance) where variance = mean((x - mean)^2)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 50 }),
        (scores) => {
          const games = [makeGameFromScores(scores)]
          const stats = reporter.compute(games, scores.length)

          // Manually compute expected variance and stdDev
          const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
          const expectedVariance =
            scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
          const expectedStdDev = Math.sqrt(expectedVariance)

          expect(stats.stdDevScore).toBeCloseTo(expectedStdDev, 10)
          expect(expectedVariance).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe("Statistical Output Bounds Property Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Property 8: Statistical Output Bounds
   * For any batch of game results:
   * (a) the Pearson early-lead correlation SHALL be in [-1, 1]
   * (b) maximum consecutive wins per player position SHALL be in [0, roundCount * gameCount]
   * (c) maximum consecutive losses per player position SHALL be in [0, roundCount * gameCount]
   *
   * Note: streaks span across games in the current implementation, so the upper
   * bound is roundCount * gameCount (total rounds across all games).
   *
   * **Validates: Requirements 5.5, 5.6**
   */
  it("earlyLeadCorrelation ∈ [-1,1], maxConsecutiveWins/Losses ∈ [0, roundCount*gameCount]", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 3, max: 20 }),
        fc.integer({ min: 3, max: 20 }),
        (seed, playerCount, roundCount, gameCount) => {
          const generator = pickGeneratorRegistry.lookup("coin-toss")
          const players = createBotPlayers(playerCount)
          const bot = new RandomBot()

          // Stub Math.random for determinism in CoinTossPlugin.resolveRound
          vi.setSystemTime(1000)
          const mathRng = new SeededRng(seed + 999_999)
          vi.spyOn(Math, "random").mockImplementation(() => mathRng.next())

          const rng = new SeededRng(seed)
          const games: GameResult[] = []

          for (let i = 0; i < gameCount; i++) {
            const result = simulateGame(
              coinTossPlugin,
              players,
              roundCount,
              bot,
              generator,
              rng,
              i
            )
            games.push(result)
          }

          vi.restoreAllMocks()

          const reporter = new StatisticsReporter()
          const stats = reporter.compute(games, playerCount)

          const totalRounds = roundCount * gameCount

          // (a) Pearson correlation ∈ [-1, 1]
          expect(stats.earlyLeadCorrelation).toBeGreaterThanOrEqual(-1)
          expect(stats.earlyLeadCorrelation).toBeLessThanOrEqual(1)

          // (b) maxConsecutiveWins ∈ [0, totalRounds] for each player position
          for (let p = 0; p < playerCount; p++) {
            expect(stats.maxConsecutiveWins[p]).toBeGreaterThanOrEqual(0)
            expect(stats.maxConsecutiveWins[p]).toBeLessThanOrEqual(totalRounds)
          }

          // (c) maxConsecutiveLosses ∈ [0, totalRounds] for each player position
          for (let p = 0; p < playerCount; p++) {
            expect(stats.maxConsecutiveLosses[p]).toBeGreaterThanOrEqual(0)
            expect(stats.maxConsecutiveLosses[p]).toBeLessThanOrEqual(totalRounds)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
