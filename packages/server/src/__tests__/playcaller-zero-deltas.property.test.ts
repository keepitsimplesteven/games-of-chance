/**
 * Feature: playcaller-tournament, Property 10: Zero deltas before final round
 *
 * Validates: Requirements 6.5
 */
import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import { playcallerPlugin, setPlaycallerState, resetPlaycallerState } from "../games/playcaller/PlaycallerPlugin"
import { generateBracket, resolveCurrentRound } from "../games/playcaller/BracketEngine"
import type { GameSettings, MatchResolver, Player } from "@games-of-chance/shared"

describe("Property 10: Zero deltas before final round", () => {
  beforeEach(() => {
    resetPlaycallerState()
  })

  it("scoreRound returns empty deltas for non-final bracket rounds", () => {
    const settings: GameSettings = {
      roundCount: 3,
      pickWindowMs: 3000,
      tuning: {},
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.constantFrom("A", "B") as fc.Arbitrary<"A" | "B">,
        (playerCount, strategy) => {
          const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          const players: Player[] = playerIds.map((id) => ({
            id,
            name: id,
            role: "player" as const,
            connected: true,
            connectionId: id,
          }))

          // Generate bracket and set it into plugin state
          const bracket = generateBracket(playerIds)

          // Set the bracket state for the plugin
          setPlaycallerState(bracket)

          // Resolve the first round via the plugin
          const result = playcallerPlugin.resolveRound({}, settings)

          // Since playerCount >= 3, there are at least 2 rounds,
          // so resolving the first round should NOT complete the tournament
          expect(result.isComplete).toBe(false)

          // scoreRound should return empty deltas for a non-final round
          const scoreResult = playcallerPlugin.scoreRound({}, result, players, settings)
          expect(scoreResult.deltas).toEqual({})

          // Reset state for next iteration
          resetPlaycallerState()
        }
      ),
      { numRuns: 100 }
    )
  })
})
