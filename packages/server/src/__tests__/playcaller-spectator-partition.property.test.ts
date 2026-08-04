/**
 * Feature: playcaller-tournament, Property 8: Spectator/active player partition
 *
 * Validates: Requirements 5.2, 7.1, 7.3
 */
import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import {
  setPlaycallerState,
  resetPlaycallerState,
  getSpectators,
  getActiveCompetitors,
} from "../games/playcaller/PlaycallerPlugin"
import { generateBracket, resolveCurrentRound } from "../games/playcaller/BracketEngine"
import type { MatchResolver } from "@games-of-chance/shared"

describe("Property 8: Spectator/active player partition", () => {
  beforeEach(() => {
    resetPlaycallerState()
  })

  it("spectators and active competitors are disjoint and their union equals all tournament players", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("A", "B") as fc.Arbitrary<"A" | "B">,
        fc.integer({ min: 0, max: 10 }),
        (playerCount, strategy, roundsSeed) => {
          const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          // Generate bracket
          let bracket = generateBracket(playerIds)
          const totalRounds = bracket.totalRounds

          // Resolve 0 to (totalRounds - 1) rounds (never the last one so there are always active players)
          const roundsToResolve = Math.min(
            roundsSeed % totalRounds,
            totalRounds - 1
          )

          for (let i = 0; i < roundsToResolve; i++) {
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // Set the bracket state
          setPlaycallerState(bracket)

          // Get spectators and active competitors
          const spectators = getSpectators()
          const activeCompetitors = getActiveCompetitors()

          const spectatorSet = new Set(spectators)
          const activeSet = new Set(activeCompetitors)

          // 1. Verify disjointness: no player in both sets
          const intersection = new Set(
            [...spectatorSet].filter((p) => activeSet.has(p))
          )
          expect(intersection.size).toBe(0)

          // 2. Verify completeness: union equals all tournament players
          const union = new Set([...spectatorSet, ...activeSet])
          expect(union.size).toBe(playerCount)

          // Also verify that every original player appears in the union
          for (const id of playerIds) {
            expect(union.has(id)).toBe(true)
          }

          // Reset state for next iteration
          resetPlaycallerState()
        }
      ),
      { numRuns: 100 }
    )
  })
})
