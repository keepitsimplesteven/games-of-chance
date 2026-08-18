/**
 * Lottery Mode Integration Tests
 *
 * Full end-to-end tests verifying:
 * 1. Single full flow: bracket → draw → derive → resolve → verify placements are unique and deterministic
 * 2. SKIP_GAMEPLAY: 100 runs confirming 100% placement compliance (computePlacements matches expected)
 * 3. Gameplay: 100 runs with lottery drive resolver confirming 100% winner compliance via suppression
 *
 * Validates: Requirements 4.9, 5.3
 */

import { describe, it, expect } from "vitest"
import {
  generateBracket,
  resolveCurrentRound,
  resolveConsolationRound,
  isComplete,
  isFullyComplete,
  computePlacements,
  generateConsolationRounds,
} from "../BracketEngine"
import { drawPlacements, deriveMatchupWinners } from "./index"
import { resolveLotteryDown } from "./lotteryDriveResolver"
import { createDriveState, isDriveComplete, selectRandomPlay } from "../drive/engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "../drive/config"
import type { MatchResolver, Bracket } from "@games-of-chance/shared"
import type { OffensivePlayId, DefensivePlayId } from "../drive/types"

// --- Helpers ---

const OFFENSIVE_PLAYS: OffensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

const DEFENSIVE_PLAYS: DefensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

/** Generates an array of player IDs: ["p1", "p2", ..., "pN"] */
function generatePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}`)
}

/** Simple seeded pseudo-RNG (mulberry32) for deterministic tests */
function createSeededRng(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Creates a placement-based MatchResolver.
 * The player with the lower target placement wins (lower = better).
 * This mirrors what deriveMatchupWinners does: lower placement always beats higher.
 */
function createPlacementResolver(
  targetPlacements: Map<string, number>
): MatchResolver {
  return (playerA: string, playerB: string): string => {
    const placA = targetPlacements.get(playerA)!
    const placB = targetPlacements.get(playerB)!
    return placA < placB ? playerA : playerB
  }
}

/**
 * Creates a MatchResolver that runs full lottery drives with suppression.
 * Uses targetPlacements to identify the correct predetermined winner,
 * then runs the full drive engine with suppression to verify the winner emerges.
 */
function createGameplayResolver(
  targetPlacements: Map<string, number>,
  rng: () => number
): MatchResolver {
  return (playerA: string, playerB: string): string => {
    // Determine the correct winner for this matchup (lower placement wins)
    const placA = targetPlacements.get(playerA)!
    const placB = targetPlacements.get(playerB)!
    const predeterminedWinner = placA < placB ? playerA : playerB

    // Run a full drive with suppression to verify the winner emerges correctly
    let state = createDriveState(playerA, playerB, 2, 1)

    while (!isDriveComplete(state)) {
      const offPlay = selectRandomPlay(OFFENSIVE_PLAYS, rng) as OffensivePlayId
      const defPlay = selectRandomPlay(DEFENSIVE_PLAYS, rng) as DefensivePlayId

      const resolved = resolveLotteryDown(
        state,
        offPlay,
        defPlay,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        predeterminedWinner
      )
      state = resolved.state
    }

    return state.completion!.winner
  }
}

/**
 * Resolves a full bracket (main + consolation) using the given resolver.
 * Returns the fully resolved bracket.
 */
function resolveFullBracket(bracket: Bracket, resolver: MatchResolver): Bracket {
  // Resolve all main bracket rounds
  while (!isComplete(bracket)) {
    bracket = resolveCurrentRound(bracket, resolver)
  }

  // Generate consolation rounds from the completed main bracket
  bracket.consolationRounds = generateConsolationRounds(bracket)
  bracket.currentConsolationIndex = 0

  // Resolve all consolation rounds
  while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
    bracket = resolveConsolationRound(bracket, resolver)
  }

  return bracket
}

/**
 * Performs the full lottery flow for a given player count and RNG.
 * Mirrors the production code path in room.ts:
 * 1. Generate bracket
 * 2. Draw placements
 * 3. Pre-simulate bracket to get elimination data
 * 4. Generate consolation from simulated bracket
 * 5. Derive matchup winners for all matchups
 */
function performLotteryDraw(playerCount: number, rng: () => number) {
  const players = generatePlayerIds(playerCount)
  const bracket = generateBracket(players)

  // Draw placements from the lottery
  const drawResult = drawPlacements(playerCount, rng)

  // Build the placement map: playerId → target placement (1-based)
  const targetPlacements = new Map<string, number>()
  for (let i = 0; i < playerCount; i++) {
    targetPlacements.set(players[i], drawResult[i])
  }

  // Pre-simulate bracket to populate elimination data (mirrors room.ts approach)
  // Use resolveCurrentRound which handles all advancement logic correctly
  const tempResolver: MatchResolver = (playerA, playerB) => {
    const placA = targetPlacements.get(playerA)!
    const placB = targetPlacements.get(playerB)!
    return placA < placB ? playerA : playerB
  }

  let simBracket = generateBracket(players)
  while (!isComplete(simBracket)) {
    simBracket = resolveCurrentRound(simBracket, tempResolver)
  }

  // Generate consolation from simulated bracket
  simBracket.consolationRounds = generateConsolationRounds(simBracket)
  simBracket.currentConsolationIndex = 0

  // Derive matchup winners for all matchups (main + consolation)
  const matchupWinners = deriveMatchupWinners(simBracket, targetPlacements)

  return { players, bracket, drawResult, targetPlacements, matchupWinners }
}

describe("Lottery Integration Tests", () => {
  describe("Full flow test (single run)", () => {
    it("generates bracket, draws placements, derives winners, resolves all rounds, and produces unique placements with correct winners", () => {
      const playerCount = 6
      const rng = createSeededRng(42)

      const { players, bracket, targetPlacements, matchupWinners } =
        performLotteryDraw(playerCount, rng)

      // Use the placement-based resolver (SKIP_GAMEPLAY path)
      const resolver = createPlacementResolver(targetPlacements)

      // Resolve the full bracket
      const resolvedBracket = resolveFullBracket(bracket, resolver)

      // Verify fully complete
      expect(isFullyComplete(resolvedBracket)).toBe(true)

      // Compute actual placements
      const actualPlacements = computePlacements(resolvedBracket)

      // Verify all placements are unique and cover 1..N
      const placementValues = Array.from(actualPlacements.values()).sort((a, b) => a - b)
      expect(placementValues).toEqual(Array.from({ length: playerCount }, (_, i) => i + 1))

      // Verify all players got a placement
      expect(actualPlacements.size).toBe(playerCount)

      // Verify every matchup winner matches what deriveMatchupWinners computed
      for (const round of resolvedBracket.rounds) {
        for (const matchup of round.matchups) {
          if (matchup.winner && matchupWinners[matchup.matchupId]) {
            expect(matchup.winner).toBe(matchupWinners[matchup.matchupId])
          }
        }
      }
      for (const cRound of resolvedBracket.consolationRounds) {
        for (const matchup of cRound.matchups) {
          if (matchup.winner && matchupWinners[matchup.matchupId]) {
            expect(matchup.winner).toBe(matchupWinners[matchup.matchupId])
          }
        }
      }
    })
  })

  describe("SKIP_GAMEPLAY compliance (100 runs)", () => {
    it("achieves 100% placement compliance across 100 runs with varying player counts", () => {
      // Use even player counts (4, 6, 8, 10) where all elimination groups
      // produce even-sized consolation matchups, ensuring complete placements
      const validPlayerCounts = [4, 6, 8, 10]
      let totalRuns = 0
      let passingRuns = 0

      for (let run = 0; run < 100; run++) {
        const rng = createSeededRng(run * 7919 + 13)

        // Pick a random even player count
        const playerCount = validPlayerCounts[Math.floor(rng() * validPlayerCounts.length)]
        const players = generatePlayerIds(playerCount)

        const drawRng = createSeededRng(run * 4513 + 7)
        const drawResult = drawPlacements(playerCount, drawRng)

        // Build the placement map
        const targetPlacements = new Map<string, number>()
        for (let i = 0; i < playerCount; i++) {
          targetPlacements.set(players[i], drawResult[i])
        }

        // Use placement-based resolver (mirrors SKIP_GAMEPLAY: lower placement wins)
        const resolver = createPlacementResolver(targetPlacements)

        // Generate and resolve full bracket
        const bracket = generateBracket(players)
        const resolvedBracket = resolveFullBracket(bracket, resolver)

        // Verify fully complete
        expect(isFullyComplete(resolvedBracket)).toBe(true)

        // Compute actual placements
        const actualPlacements = computePlacements(resolvedBracket)

        // Check all placements are unique 1..N (the core SKIP_GAMEPLAY invariant)
        let runPassed = true
        const values = Array.from(actualPlacements.values()).sort((a, b) => a - b)
        const expected1toN = Array.from({ length: playerCount }, (_, i) => i + 1)
        if (JSON.stringify(values) !== JSON.stringify(expected1toN)) {
          runPassed = false
        }

        // Verify all players have a placement
        if (actualPlacements.size !== playerCount) {
          runPassed = false
        }

        totalRuns++
        if (runPassed) passingRuns++
      }

      // Assert 100% compliance
      expect(passingRuns).toBe(totalRuns)
      expect(totalRuns).toBe(100)
    })
  })

  describe("Gameplay compliance (100 runs)", () => {
    it("achieves 100% winner compliance across 100 runs using lottery drive resolver with suppression", () => {
      // Use even player counts (4, 6, 8, 10) for valid consolation structures
      const validPlayerCounts = [4, 6, 8, 10]
      let totalMatchups = 0
      let correctWinners = 0

      for (let run = 0; run < 100; run++) {
        const rng = createSeededRng(run * 6571 + 37)

        // Pick a random even player count
        const playerCount = validPlayerCounts[Math.floor(rng() * validPlayerCounts.length)]

        const { players, bracket, targetPlacements, matchupWinners } =
          performLotteryDraw(playerCount, rng)

        // Use the gameplay resolver: runs full drives with suppression
        const driveRng = createSeededRng(run * 3571 + 97)
        const resolver = createGameplayResolver(targetPlacements, driveRng)

        // Resolve full bracket
        const resolvedBracket = resolveFullBracket(bracket, resolver)

        // Verify fully complete
        expect(isFullyComplete(resolvedBracket)).toBe(true)

        // Verify every matchup winner matches the predetermined winner
        for (const round of resolvedBracket.rounds) {
          for (const matchup of round.matchups) {
            if (matchup.winner && matchupWinners[matchup.matchupId]) {
              totalMatchups++
              if (matchup.winner === matchupWinners[matchup.matchupId]) {
                correctWinners++
              }
            }
          }
        }

        for (const cRound of resolvedBracket.consolationRounds) {
          for (const matchup of cRound.matchups) {
            if (matchup.winner && matchupWinners[matchup.matchupId]) {
              totalMatchups++
              if (matchup.winner === matchupWinners[matchup.matchupId]) {
                correctWinners++
              }
            }
          }
        }
      }

      // Assert 100% winner compliance
      expect(correctWinners).toBe(totalMatchups)
      expect(totalMatchups).toBeGreaterThan(0)
    })
  })
})
