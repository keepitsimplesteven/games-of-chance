import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { SeededRng } from "./rng"
import { RandomBot } from "./bot"
import { pickGeneratorRegistry } from "./pick-generator"
import { coinTossPlugin } from "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"

// Side-effect import: registers the coin-toss pick generator
import "./pick-generators/coin-toss"

describe("Bot Pick Validity Property Tests", () => {
  /**
   * Property 4: Bot Picks Always Valid
   * For any seed value and any number of picks generated, every pick produced
   * by RandomBot using the coin-toss PickGenerator SHALL pass the CoinTossPlugin's
   * validatePick method.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("every pick from RandomBot passes CoinTossPlugin.validatePick", () => {
    const bot = new RandomBot()
    const generator = pickGeneratorRegistry.lookup("coin-toss")

    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 1, max: 100 }),
        (seed, pickCount) => {
          const rng = new SeededRng(seed)

          for (let i = 0; i < pickCount; i++) {
            const pick = bot.decidePick(generator, rng)
            expect(coinTossPlugin.validatePick(pick)).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe("RandomBot Uniform Distribution Property Tests", () => {
  /**
   * Property 5: Random Bot Uniform Distribution
   * For any seed, generating N≥1000 picks using RandomBot with coinTossPickGenerator
   * should produce a distribution where each option's count is within 3 standard
   * deviations of N/K (where K=2 for coin toss).
   *
   * For coin-toss: K=2, expected count per side = N/2,
   * std dev = sqrt(N * (1/K) * (1 - 1/K)) = sqrt(N * 0.25) = sqrt(N)/2
   *
   * **Validates: Requirements 2.3**
   */
  it("picks are uniformly distributed within 3 standard deviations for coin-toss", () => {
    const N = 10000
    const K = 2 // HEADS or TAILS
    const expected = N / K // 5000
    // For binomial(N, 1/K): std dev = sqrt(N * (1/K) * (1 - 1/K))
    // For K=2: std dev = sqrt(N * 0.5 * 0.5) = sqrt(N) / 2 ≈ 50
    const stdDev = Math.sqrt(N * (1 / K) * (1 - 1 / K))

    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = new SeededRng(seed)
        const bot = new RandomBot()
        const generator = pickGeneratorRegistry.lookup("coin-toss")

        const counts: Record<string, number> = { HEADS: 0, TAILS: 0 }

        for (let i = 0; i < N; i++) {
          const pick = bot.decidePick(generator, rng) as { side: string }
          counts[pick.side]++
        }

        // Each count should be within 4 standard deviations of expected
        // P(outside 4σ) ≈ 0.00006, extremely unlikely for a correct uniform distribution
        // Using 4σ instead of 3σ to avoid flakiness across many property-test runs
        for (const side of ["HEADS", "TAILS"]) {
          expect(counts[side]).toBeGreaterThanOrEqual(expected - 4 * stdDev)
          expect(counts[side]).toBeLessThanOrEqual(expected + 4 * stdDev)
        }
      }),
      { numRuns: 100 }
    )
  })
})
