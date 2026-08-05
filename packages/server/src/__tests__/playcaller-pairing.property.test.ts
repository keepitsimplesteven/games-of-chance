/**
 * Feature: playcaller-tournament, Property 4: First-round pairing order
 *
 * Validates: Requirements 2.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { generateBracket, computeByeCount } from "../games/playcaller/BracketEngine"

describe("Property 4: First-round pairing order", () => {
  it("non-bye players are paired highest-vs-lowest, second-highest-vs-second-lowest, inward", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain((n) =>
          fc.constant(n).map((count) =>
            Array.from({ length: count }, (_, i) => `player-${i + 1}`)
          )
        ),
        (players) => {
          const bracket = generateBracket(players)
          const firstRound = bracket.rounds[0]
          const byeCount = computeByeCount(players.length)

          // Non-bye players are those after the first byeCount players (highest seeds get byes)
          const nonByePlayers = players.slice(byeCount)

          // For each matchup i, playerA should be nonByePlayers[i] (highest remaining)
          // and playerB should be nonByePlayers[nonByePlayers.length - 1 - i] (lowest remaining)
          const half = nonByePlayers.length / 2
          expect(firstRound.matchups.length).toBe(half)

          for (let i = 0; i < half; i++) {
            const matchup = firstRound.matchups[i]
            const expectedHigher = nonByePlayers[i]
            const expectedLower = nonByePlayers[nonByePlayers.length - 1 - i]

            expect(matchup.playerA).toBe(expectedHigher)
            expect(matchup.playerB).toBe(expectedLower)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
