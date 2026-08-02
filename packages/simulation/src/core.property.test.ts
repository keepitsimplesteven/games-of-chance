import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import { SeededRng } from "./rng"
import { RandomBot, createBotPlayers } from "./bot"
import { pickGeneratorRegistry } from "./pick-generator"
import { coinTossPlugin, resetCoinTossStreakState } from "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"
import { simulateGame } from "./core"

// Side-effect import: registers the coin-toss pick generator
import "./pick-generators/coin-toss"

describe("Seed Determinism (full simulation) Property Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Property 2: Seed Determinism (full simulation)
   * For any seed value and simulation config (players 2-10, rounds 1-50),
   * running simulateGame twice with the same seed and config SHALL produce
   * identical game results (same picks, same round results, same final scores,
   * same leaderboard).
   *
   * Note: CoinTossPlugin.resolveRound uses Math.random() and Date.now() internally,
   * so we stub both with deterministic implementations to ensure full determinism.
   *
   * **Validates: Requirements 1.4**
   */
  it("running simulateGame twice with same seed/config produces identical results", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        (seed, playerCount, roundCount) => {
          const generator = pickGeneratorRegistry.lookup("coin-toss")
          const players = createBotPlayers(playerCount)
          const bot = new RandomBot()

          // First run: stub Math.random with a seeded sequence, fix time
          vi.setSystemTime(1000)
          const mathRng1 = new SeededRng(seed + 999_999)
          vi.spyOn(Math, "random").mockImplementation(() => mathRng1.next())

          resetCoinTossStreakState()
          const rng1 = new SeededRng(seed)
          const result1 = simulateGame(
            coinTossPlugin,
            players,
            roundCount,
            bot,
            generator,
            rng1,
            0
          )

          vi.restoreAllMocks()

          // Second run: same stubs for Math.random and time
          vi.setSystemTime(1000)
          const mathRng2 = new SeededRng(seed + 999_999)
          vi.spyOn(Math, "random").mockImplementation(() => mathRng2.next())

          resetCoinTossStreakState()
          const rng2 = new SeededRng(seed)
          const result2 = simulateGame(
            coinTossPlugin,
            players,
            roundCount,
            bot,
            generator,
            rng2,
            0
          )

          vi.restoreAllMocks()

          // 1. All round picks are identical
          for (let r = 0; r < roundCount; r++) {
            expect(result1.rounds[r].picks).toEqual(result2.rounds[r].picks)
          }

          // 2. All round results are identical
          for (let r = 0; r < roundCount; r++) {
            expect(result1.rounds[r].result).toEqual(result2.rounds[r].result)
          }

          // 3. All round deltas are identical
          for (let r = 0; r < roundCount; r++) {
            expect(result1.rounds[r].deltas).toEqual(result2.rounds[r].deltas)
          }

          // 4. Final scores are identical
          expect(result1.finalScores).toEqual(result2.finalScores)

          // 5. Leaderboards are identical
          expect(result1.leaderboard).toEqual(result2.leaderboard)
        }
      ),
      { numRuns: 100 }
    )
  })
})
