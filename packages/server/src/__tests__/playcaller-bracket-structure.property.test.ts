/**
 * Feature: playcaller-tournament, Property 1: Bracket structural validity
 *
 * Validates: Requirements 2.1, 2.6, 3.4, 10.1
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { generateBracket } from "../games/playcaller/BracketEngine"

describe("Property 1: Bracket structural validity", () => {
  it("totalRounds equals ceil(log2(N)) for player counts 2-10", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).map((n) =>
          Array.from({ length: n }, (_, i) => `p${i + 1}`)
        ),
        (players) => {
          const bracket = generateBracket(players)
          const expectedRounds = Math.ceil(Math.log2(players.length))
          expect(bracket.totalRounds).toBe(expectedRounds)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("every player appears exactly once (in first-round matchups or byes)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).map((n) =>
          Array.from({ length: n }, (_, i) => `p${i + 1}`)
        ),
        (players) => {
          const bracket = generateBracket(players)
          const firstRound = bracket.rounds[0]

          // Collect all players from matchups
          const matchupPlayers = firstRound.matchups.flatMap((m) => [
            m.playerA,
            m.playerB,
          ])

          // Collect bye players
          const byePlayers = firstRound.byes

          // Union of matchup players and bye players
          const allPlaced = [...matchupPlayers, ...byePlayers]

          // Every player appears exactly once
          expect(allPlaced.sort()).toEqual([...players].sort())
          expect(allPlaced.length).toBe(players.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("the final round has exactly one matchup", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).map((n) =>
          Array.from({ length: n }, (_, i) => `p${i + 1}`)
        ),
        (players) => {
          const bracket = generateBracket(players)
          const finalRound = bracket.rounds[bracket.rounds.length - 1]
          expect(finalRound.matchups.length).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
