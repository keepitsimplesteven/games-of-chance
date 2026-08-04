/**
 * Feature: playcaller-tournament, Property 5: Winner advancement
 *
 * Validates: Requirements 3.1, 3.2, 4.2
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { generateBracket, resolveCurrentRound } from "../games/playcaller/BracketEngine"
import type { MatchResolver } from "@games-of-chance/shared"

describe("Property 5: Winner advancement", () => {
  it("every matchup winner from the resolved round appears in next round's matchups", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          const bracket = generateBracket(players)

          // Only resolve if it's not the final round (need a next round to check)
          if (bracket.totalRounds <= 1) {
            // 2-player bracket has only 1 round; resolve and check index increment
            const resolved = resolveCurrentRound(bracket, resolver)
            expect(resolved.currentRoundIndex).toBe(1)
            return
          }

          const roundIndexBefore = bracket.currentRoundIndex
          const resolved = resolveCurrentRound(bracket, resolver)

          // Gather winners from the just-resolved round
          const resolvedRound = resolved.rounds[roundIndexBefore]
          const winners = resolvedRound.matchups.map((m) => m.winner!)

          // Gather all participants in the next round's matchups
          const nextRound = resolved.rounds[roundIndexBefore + 1]
          const nextRoundParticipants = nextRound.matchups.flatMap((m) => [
            m.playerA,
            m.playerB,
          ])

          // Every winner must appear in the next round
          for (const winner of winners) {
            expect(nextRoundParticipants).toContain(winner)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("currentRoundIndex increments by exactly 1 after resolution", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          const bracket = generateBracket(players)
          const indexBefore = bracket.currentRoundIndex
          const resolved = resolveCurrentRound(bracket, resolver)

          expect(resolved.currentRoundIndex).toBe(indexBefore + 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("bye players from the resolved round also appear in next round's matchups", () => {
    fc.assert(
      fc.property(
        // Only non-power-of-2 counts have byes: 3, 5, 6, 7, 9, 10
        fc.constantFrom(3, 5, 6, 7, 9, 10),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          const bracket = generateBracket(players)
          const firstRound = bracket.rounds[0]

          // Confirm there are byes
          expect(firstRound.byes.length).toBeGreaterThan(0)

          const resolved = resolveCurrentRound(bracket, resolver)

          // Gather all participants in the next round's matchups
          const nextRound = resolved.rounds[1]
          const nextRoundParticipants = nextRound.matchups.flatMap((m) => [
            m.playerA,
            m.playerB,
          ])

          // Every bye player must appear in the next round
          for (const byePlayer of firstRound.byes) {
            expect(nextRoundParticipants).toContain(byePlayer)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
