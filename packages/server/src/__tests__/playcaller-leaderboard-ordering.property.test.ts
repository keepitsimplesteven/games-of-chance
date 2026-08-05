/**
 * Feature: playcaller-tournament, Property 13: In-progress leaderboard ordering
 *
 * Validates: Requirements 12.3
 */
import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import { playcallerPlugin, setPlaycallerState, resetPlaycallerState } from "../games/playcaller/PlaycallerPlugin"
import { generateBracket, resolveCurrentRound, isComplete } from "../games/playcaller/BracketEngine"
import type { Player, MatchResolver } from "@games-of-chance/shared"

describe("Property 13: In-progress leaderboard ordering", () => {
  beforeEach(() => {
    resetPlaycallerState()
  })

  it("all active competitors rank above all eliminated players in a partially-resolved bracket", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.constantFrom("A", "B"),
        (playerCount, strategy) => {
          const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          // Generate bracket and resolve exactly 1 round
          let bracket = generateBracket(playerIds)
          bracket = resolveCurrentRound(bracket, resolver)

          // Only test if the bracket is partially resolved (not yet complete)
          if (isComplete(bracket)) {
            // For brackets with only 1 round (e.g., player count that's a power of 2 with 2 players),
            // skip — we need a partial state
            return
          }

          // Set the partially-resolved bracket state
          setPlaycallerState(bracket)

          // Create Player[] objects from the player IDs
          const players: Player[] = playerIds.map(id => ({
            id,
            name: id,
            role: "player" as const,
            connected: true,
            connectionId: id,
          }))

          // Call computeGameLeaderboard
          const leaderboard = playcallerPlugin.computeGameLeaderboard(players, {})

          // Identify which players are active (not eliminated) and which are eliminated
          const eliminated = new Set(Object.keys(bracket.eliminated))
          const activeEntries = leaderboard.filter(e => !eliminated.has(e.playerId))
          const eliminatedEntries = leaderboard.filter(e => eliminated.has(e.playerId))

          // There should be at least one eliminated player after resolving a round
          expect(eliminatedEntries.length).toBeGreaterThan(0)
          // There should be at least one active player (bracket not complete)
          expect(activeEntries.length).toBeGreaterThan(0)

          // Verify: the maximum rank among active players < the minimum rank among eliminated players
          const maxActiveRank = Math.max(...activeEntries.map(e => e.rank))
          const minEliminatedRank = Math.min(...eliminatedEntries.map(e => e.rank))

          expect(maxActiveRank).toBeLessThan(minEliminatedRank)
        }
      ),
      { numRuns: 100 }
    )
  })
})
