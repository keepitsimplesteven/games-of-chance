/**
 * Feature: playcaller-tournament, Property 9: Scoring correctness
 *
 * Validates: Requirements 6.1, 6.4, 6.6, 12.1, 12.2
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  playcallerPlugin,
  setPlaycallerState,
  resetPlaycallerState,
} from "../games/playcaller/PlaycallerPlugin"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  computePlacements,
} from "../games/playcaller/BracketEngine"
import type { MatchResolver, GameSettings, Player } from "@games-of-chance/shared"

describe("Property 9: Scoring correctness", () => {
  beforeEach(() => {
    resetPlaycallerState()
  })

  afterEach(() => {
    resetPlaycallerState()
  })

  it("each player receives points equal to scoreTable[placement - 1] or 0 if placement exceeds table length", () => {
    fc.assert(
      fc.property(
        // Generate player count 2-10
        fc.integer({ min: 2, max: 10 }),
        // Generate score table length 2-10 (may be shorter than player count for overflow testing)
        fc.integer({ min: 2, max: 10 }),
        // Resolver strategy: always pick A or always pick B
        fc.constantFrom("A" as const, "B" as const),
        (playerCount, tableLength, strategy) => {
          const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            role: "player" as const,
            connected: true,
            connectionId: `conn-${i + 1}`,
          }))

          const playerIds = players.map((p) => p.id)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          // Generate a valid Score_Table: non-negative integers sorted descending
          const rawValues = Array.from({ length: tableLength }, (_, i) =>
            Math.max(0, 250 - i * 25)
          )
          const scoreTable = rawValues.sort((a, b) => b - a)

          // Generate and fully resolve the bracket
          let bracket = generateBracket(playerIds)
          while (!isComplete(bracket)) {
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // Set the completed bracket state
          setPlaycallerState(bracket)

          // Create a mock result indicating tournament is complete
          const result = {
            bracketRound: bracket.totalRounds - 1,
            matchups: bracket.rounds[bracket.totalRounds - 1].matchups,
            isComplete: true,
          }

          const settings: GameSettings = {
            roundCount: 3,
            pickWindowMs: 3000,
            tuning: { SCORE_TABLE: scoreTable },
          }

          // Call scoreRound
          const { deltas } = playcallerPlugin.scoreRound(
            {},
            result,
            players,
            settings
          )

          // Verify each player's delta matches scoreTable[placement - 1] or 0
          const placements = computePlacements(bracket)
          for (const [playerId, placement] of placements) {
            const index = placement - 1
            const expectedPoints =
              index < scoreTable.length ? scoreTable[index] : 0
            expect(deltas[playerId]).toBe(expectedPoints)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("players eliminated in the same round receive the same points (tied placements)", () => {
    fc.assert(
      fc.property(
        // Use player counts that create ties (non-power-of-2 OR >= 4 for same-round elimination)
        fc.integer({ min: 4, max: 10 }),
        fc.constantFrom("A" as const, "B" as const),
        (playerCount, strategy) => {
          const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            role: "player" as const,
            connected: true,
            connectionId: `conn-${i + 1}`,
          }))

          const playerIds = players.map((p) => p.id)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          // Use default-style score table long enough to cover all players
          const scoreTable = [250, 125, 75, 50, 35, 25, 15, 10, 5, 5]

          // Generate and fully resolve the bracket
          let bracket = generateBracket(playerIds)
          while (!isComplete(bracket)) {
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // Set the completed bracket state
          setPlaycallerState(bracket)

          const result = {
            bracketRound: bracket.totalRounds - 1,
            matchups: bracket.rounds[bracket.totalRounds - 1].matchups,
            isComplete: true,
          }

          const settings: GameSettings = {
            roundCount: 3,
            pickWindowMs: 3000,
            tuning: { SCORE_TABLE: scoreTable },
          }

          const { deltas } = playcallerPlugin.scoreRound(
            {},
            result,
            players,
            settings
          )

          // Verify: players eliminated in the same round get the same points
          const placements = computePlacements(bracket)

          // Group players by placement
          const byPlacement = new Map<number, string[]>()
          for (const [playerId, placement] of placements) {
            if (!byPlacement.has(placement)) {
              byPlacement.set(placement, [])
            }
            byPlacement.get(placement)!.push(playerId)
          }

          // All players sharing a placement must have identical deltas
          for (const [_placement, playerGroup] of byPlacement) {
            if (playerGroup.length > 1) {
              const expectedDelta = deltas[playerGroup[0]]
              for (const pid of playerGroup) {
                expect(deltas[pid]).toBe(expectedDelta)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("players whose placement exceeds table length receive 0 points", () => {
    fc.assert(
      fc.property(
        // Use enough players that some will overflow a short table
        fc.integer({ min: 4, max: 10 }),
        // Short score table (2-3 entries) to guarantee overflow
        fc.integer({ min: 2, max: 3 }),
        fc.constantFrom("A" as const, "B" as const),
        (playerCount, tableLength, strategy) => {
          const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            role: "player" as const,
            connected: true,
            connectionId: `conn-${i + 1}`,
          }))

          const playerIds = players.map((p) => p.id)
          const resolver: MatchResolver =
            strategy === "A" ? (a, _b) => a : (_a, b) => b

          // Generate a short score table
          const scoreTable = Array.from({ length: tableLength }, (_, i) =>
            Math.max(0, 100 - i * 30)
          ).sort((a, b) => b - a)

          // Generate and fully resolve the bracket
          let bracket = generateBracket(playerIds)
          while (!isComplete(bracket)) {
            bracket = resolveCurrentRound(bracket, resolver)
          }

          // Set the completed bracket state
          setPlaycallerState(bracket)

          const result = {
            bracketRound: bracket.totalRounds - 1,
            matchups: bracket.rounds[bracket.totalRounds - 1].matchups,
            isComplete: true,
          }

          const settings: GameSettings = {
            roundCount: 3,
            pickWindowMs: 3000,
            tuning: { SCORE_TABLE: scoreTable },
          }

          const { deltas } = playcallerPlugin.scoreRound(
            {},
            result,
            players,
            settings
          )

          // Verify: players whose placement exceeds the table length receive 0
          const placements = computePlacements(bracket)
          for (const [playerId, placement] of placements) {
            const index = placement - 1
            if (index >= scoreTable.length) {
              expect(deltas[playerId]).toBe(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
