import { describe, it, expect } from "vitest"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  isFullyComplete,
  generateConsolationRounds,
  resolveConsolationRound,
  computePlacements,
  getActiveMatchupsForSchedule,
  generateConsolationForRound,
} from "./BracketEngine"
import type { MatchResolver, Bracket } from "@games-of-chance/shared"

/**
 * Helper: creates a resolver that always picks playerA
 */
const playerAResolver: MatchResolver = (playerA: string, _playerB: string) => playerA

/**
 * Helper: creates a deterministic resolver based on a winner map
 */
function createMapResolver(winners: Record<string, string>): MatchResolver {
  return (playerA: string, playerB: string) => {
    // Try to find a match by both player IDs (since matchupId isn't passed to resolver)
    const key = `${playerA}-${playerB}`
    const reverseKey = `${playerB}-${playerA}`
    if (winners[key]) return winners[key]
    if (winners[reverseKey]) return winners[reverseKey]
    // Default: return playerA
    return playerA
  }
}

/**
 * Helper: resolves all main bracket rounds with a given resolver
 */
function resolveAllMainRounds(bracket: Bracket, resolver: MatchResolver): Bracket {
  while (!isComplete(bracket)) {
    bracket = resolveCurrentRound(bracket, resolver)
  }
  return bracket
}

describe("resolveConsolationRound", () => {
  it("resolves a single consolation round (2-player group)", () => {
    // 4-player bracket: after main bracket, semi-final losers form a consolation matchup
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)

    // Resolve main bracket (playerA always wins)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    expect(isComplete(bracket)).toBe(true)

    // Generate consolation rounds
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    expect(bracket.consolationRounds.length).toBeGreaterThan(0)

    // Resolve the consolation round
    bracket = resolveConsolationRound(bracket, playerAResolver)

    expect(bracket.consolationRounds[0].resolved).toBe(true)
    expect(bracket.consolationRounds[0].matchups[0].winner).toBeTruthy()
    expect(bracket.currentConsolationIndex).toBe(1)
  })

  it("resolves a 4-player group as flat pairwise matchups (no mini-bracket)", () => {
    // 10-player bracket: quarter-final losers form a 4-player group
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)

    // Resolve main bracket
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    expect(isComplete(bracket)).toBe(true)

    // Generate consolation rounds
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    // For a 4-player group, we should get 2 separate ConsolationRound objects (each with 1 matchup)
    // instead of the old mini-bracket (1 round with 2 matchups + 1 final round with empty players)
    // Verify no round has 2 matchups (old mini-bracket semi-final format)
    const hasMiniBracketSemiFinal = bracket.consolationRounds.some(
      (r) => r.matchups.length === 2
    )
    expect(hasMiniBracketSemiFinal).toBe(false)

    // Verify no round has empty players (old mini-bracket final format)
    const hasEmptyPlayers = bracket.consolationRounds.some(
      (r) => r.matchups.some((m) => m.playerA === "" || m.playerB === "")
    )
    expect(hasEmptyPlayers).toBe(false)

    // All consolation rounds should be single-matchup pairwise games
    for (const round of bracket.consolationRounds) {
      expect(round.matchups.length).toBe(1)
      expect(round.matchups[0].playerA).not.toBe("")
      expect(round.matchups[0].playerB).not.toBe("")
    }

    // Resolve all consolation rounds
    for (let i = 0; i < bracket.consolationRounds.length; i++) {
      bracket.currentConsolationIndex = i
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    // All consolation rounds should now be resolved
    expect(bracket.consolationRounds.every((r) => r.resolved)).toBe(true)
  })

  it("advances currentConsolationIndex after each resolution", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    const initialIndex = bracket.currentConsolationIndex
    bracket = resolveConsolationRound(bracket, playerAResolver)
    expect(bracket.currentConsolationIndex).toBe(initialIndex + 1)
  })

  it("does nothing when no consolation rounds left to resolve", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    // Resolve all consolation rounds
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    // Calling again should be a no-op
    const indexBefore = bracket.currentConsolationIndex
    bracket = resolveConsolationRound(bracket, playerAResolver)
    expect(bracket.currentConsolationIndex).toBe(indexBefore)
  })

  it("throws when resolver returns an invalid player ID", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    const badResolver: MatchResolver = () => "invalid-player"

    expect(() => resolveConsolationRound(bracket, badResolver)).toThrow(
      "Match resolver returned an invalid player ID"
    )
  })
})

describe("isFullyComplete", () => {
  it("returns false when main bracket is not complete", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)
    expect(isFullyComplete(bracket)).toBe(false)
  })

  it("returns true when main bracket is complete and no consolation rounds exist", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    // Don't generate consolation rounds — bracket.consolationRounds is []
    expect(isFullyComplete(bracket)).toBe(true)
  })

  it("returns false when main bracket is complete but consolation rounds are unresolved", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    // Consolation rounds exist but are unresolved
    expect(isFullyComplete(bracket)).toBe(false)
  })

  it("returns true when main bracket and all consolation rounds are complete", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    // Resolve all consolation rounds
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    expect(isFullyComplete(bracket)).toBe(true)
  })

  it("returns true for 10-player bracket with all consolation resolved", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0

    // Resolve all consolation rounds
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    expect(isFullyComplete(bracket)).toBe(true)
    expect(bracket.consolationRounds.every((r) => r.resolved)).toBe(true)
  })
})


describe("computePlacements", () => {
  it("returns empty map when bracket is not complete", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)
    const placements = computePlacements(bracket)
    expect(placements.size).toBe(0)
  })

  it("returns shared placements (fallback) when no consolation rounds exist", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)

    // No consolation rounds generated — fallback to shared placements
    const placements = computePlacements(bracket)

    expect(placements.size).toBe(4)
    // Champion gets 1
    expect(placements.get(bracket.rounds[bracket.totalRounds - 1].matchups[0].winner!)).toBe(1)
    // Runner-up gets 2
    // Semi-final losers share placement 3
    const placement3Players = [...placements.entries()].filter(([_, p]) => p === 3)
    expect(placement3Players.length).toBe(2)
  })

  it("returns unique placements for 4-player bracket with consolation resolved", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)

    // Generate and resolve consolation rounds
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)

    // All 4 players should have unique placements 1-4
    expect(placements.size).toBe(4)
    const values = [...placements.values()].sort((a, b) => a - b)
    expect(values).toEqual([1, 2, 3, 4])
  })

  it("returns unique placements for 10-player bracket with consolation resolved", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)

    // Generate and resolve consolation rounds
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)

    // All 10 players should have unique placements 1-10
    expect(placements.size).toBe(10)
    const values = [...placements.values()].sort((a, b) => a - b)
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("champion always gets placement 1", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)
    const champion = bracket.rounds[bracket.totalRounds - 1].matchups[0].winner!
    expect(placements.get(champion)).toBe(1)
  })

  it("runner-up gets placement 2 with consolation data", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)
    const finalMatchup = bracket.rounds[bracket.totalRounds - 1].matchups[0]
    const champion = finalMatchup.winner!
    const runnerUp = finalMatchup.playerA === champion ? finalMatchup.playerB : finalMatchup.playerA
    expect(placements.get(runnerUp)).toBe(2)
  })

  it("consolation winners get better placements than consolation losers", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)

    // For each consolation matchup, winner has a lower (better) placement than loser
    for (const round of bracket.consolationRounds) {
      for (const matchup of round.matchups) {
        const winner = matchup.winner!
        const loser = matchup.playerA === winner ? matchup.playerB : matchup.playerA
        expect(placements.get(winner)!).toBeLessThan(placements.get(loser)!)
      }
    }
  })

  it("handles 2-player bracket (no consolation needed beyond final)", () => {
    const players = ["p1", "p2"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)

    // A 2-player bracket has no consolation to generate (only champion and runner-up)
    bracket.consolationRounds = generateConsolationRounds(bracket)
    bracket.currentConsolationIndex = 0
    // May have 0 consolation rounds for 2 players
    while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
      bracket = resolveConsolationRound(bracket, playerAResolver)
    }

    const placements = computePlacements(bracket)
    expect(placements.size).toBe(2)
    const values = [...placements.values()].sort((a, b) => a - b)
    expect(values).toEqual([1, 2])
  })

  it("uses different resolver to produce different consolation placements", () => {
    const players = ["p1", "p2", "p3", "p4"]
    let bracketA = generateBracket(players)
    let bracketB = generateBracket(players)

    // Resolve main bracket the same way
    bracketA = resolveAllMainRounds(bracketA, playerAResolver)
    bracketB = resolveAllMainRounds(bracketB, playerAResolver)

    // Generate consolation rounds
    bracketA.consolationRounds = generateConsolationRounds(bracketA)
    bracketA.currentConsolationIndex = 0
    bracketB.consolationRounds = generateConsolationRounds(bracketB)
    bracketB.currentConsolationIndex = 0

    // Resolve consolation with playerA always winning
    while (bracketA.currentConsolationIndex < bracketA.consolationRounds.length) {
      bracketA = resolveConsolationRound(bracketA, playerAResolver)
    }

    // Resolve consolation with playerB always winning
    const playerBResolver: MatchResolver = (_playerA: string, playerB: string) => playerB
    while (bracketB.currentConsolationIndex < bracketB.consolationRounds.length) {
      bracketB = resolveConsolationRound(bracketB, playerBResolver)
    }

    const placementsA = computePlacements(bracketA)
    const placementsB = computePlacements(bracketB)

    // Both should have unique placements
    const valuesA = [...placementsA.values()].sort((a, b) => a - b)
    const valuesB = [...placementsB.values()].sort((a, b) => a - b)
    expect(valuesA).toEqual([1, 2, 3, 4])
    expect(valuesB).toEqual([1, 2, 3, 4])

    // The consolation matchup should produce different 3rd/4th assignments
    // (since consolation players swap who wins)
    // Find who got 3rd in each
    const third_A = [...placementsA.entries()].find(([_, p]) => p === 3)![0]
    const third_B = [...placementsB.entries()].find(([_, p]) => p === 3)![0]
    expect(third_A).not.toBe(third_B)
  })
})

describe("getActiveMatchupsForSchedule", () => {

  it("returns main-bracket matchups for a main-bracket-only schedule entry", () => {
    // 4-player bracket: first round has no consolation
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)

    const scheduleEntry = { mainBracketRoundIndex: 0, consolationRoundIndices: [], description: "Semifinal" }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should return the 2 matchups from round 0
    expect(matchups.length).toBe(2)
    expect(matchups[0].playerA).toBe("p1")
    expect(matchups[0].playerB).toBe("p4")
    expect(matchups[1].playerA).toBe("p2")
    expect(matchups[1].playerB).toBe("p3")
  })

  it("returns only consolation matchups when mainBracketRoundIndex is null", () => {
    // Setup: 10-player bracket, resolve main bracket to get consolation rounds
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)
    bracket = resolveAllMainRounds(bracket, playerAResolver)
    bracket.consolationRounds = generateConsolationRounds(bracket)

    // Find a consolation round with populated matchups (e.g., 3rd/4th which has players)
    const thirdFourthIdx = bracket.consolationRounds.findIndex(
      (r: any) => r.placementStart === 3
    )

    const scheduleEntry = {
      mainBracketRoundIndex: null,
      consolationRoundIndices: [thirdFourthIdx],
      description: "3rd/4th",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should return the consolation matchup(s) with valid players
    expect(matchups.length).toBeGreaterThan(0)
    for (const m of matchups) {
      expect(m.playerA).not.toBe("")
      expect(m.playerB).not.toBe("")
    }
  })

  it("merges main-bracket and consolation matchups in a combined schedule entry", () => {
    // Setup: 10-player bracket with play-in resolved
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]
    let bracket = generateBracket(players)

    // Resolve play-in round
    bracket = resolveCurrentRound(bracket, playerAResolver)

    // Generate consolation for the play-in losers
    const consolation = generateConsolationForRound(bracket, 0)
    bracket.consolationRounds = consolation

    // Create a combined schedule entry: quarterfinals + 9th/10th consolation
    const scheduleEntry = {
      mainBracketRoundIndex: 1,
      consolationRoundIndices: [0],
      description: "Quarterfinal + 9th/10th",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should have quarterfinal matchups (4) + consolation matchup (1) = 5
    expect(matchups.length).toBe(5)
    // All should have valid players
    for (const m of matchups) {
      expect(m.playerA).not.toBe("")
      expect(m.playerB).not.toBe("")
    }
  })

  it("filters out matchups with empty playerA or playerB", () => {
    // Setup: create a bracket with a consolation round that has empty slots
    // (simulating a mini-bracket final before semi-finals resolve)
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)

    // Manually add a consolation round with empty matchup slots
    bracket.consolationRounds = [
      {
        roundIndex: 0,
        matchups: [
          { matchupId: "c0-m0", playerA: "", playerB: "", winner: null },
        ],
        resolved: false,
        sourceRoundIndex: 0,
        placementStart: 3,
      },
    ]

    const scheduleEntry = {
      mainBracketRoundIndex: null,
      consolationRoundIndices: [0],
      description: "3rd/4th",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should filter out the empty matchup
    expect(matchups.length).toBe(0)
  })

  it("filters matchups with only playerA empty", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)

    bracket.consolationRounds = [
      {
        roundIndex: 0,
        matchups: [
          { matchupId: "c0-m0", playerA: "", playerB: "p3", winner: null },
        ],
        resolved: false,
        sourceRoundIndex: 0,
        placementStart: 3,
      },
    ]

    const scheduleEntry = {
      mainBracketRoundIndex: null,
      consolationRoundIndices: [0],
      description: "3rd/4th",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    expect(matchups.length).toBe(0)
  })

  it("filters matchups with only playerB empty", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)

    bracket.consolationRounds = [
      {
        roundIndex: 0,
        matchups: [
          { matchupId: "c0-m0", playerA: "p2", playerB: "", winner: null },
        ],
        resolved: false,
        sourceRoundIndex: 0,
        placementStart: 3,
      },
    ]

    const scheduleEntry = {
      mainBracketRoundIndex: null,
      consolationRoundIndices: [0],
      description: "3rd/4th",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    expect(matchups.length).toBe(0)
  })

  it("handles schedule entry with non-existent round index gracefully", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const bracket = generateBracket(players)

    // Reference a consolation round index that doesn't exist
    const scheduleEntry = {
      mainBracketRoundIndex: null,
      consolationRoundIndices: [99],
      description: "Non-existent",
    }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should return empty array (no crash)
    expect(matchups.length).toBe(0)
  })

  it("for main-bracket-only entries, returns same matchups as current round logic", () => {
    // Preservation check: verify we get the same matchups as bracket.rounds[idx].matchups.filter(...)
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]
    const bracket = generateBracket(players)

    const scheduleEntry = { mainBracketRoundIndex: 0, consolationRoundIndices: [], description: "Quarterfinal" }
    const matchups = getActiveMatchupsForSchedule(bracket, scheduleEntry)

    // Should exactly match the round's matchups (all have valid players in an 8-player bracket)
    const expectedMatchups = bracket.rounds[0].matchups.filter(
      (m: any) => m.playerA !== "" && m.playerB !== ""
    )
    expect(matchups).toEqual(expectedMatchups)
  })
})
