/**
 * Feature: playcaller-tournament, Property 7: Bye players bypass the resolver
 *
 * For any bracket with byes, the Match_Resolver SHALL NOT be invoked for bye
 * players, and all bye players SHALL appear as participants in the second
 * round's matchups.
 *
 * Validates: Requirements 5.1
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
} from "../games/playcaller/BracketEngine"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Non-power-of-2 player counts that produce byes */
const nonPowerOf2CountArb = fc.constantFrom(3, 5, 6, 7, 9, 10)

// ── Property 7: Bye players bypass the resolver ────────────────────────────

describe("Feature: playcaller-tournament, Property 7: Bye players bypass the resolver", () => {
  /**
   * Property 7.1: The resolver is never called with any bye player as either argument
   *
   * **Validates: Requirements 5.1**
   */
  it("resolver is never called with a bye player as either argument", () => {
    fc.assert(
      fc.property(nonPowerOf2CountArb, (playerCount) => {
        const playerIds = Array.from(
          { length: playerCount },
          (_, i) => `player-${i + 1}`
        )
        const bracket = generateBracket(playerIds)
        const byePlayers = new Set(bracket.rounds[0].byes)

        // Inject a counting resolver that tracks which pairs it's called with
        const calledWith: Array<[string, string]> = []
        const countingResolver = (playerA: string, playerB: string): string => {
          calledWith.push([playerA, playerB])
          return playerA // deterministic: always pick playerA
        }

        resolveCurrentRound(bracket, countingResolver)

        // Verify that no bye player appears in any resolver call
        for (const [pA, pB] of calledWith) {
          expect(byePlayers.has(pA)).toBe(false)
          expect(byePlayers.has(pB)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.2: All bye players appear in round 2's matchups
   *
   * **Validates: Requirements 5.1**
   */
  it("all bye players appear in round 2 matchups after resolving round 1", () => {
    fc.assert(
      fc.property(nonPowerOf2CountArb, (playerCount) => {
        const playerIds = Array.from(
          { length: playerCount },
          (_, i) => `player-${i + 1}`
        )
        const bracket = generateBracket(playerIds)
        const byePlayers = bracket.rounds[0].byes

        const countingResolver = (playerA: string, playerB: string): string => {
          return playerA
        }

        const resolved = resolveCurrentRound(bracket, countingResolver)

        // Round 2 is at index 1
        const round2 = resolved.rounds[1]
        const round2Participants = new Set<string>()
        for (const matchup of round2.matchups) {
          if (matchup.playerA) round2Participants.add(matchup.playerA)
          if (matchup.playerB) round2Participants.add(matchup.playerB)
        }

        // All bye players must be in round 2
        for (const byePlayer of byePlayers) {
          expect(round2Participants.has(byePlayer)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.3: Resolver call count equals the number of matchups in round 0
   *
   * **Validates: Requirements 5.1**
   */
  it("resolver call count equals the number of round 0 matchups (not including byes)", () => {
    fc.assert(
      fc.property(nonPowerOf2CountArb, (playerCount) => {
        const playerIds = Array.from(
          { length: playerCount },
          (_, i) => `player-${i + 1}`
        )
        const bracket = generateBracket(playerIds)
        const expectedCallCount = bracket.rounds[0].matchups.length

        let callCount = 0
        const countingResolver = (playerA: string, playerB: string): string => {
          callCount++
          return playerA
        }

        resolveCurrentRound(bracket, countingResolver)

        expect(callCount).toBe(expectedCallCount)
      }),
      { numRuns: 100 }
    )
  })
})
