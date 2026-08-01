import { describe, it, expect, afterEach } from "vitest"
import * as fc from "fast-check"
import { simulateGame } from "./core"
import { SeededRng } from "./rng"
import { RandomBot, createBotPlayers } from "./bot"
import { PickGeneratorRegistry, type PickGenerator } from "./pick-generator"
import type { GamePlugin } from "@games-of-chance/server/src/games/GamePlugin"
import type { Player, GameLeaderboardEntry, RoundScoreResult } from "@games-of-chance/shared"
import type { Rng } from "./rng"

const MOCK_GAME_TYPE = "mock-generic-game" as const

describe("Generic Game Type Support Property Tests", () => {
  /**
   * Property 10: Generic Game Type Support
   * For any game plugin registered in the GameRegistry with a corresponding
   * PickGenerator registered in the PickGeneratorRegistry, the SimulationCore
   * SHALL successfully execute a complete game without game-type-specific
   * branching or errors.
   *
   * **Validates: Requirements 6.4**
   */
  it("SimulationCore runs any mock GamePlugin without game-type-specific errors", () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed for the simulation RNG
        fc.integer({ min: 2, max: 10 }), // playerCount
        fc.integer({ min: 1, max: 20 }), // roundCount
        fc.integer(), // seed for mock behaviors
        (simSeed, playerCount, roundCount, mockBehaviorSeed) => {
          // Create a PRNG for driving mock behaviors deterministically
          const mockRng = new SeededRng(mockBehaviorSeed)

          // Create mock PickGenerator that returns an arbitrary pick object
          const mockPickGenerator: PickGenerator = {
            gameType: MOCK_GAME_TYPE,
            generatePick(rng: Rng): unknown {
              // Return a random pick value — could be any shape
              return { value: rng.nextInt(100), label: `pick-${rng.nextInt(1000)}` }
            },
          }

          // Create mock GamePlugin with random behaviors
          const mockPlugin: GamePlugin = {
            gameType: MOCK_GAME_TYPE,
            pickWindowMs: 5000,

            validatePick(_pick: unknown): _pick is unknown {
              // Always valid — the property tests that the core doesn't
              // depend on specific pick validation logic
              return true
            },

            resolveRound(_picks: Record<string, unknown>): unknown {
              // Return an arbitrary result object
              return {
                outcome: mockRng.nextInt(10),
                detail: `result-${mockRng.nextInt(1000)}`,
              }
            },

            scoreRound(
              _picks: Record<string, unknown>,
              _result: unknown,
              players: Player[]
            ): RoundScoreResult {
              // Return random deltas for each player
              const deltas: Record<string, number> = {}
              for (const p of players) {
                // Deltas can be positive or negative
                deltas[p.id] = mockRng.nextInt(21) - 10 // range [-10, 10]
              }
              return { deltas }
            },

            computeGameLeaderboard(
              players: Player[],
              gameScores: Record<string, number>
            ): GameLeaderboardEntry[] {
              // Return sorted entries based on scores (descending)
              const entries = players.map((p) => ({
                playerId: p.id,
                playerName: p.name,
                score: gameScores[p.id] ?? 0,
                rank: 0,
              }))
              entries.sort((a, b) => b.score - a.score)
              entries.forEach((entry, idx) => {
                entry.rank = idx + 1
              })
              return entries
            },
          }

          // Run the simulation
          const players = createBotPlayers(playerCount)
          const rng = new SeededRng(simSeed)
          const bot = new RandomBot()

          const result = simulateGame(
            mockPlugin,
            players,
            roundCount,
            bot,
            mockPickGenerator,
            rng,
            0
          )

          // Verify structure — no game-type-specific errors thrown
          expect(result).toBeDefined()
          expect(result.rounds).toHaveLength(roundCount)
          expect(result.leaderboard).toHaveLength(playerCount)
          expect(Object.keys(result.finalScores)).toHaveLength(playerCount)

          // Verify each round record has the expected structure
          for (const round of result.rounds) {
            expect(round.roundNumber).toBeGreaterThanOrEqual(1)
            expect(round.roundNumber).toBeLessThanOrEqual(roundCount)
            expect(Object.keys(round.picks)).toHaveLength(playerCount)
            expect(Object.keys(round.deltas)).toHaveLength(playerCount)
            expect(Object.keys(round.cumulativeScores)).toHaveLength(playerCount)
            expect(round.result).toBeDefined()
          }

          // Verify leaderboard entries have valid ranks
          for (const entry of result.leaderboard) {
            expect(entry.rank).toBeGreaterThanOrEqual(1)
            expect(entry.rank).toBeLessThanOrEqual(playerCount)
            expect(entry.playerId).toBeDefined()
            expect(entry.playerName).toBeDefined()
          }

          // Verify all players are represented in finalScores
          for (const p of players) {
            expect(result.finalScores).toHaveProperty(p.id)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
