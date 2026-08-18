import { describe, it, expect } from "vitest"
import {
  generateBracket,
  resolveCurrentRound,
  generateConsolationForRound,
  buildSchedule,
  computePlacements,
  isFullyComplete,
} from "./BracketEngine"
import {
  playcallerPlugin,
  setPlaycallerState,
  getPlaycallerState,
  resetPlaycallerState,
} from "./PlaycallerPlugin"
import type { MatchResolver, Bracket } from "@games-of-chance/shared"

/** Deterministic resolver: playerA always wins */
const playerAWins: MatchResolver = (playerA: string, _playerB: string) => playerA

describe("10-player bracket consolation placements", () => {
  it("produces correct unique placements 1st through 10th with no ties", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)

    // 10-player bracket has 4 rounds: Play-in (round 0), QF (round 1), SF (round 2), Finals (round 3)
    expect(bracket.totalRounds).toBe(4)

    // === Round 0: Play-in ===
    // Seeds 1-6 get byes, matchups: 7v8, 9v10
    bracket = resolveCurrentRound(bracket, playerAWins)
    expect(bracket.rounds[0].resolved).toBe(true)

    // Generate consolation for play-in losers (round 0)
    const consolationR0 = generateConsolationForRound(bracket, 0)
    bracket.consolationRounds.push(...consolationR0)

    // === Round 1: Quarterfinals ===
    bracket = resolveCurrentRound(bracket, playerAWins)
    expect(bracket.rounds[1].resolved).toBe(true)

    // Generate consolation for QF losers (round 1)
    const consolationR1 = generateConsolationForRound(
      bracket,
      1,
      bracket.consolationRounds.length
    )
    bracket.consolationRounds.push(...consolationR1)

    // === Round 2: Semifinals ===
    bracket = resolveCurrentRound(bracket, playerAWins)
    expect(bracket.rounds[2].resolved).toBe(true)

    // Generate consolation for SF losers (round 2)
    const consolationR2 = generateConsolationForRound(
      bracket,
      2,
      bracket.consolationRounds.length
    )
    bracket.consolationRounds.push(...consolationR2)

    // === Round 3: Finals ===
    bracket = resolveCurrentRound(bracket, playerAWins)
    expect(bracket.rounds[3].resolved).toBe(true)

    // Verify consolation rounds: should be 4 entries with placementStart [9, 5, 7, 3]
    expect(bracket.consolationRounds).toHaveLength(4)
    const placementStarts = bracket.consolationRounds.map((r) => r.placementStart)
    expect(placementStarts).toEqual([9, 5, 7, 3])

    // === Resolve all consolation rounds ===
    // Simulate what advancePlaycallerBracket does: directly set winner and resolved
    for (const cRound of bracket.consolationRounds) {
      for (const matchup of cRound.matchups) {
        // playerA always wins
        matchup.winner = matchup.playerA
      }
      cRound.resolved = true
    }

    // === Verify placements ===
    const placements = computePlacements(bracket)

    // All 10 players should have unique placements
    expect(placements.size).toBe(10)

    const values = Array.from(placements.values()).sort((a, b) => a - b)
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // Verify specific placements:
    // Champion (playerA always wins → seed 1 wins entire bracket)
    const champion = bracket.rounds[3].matchups[0].winner!
    expect(placements.get(champion)).toBe(1)

    // Finalist loser = 2nd
    const finalMatchup = bracket.rounds[3].matchups[0]
    const runnerUp =
      finalMatchup.playerA === champion ? finalMatchup.playerB : finalMatchup.playerA
    expect(placements.get(runnerUp)).toBe(2)

    // SF losers get 3rd and 4th (consolation placementStart=3 with 1 matchup, 2 players)
    const sfLosers: string[] = []
    for (const matchup of bracket.rounds[2].matchups) {
      const loser =
        matchup.playerA === matchup.winner ? matchup.playerB : matchup.playerA
      sfLosers.push(loser)
    }
    for (const loser of sfLosers) {
      const p = placements.get(loser)!
      expect(p).toBeGreaterThanOrEqual(3)
      expect(p).toBeLessThanOrEqual(4)
    }

    // QF losers get 5th-8th (consolation placementStart=5 and 7, each with 1 matchup)
    const qfLosers: string[] = []
    for (const matchup of bracket.rounds[1].matchups) {
      const loser =
        matchup.playerA === matchup.winner ? matchup.playerB : matchup.playerA
      qfLosers.push(loser)
    }
    for (const loser of qfLosers) {
      const p = placements.get(loser)!
      expect(p).toBeGreaterThanOrEqual(5)
      expect(p).toBeLessThanOrEqual(8)
    }

    // Play-in losers get 9th and 10th (consolation placementStart=9 with 1 matchup)
    const playInLosers: string[] = []
    for (const matchup of bracket.rounds[0].matchups) {
      const loser =
        matchup.playerA === matchup.winner ? matchup.playerB : matchup.playerA
      playInLosers.push(loser)
    }
    for (const loser of playInLosers) {
      const p = placements.get(loser)!
      expect(p).toBeGreaterThanOrEqual(9)
      expect(p).toBeLessThanOrEqual(10)
    }
  })

  it("produces 10 unique placements via PlaycallerPlugin resolveRound loop (SKIP_GAMEPLAY)", () => {
    resetPlaycallerState()

    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)

    // Build the initial schedule
    bracket.schedule = buildSchedule(bracket)
    bracket.currentScheduleIndex = 0

    // Set bracket state so plugin uses it
    setPlaycallerState(bracket)

    // Loop resolveRound until isComplete
    let result = { isComplete: false } as { isComplete: boolean }
    let iterations = 0
    const maxIterations = 20 // safety cap

    while (!result.isComplete && iterations < maxIterations) {
      result = playcallerPlugin.resolveRound({}, {
        maxPlayers: 10,
        minPlayers: 2,
        scoreTable: [10, 8, 6, 5, 4, 3, 2, 1, 0, 0],
      })
      iterations++
    }

    // Should complete within reasonable iterations
    expect(result.isComplete).toBe(true)
    expect(iterations).toBeLessThanOrEqual(maxIterations)

    // Get final bracket state and verify placements
    const finalBracket = getPlaycallerState()!
    expect(isFullyComplete(finalBracket)).toBe(true)

    const placements = computePlacements(finalBracket)
    expect(placements.size).toBe(10)

    const values = Array.from(placements.values()).sort((a, b) => a - b)
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    resetPlaycallerState()
  })
})
