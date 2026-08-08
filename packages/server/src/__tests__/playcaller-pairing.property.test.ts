/**
 * Feature: playcaller-tournament, Property 4: First-round pairing order
 *
 * Validates: Requirements 2.4
 *
 * Seeding rules:
 * - When byes exist: non-bye players are paired by adjacent seeds
 *   (7v8, 9v10, etc.) — the two highest remaining seeds play for the top
 *   play-in spot, next pair for the next spot.
 * - When no byes exist (power-of-2 player count): standard bracket seeding
 *   is used (e.g., 1v8, 4v5, 3v6, 2v7 for 8 players).
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { generateBracket, computeByeCount, standardBracketOrder } from "../games/playcaller/BracketEngine"

describe("Property 4: First-round pairing order", () => {
  it("when byes exist, non-bye players are paired as adjacent seeds (highest pair first)", () => {
    fc.assert(
      fc.property(
        // Only generate non-power-of-2 player counts (those that have byes)
        fc.integer({ min: 3, max: 10 }).filter((n) => {
          const pow2 = Math.pow(2, Math.ceil(Math.log2(n)))
          return pow2 !== n
        }).chain((n) =>
          fc.constant(n).map((count) =>
            Array.from({ length: count }, (_, i) => `player-${i + 1}`)
          )
        ),
        (players) => {
          const bracket = generateBracket(players)
          const firstRound = bracket.rounds[0]
          const byeCount = computeByeCount(players.length)

          // Non-bye players are those after the first byeCount players
          const nonByePlayers = players.slice(byeCount)
          const half = nonByePlayers.length / 2
          expect(firstRound.matchups.length).toBe(half)

          // Adjacent pairs: (nonBye[0] vs nonBye[1]), (nonBye[2] vs nonBye[3]), etc.
          for (let i = 0; i < half; i++) {
            const matchup = firstRound.matchups[i]
            const expectedHigher = nonByePlayers[i * 2]     // higher seed in pair
            const expectedLower = nonByePlayers[i * 2 + 1]  // lower seed in pair

            expect(matchup.playerA).toBe(expectedHigher)
            expect(matchup.playerB).toBe(expectedLower)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("when no byes exist (power-of-2 players), uses standard bracket seeding order", () => {
    fc.assert(
      fc.property(
        // Only power-of-2 player counts: 2, 4, 8
        fc.constantFrom(2, 4, 8).chain((n) =>
          fc.constant(n).map((count) =>
            Array.from({ length: count }, (_, i) => `player-${i + 1}`)
          )
        ),
        (players) => {
          const bracket = generateBracket(players)
          const firstRound = bracket.rounds[0]

          // Standard bracket order determines pairings
          const order = standardBracketOrder(players.length)
          const expectedMatchups = order.length / 2

          expect(firstRound.matchups.length).toBe(expectedMatchups)

          for (let i = 0; i < expectedMatchups; i++) {
            const matchup = firstRound.matchups[i]
            const seedA = order[i * 2]
            const seedB = order[i * 2 + 1]
            expect(matchup.playerA).toBe(players[seedA - 1])
            expect(matchup.playerB).toBe(players[seedB - 1])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
