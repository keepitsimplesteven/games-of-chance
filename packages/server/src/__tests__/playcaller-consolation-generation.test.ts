/**
 * Unit tests for generateConsolationRounds in BracketEngine.
 *
 * Validates: Requirements 1.1, 1.2, 1.7, 1.8
 */
import { describe, it, expect } from "vitest"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  generateConsolationRounds,
} from "../games/playcaller/BracketEngine"
import type { MatchResolver } from "@games-of-chance/shared"

/** Resolver that always picks playerA (higher seed wins) */
const higherSeedWins: MatchResolver = (a, _b) => a

/** Resolver that always picks playerB (lower seed wins / upset) */
const lowerSeedWins: MatchResolver = (_a, b) => b

/**
 * Fully resolves a bracket's main rounds using the given resolver.
 */
function resolveAllMainRounds(players: string[], resolver: MatchResolver) {
  let bracket = generateBracket(players)
  while (!isComplete(bracket)) {
    bracket = resolveCurrentRound(bracket, resolver)
  }
  return bracket
}

describe("generateConsolationRounds", () => {
  describe("Requirement 1.7: Power-of-2 player counts", () => {
    it("2 players: no consolation rounds needed (only 1st and 2nd)", () => {
      const bracket = resolveAllMainRounds(["p1", "p2"], higherSeedWins)
      const consolation = generateConsolationRounds(bracket)
      // Only 2 players: champion (1st) and runner-up (2nd) — no ties exist
      expect(consolation).toHaveLength(0)
    })

    it("4 players: generates 1 consolation matchup (3rd/4th place game)", () => {
      const bracket = resolveAllMainRounds(
        ["p1", "p2", "p3", "p4"],
        higherSeedWins
      )
      const consolation = generateConsolationRounds(bracket)

      // Semi-final losers (2 players eliminated in the same round) → 1 matchup
      expect(consolation).toHaveLength(1)
      expect(consolation[0].matchups).toHaveLength(1)
      expect(consolation[0].placementStart).toBe(3)
      expect(consolation[0].resolved).toBe(false)
    })

    it("8 players: generates consolation for semi-final losers (3rd/4th) and quarter-final losers (5th-8th)", () => {
      const bracket = resolveAllMainRounds(
        ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
        higherSeedWins
      )
      const consolation = generateConsolationRounds(bracket)

      // Consolidated model: each elimination group of 4 splits into TWO
      // single-matchup consolation rounds (offsets placementStart and placementStart+2),
      // each fully populated. Ordered best placement first:
      //   [0] 3rd/4th game (semi-final losers, group of 2)  → placementStart 3
      //   [1] 5th/6th game (quarter-final losers pair)       → placementStart 5
      //   [2] 7th/8th game (quarter-final losers pair)       → placementStart 7
      expect(consolation).toHaveLength(3)

      // Each consolation round is a single fully-populated matchup
      for (const round of consolation) {
        expect(round.matchups).toHaveLength(1)
        expect(round.matchups[0].playerA).toBeTruthy()
        expect(round.matchups[0].playerB).toBeTruthy()
      }

      // placementStart values, in order
      expect(consolation.map((r) => r.placementStart)).toEqual([3, 5, 7])
    })
  })

  describe("Requirement 1.8: 10-player bracket consolation structure", () => {
    it("generates correct placement games: 3rd/4th, 5th-8th bracket, 9th/10th", () => {
      const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
      const bracket = resolveAllMainRounds(players, higherSeedWins)
      const consolation = generateConsolationRounds(bracket)

      // 10-player bracket eliminations:
      // Round 0 (play-in): 2 losers → group of 2 → 9th/10th
      // Round 1 (quarterfinals): 4 losers → group of 4 → 5th-8th (mini bracket)
      // Round 2 (semifinals): 2 losers → group of 2 → 3rd/4th

      // Consolidated model: every elimination group becomes single-matchup
      // consolation rounds (a group of 4 splits into two, offsets ps and ps+2),
      // each fully populated. Ordered best placement first:
      //   [0] 3rd/4th   (semifinal losers, group of 2)     → placementStart 3
      //   [1] 5th/6th   (quarterfinal losers pair)          → placementStart 5
      //   [2] 7th/8th   (quarterfinal losers pair)          → placementStart 7
      //   [3] 9th/10th  (play-in losers, group of 2)        → placementStart 9
      expect(consolation).toHaveLength(4)

      // Each consolation round is a single fully-populated matchup (no empty slots)
      for (const round of consolation) {
        expect(round.matchups).toHaveLength(1)
        expect(round.matchups[0].playerA).toBeTruthy()
        expect(round.matchups[0].playerB).toBeTruthy()
      }

      // placementStart values, in order
      expect(consolation.map((r) => r.placementStart)).toEqual([3, 5, 7, 9])
    })

    it("players in consolation matchups were actually eliminated in the same main bracket round", () => {
      const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
      const bracket = resolveAllMainRounds(players, higherSeedWins)
      const consolation = generateConsolationRounds(bracket)

      for (const round of consolation) {
        const sourceRound = round.sourceRoundIndex
        for (const matchup of round.matchups) {
          // Skip matchups with empty players (finals of mini brackets)
          if (!matchup.playerA || !matchup.playerB) continue

          // Both players should have been eliminated in the same round
          expect(bracket.eliminated[matchup.playerA]).toBe(sourceRound)
          expect(bracket.eliminated[matchup.playerB]).toBe(sourceRound)
        }
      }
    })
  })

  describe("Requirement 1.2: Players eliminated in same round are paired", () => {
    it("all consolation matchup players come from the expected elimination round", () => {
      // Test with various player counts
      for (const count of [3, 5, 6, 7, 9, 10]) {
        const players = Array.from({ length: count }, (_, i) => `p${i + 1}`)
        const bracket = resolveAllMainRounds(players, higherSeedWins)
        const consolation = generateConsolationRounds(bracket)

        for (const round of consolation) {
          for (const matchup of round.matchups) {
            if (!matchup.playerA || !matchup.playerB) continue
            // Both players in a matchup should have been eliminated in the sourceRoundIndex
            expect(bracket.eliminated[matchup.playerA]).toBe(round.sourceRoundIndex)
            expect(bracket.eliminated[matchup.playerB]).toBe(round.sourceRoundIndex)
          }
        }
      }
    })
  })

  describe("Requirement 1.1: Generates matchups for all tied groups", () => {
    it("every elimination group with 2+ players gets consolation matchups", () => {
      const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
      const bracket = resolveAllMainRounds(players, lowerSeedWins)
      const consolation = generateConsolationRounds(bracket)

      // Count eliminated players by round
      const eliminatedByRound = new Map<number, string[]>()
      for (const [playerId, roundIndex] of Object.entries(bracket.eliminated)) {
        if (!eliminatedByRound.has(roundIndex)) {
          eliminatedByRound.set(roundIndex, [])
        }
        eliminatedByRound.get(roundIndex)!.push(playerId)
      }

      // Every group with 2+ players should have at least one consolation round
      const groupsNeedingConsolation = Array.from(eliminatedByRound.values())
        .filter(g => g.length >= 2)

      // Each group should be represented via sourceRoundIndex in consolation
      const coveredSourceRounds = new Set(consolation.map(r => r.sourceRoundIndex))
      for (const [roundIndex, players] of eliminatedByRound) {
        if (players.length >= 2) {
          expect(coveredSourceRounds.has(roundIndex)).toBe(true)
        }
      }
    })
  })

  describe("Matchup ID uniqueness", () => {
    it("all consolation matchup IDs are unique", () => {
      const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
      const bracket = resolveAllMainRounds(players, higherSeedWins)
      const consolation = generateConsolationRounds(bracket)

      const allIds = consolation.flatMap(r => r.matchups.map(m => m.matchupId))
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
    })
  })

  describe("Seeding within consolation matchups", () => {
    it("higher seed (lower number) is placed as playerA in consolation matchups", () => {
      const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
      const bracket = resolveAllMainRounds(players, higherSeedWins)
      const consolation = generateConsolationRounds(bracket)

      for (const round of consolation) {
        for (const matchup of round.matchups) {
          if (!matchup.playerA || !matchup.playerB) continue
          // playerA should have a lower (better) seed number than playerB
          expect(bracket.seeds[matchup.playerA]).toBeLessThan(
            bracket.seeds[matchup.playerB]
          )
        }
      }
    })
  })
})
