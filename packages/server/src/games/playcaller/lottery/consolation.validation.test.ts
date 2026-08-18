import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  isFullyComplete,
  generateConsolationForRound,
  resolveConsolationRound,
  computePlacements,
} from "../BracketEngine"
import { randomResolver } from "../MatchResolver"
import type { Bracket, MatchResolver } from "@games-of-chance/shared"

/**
 * Helper: fully resolves a bracket using incremental consolation generation
 * (matches the production code path in PlaycallerPlugin.resolveRound).
 *
 * Resolves main rounds one at a time, generating consolation after each round,
 * then resolves all consolation rounds at the end.
 */
function fullyResolveBracketIncremental(players: string[], resolver: MatchResolver = randomResolver): { bracket: Bracket; placements: Map<string, number> } {
  let bracket = generateBracket(players)

  // Resolve main bracket rounds incrementally, generating consolation after each
  while (!isComplete(bracket)) {
    const currentRoundIndex = bracket.currentRoundIndex
    bracket = resolveCurrentRound(bracket, resolver)

    // Generate consolation for players eliminated in this round
    const newConsolation = generateConsolationForRound(
      bracket,
      currentRoundIndex,
      bracket.consolationRounds.length
    )
    if (newConsolation.length > 0) {
      bracket.consolationRounds.push(...newConsolation)
    }
  }

  // Resolve all consolation rounds
  bracket.currentConsolationIndex = 0
  while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
    bracket = resolveConsolationRound(bracket, resolver)
  }

  const placements = computePlacements(bracket)
  return { bracket, placements }
}

describe("Consolation Bracket Validation", () => {
  /**
   * **Validates: Requirements 1.3, 1.4, 1.5**
   *
   * Property: for supported player counts with even elimination groups,
   * after full resolution with consolation, all placements are unique 1..N.
   * Player counts where all elimination groups have >=2 players: 2, 3, 4, 6, 8, 10.
   */
  describe("unique placements (property test)", () => {
    it("for any player count 2-10 with full consolation coverage, all placements are unique 1..N after full resolution", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(2, 3, 4, 6, 8, 10),
          (playerCount) => {
            // Generate player IDs
            const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`)

            const { placements } = fullyResolveBracketIncremental(players)

            // Verify all placements are unique 1..N
            const placementValues = [...placements.values()].sort((a, b) => a - b)
            const expected = Array.from({ length: playerCount }, (_, i) => i + 1)

            expect(placementValues).toEqual(expected)
            expect(placements.size).toBe(playerCount)
          }
        ),
        { numRuns: 200, seed: 42 }
      )
    })
  })

  describe("non-lottery mode backwards compatibility", () => {
    it("consolation rounds produce unique placements without lottery mode (random resolver)", () => {
      // Test player counts with full consolation coverage
      const supportedCounts = [2, 3, 4, 6, 8, 10]
      for (let run = 0; run < 50; run++) {
        const playerCount = supportedCounts[run % supportedCounts.length]
        const players = Array.from({ length: playerCount }, (_, i) => `p${i}`)

        const { placements } = fullyResolveBracketIncremental(players)

        const values = [...placements.values()].sort((a, b) => a - b)
        const expected = Array.from({ length: playerCount }, (_, i) => i + 1)
        expect(values).toEqual(expected)
      }
    })

    it("all players receive exactly one unique placement", () => {
      const players = ["alice", "bob", "charlie", "dave", "eve", "frank"]
      const { placements } = fullyResolveBracketIncremental(players)

      expect(placements.size).toBe(6)
      for (const player of players) {
        expect(placements.has(player)).toBe(true)
        const p = placements.get(player)!
        expect(p).toBeGreaterThanOrEqual(1)
        expect(p).toBeLessThanOrEqual(6)
      }
    })
  })
})
