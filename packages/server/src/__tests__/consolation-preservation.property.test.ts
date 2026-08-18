/**
 * Feature: consolation-concurrent-scheduling, Property 2: Preservation
 * Main Bracket Progression and Drive Gameplay Unchanged
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 *
 * These tests capture the baseline behavior of the unfixed code to ensure
 * the concurrent consolation scheduling fix does not regress main-bracket logic,
 * drive initialization, or coin toss ceremony behavior.
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete,
  isFullyComplete,
  computePlacements,
  generateConsolationRounds,
  resolveConsolationRound,
  nextPowerOfTwo,
  computeByeCount,
} from "../games/playcaller/BracketEngine"
import {
  createCeremonyStates,
  handleCoinCall,
  handleSideChoice,
} from "../games/playcaller/coinTossCeremony"
import { createDriveState } from "../games/playcaller/drive/engine"
import type { MatchResolver, Bracket, Matchup } from "@games-of-chance/shared"

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Creates player array of given size */
function makePlayers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}`)
}

/** Always picks playerA (higher seed wins) */
const higherSeedWins: MatchResolver = (a, _b) => a

/** Always picks playerB (lower seed wins — upset resolver) */
const lowerSeedWins: MatchResolver = (_a, b) => b

/** Fully resolve all main bracket rounds */
function resolveAllMainRounds(bracket: Bracket, resolver: MatchResolver): Bracket {
  while (!isComplete(bracket)) {
    bracket = resolveCurrentRound(bracket, resolver)
  }
  return bracket
}

/** Fully resolve all consolation rounds */
function resolveAllConsolation(bracket: Bracket, resolver: MatchResolver): Bracket {
  while (bracket.currentConsolationIndex < bracket.consolationRounds.length) {
    bracket = resolveConsolationRound(bracket, resolver)
  }
  return bracket
}

// ── Property Tests ──────────────────────────────────────────────────────────

describe("Property 2: Preservation - Main Bracket Progression and Drive Gameplay Unchanged", () => {
  describe("2.1: generateBracket produces identical bracket structure for all player counts", () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For all player counts 2-10, generateBracket must produce a bracket with:
     * - Correct total rounds (ceil(log2(playerCount)))
     * - Correct number of byes (nextPowerOf2 - playerCount)
     * - Correct seeding assignments
     * - Deterministic matchupId naming convention
     * - Starting state: currentRoundIndex=0, empty eliminated, empty consolationRounds
     */
    it("bracket structure is deterministic for any player count 2-10", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)

            // Correct total rounds
            const expectedTotalRounds = Math.ceil(Math.log2(playerCount))
            expect(bracket.totalRounds).toBe(expectedTotalRounds)

            // Correct number of rounds array entries
            expect(bracket.rounds).toHaveLength(expectedTotalRounds)

            // Initial state
            expect(bracket.currentRoundIndex).toBe(0)
            expect(bracket.consolationRounds).toHaveLength(0)
            expect(bracket.currentConsolationIndex).toBe(0)
            expect(Object.keys(bracket.eliminated)).toHaveLength(0)

            // Correct seeds
            for (let i = 0; i < playerCount; i++) {
              expect(bracket.seeds[players[i]]).toBe(i + 1)
            }
            expect(Object.keys(bracket.seeds)).toHaveLength(playerCount)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("byes are assigned correctly for non-power-of-2 player counts", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)

            const expectedByeCount = computeByeCount(playerCount)
            const firstRound = bracket.rounds[0]

            expect(firstRound.byes).toHaveLength(expectedByeCount)

            // Byes go to the highest-seeded players (seeds 1..byeCount)
            for (const byePlayer of firstRound.byes) {
              expect(bracket.seeds[byePlayer]).toBeLessThanOrEqual(expectedByeCount)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("matchup IDs follow deterministic naming convention", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)

            for (let r = 0; r < bracket.rounds.length; r++) {
              const round = bracket.rounds[r]
              for (let m = 0; m < round.matchups.length; m++) {
                expect(round.matchups[m].matchupId).toBe(`r${r}-m${m}`)
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("first round matchups have non-empty playerA and playerB for no-bye brackets", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(2, 4, 8), // power-of-2 counts have no byes
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)
            const firstRound = bracket.rounds[0]

            expect(firstRound.byes).toHaveLength(0)
            for (const matchup of firstRound.matchups) {
              expect(matchup.playerA).not.toBe("")
              expect(matchup.playerB).not.toBe("")
              // Both players should be different
              expect(matchup.playerA).not.toBe(matchup.playerB)
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it("generating bracket twice with same input produces identical output", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket1 = generateBracket(players)
            const bracket2 = generateBracket(players)

            // Deep equality: same structure every time
            expect(bracket1.totalRounds).toBe(bracket2.totalRounds)
            expect(bracket1.rounds.length).toBe(bracket2.rounds.length)
            expect(bracket1.seeds).toEqual(bracket2.seeds)

            for (let r = 0; r < bracket1.rounds.length; r++) {
              const r1 = bracket1.rounds[r]
              const r2 = bracket2.rounds[r]
              expect(r1.byes).toEqual(r2.byes)
              expect(r1.matchups.length).toBe(r2.matchups.length)
              for (let m = 0; m < r1.matchups.length; m++) {
                expect(r1.matchups[m].matchupId).toBe(r2.matchups[m].matchupId)
                expect(r1.matchups[m].playerA).toBe(r2.matchups[m].playerA)
                expect(r1.matchups[m].playerB).toBe(r2.matchups[m].playerB)
                expect(r1.matchups[m].winner).toBe(r2.matchups[m].winner)
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe("2.2: resolveCurrentRound produces identical winner placement and elimination", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any resolved round with no consolation involvement, resolveCurrentRound
     * advances winners to the next round correctly and records eliminated players.
     */
    it("resolving a round eliminates exactly the losers from that round", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.constantFrom("higher", "lower") as fc.Arbitrary<"higher" | "lower">,
          (playerCount, strategy) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)

            const resolver: MatchResolver = strategy === "higher" ? higherSeedWins : lowerSeedWins

            // Resolve just the first round
            const firstRound = bracket.rounds[0]
            const matchupsBeforeResolve = firstRound.matchups.map((m) => ({
              playerA: m.playerA,
              playerB: m.playerB,
            }))

            bracket = resolveCurrentRound(bracket, resolver)

            // Check eliminations
            for (const m of matchupsBeforeResolve) {
              if (m.playerA === "" || m.playerB === "") continue
              const expectedLoser = strategy === "higher" ? m.playerB : m.playerA
              expect(bracket.eliminated[expectedLoser]).toBe(0)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("resolving advances currentRoundIndex by exactly 1", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)

            const indexBefore = bracket.currentRoundIndex
            bracket = resolveCurrentRound(bracket, higherSeedWins)
            expect(bracket.currentRoundIndex).toBe(indexBefore + 1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("winners from resolved matchups appear as players in the next round", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 10 }),
          fc.constantFrom("higher", "lower") as fc.Arbitrary<"higher" | "lower">,
          (playerCount, strategy) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            const resolver: MatchResolver = strategy === "higher" ? higherSeedWins : lowerSeedWins

            // Resolve first round
            bracket = resolveCurrentRound(bracket, resolver)

            if (bracket.currentRoundIndex < bracket.totalRounds) {
              const nextRound = bracket.rounds[bracket.currentRoundIndex]
              const nextRoundPlayers = new Set<string>()
              for (const m of nextRound.matchups) {
                if (m.playerA) nextRoundPlayers.add(m.playerA)
                if (m.playerB) nextRoundPlayers.add(m.playerB)
              }

              // Every winner from the first round + byes should be in next round
              const firstRound = bracket.rounds[0]
              for (const m of firstRound.matchups) {
                if (m.winner) {
                  expect(nextRoundPlayers.has(m.winner)).toBe(true)
                }
              }
              for (const bye of firstRound.byes) {
                expect(nextRoundPlayers.has(bye)).toBe(true)
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("fully resolving main bracket produces exactly one champion", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.constantFrom("higher", "lower") as fc.Arbitrary<"higher" | "lower">,
          (playerCount, strategy) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            const resolver: MatchResolver = strategy === "higher" ? higherSeedWins : lowerSeedWins

            bracket = resolveAllMainRounds(bracket, resolver)

            expect(isComplete(bracket)).toBe(true)

            // Final round has exactly one matchup with a winner
            const finalRound = bracket.rounds[bracket.totalRounds - 1]
            expect(finalRound.matchups).toHaveLength(1)
            expect(finalRound.matchups[0].winner).not.toBeNull()

            // Eliminated players = all except the champion
            const eliminatedCount = Object.keys(bracket.eliminated).length
            expect(eliminatedCount).toBe(playerCount - 1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("play-in round with byes places winners into correct seeded positions", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(3, 5, 6, 7, 9, 10), // non-power-of-2 counts
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)

            // Only test if there are byes (play-in round)
            const firstRound = bracket.rounds[0]
            if (firstRound.byes.length === 0) return

            bracket = resolveCurrentRound(bracket, higherSeedWins)

            // Next round should have proper player placement
            const nextRound = bracket.rounds[1]
            const nextRoundPlayers: string[] = []
            for (const m of nextRound.matchups) {
              if (m.playerA) nextRoundPlayers.push(m.playerA)
              if (m.playerB) nextRoundPlayers.push(m.playerB)
            }

            // All bye players + winners should be in next round
            const expectedInNextRound = new Set([
              ...firstRound.byes,
              ...firstRound.matchups.map((m) => m.winner!),
            ])

            for (const player of nextRoundPlayers) {
              expect(expectedInNextRound.has(player)).toBe(true)
            }
            expect(nextRoundPlayers.length).toBe(expectedInNextRound.size)
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe("2.3: computePlacements produces identical placement maps", () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any fully-complete bracket with resolved consolation rounds,
     * computePlacements returns correct unique placements 1-N.
     */
    it("placements for fully resolved bracket with consolation produce unique positions for placed players", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)

            // Resolve main bracket
            bracket = resolveAllMainRounds(bracket, higherSeedWins)

            // Generate and resolve consolation
            bracket.consolationRounds = generateConsolationRounds(bracket)

            if (bracket.consolationRounds.length > 0) {
              bracket = resolveAllConsolation(bracket, higherSeedWins)
            }

            const placements = computePlacements(bracket)

            // Champion always gets 1
            const finalMatchup = bracket.rounds[bracket.totalRounds - 1].matchups[0]
            expect(placements.get(finalMatchup.winner!)).toBe(1)

            // All placed positions are unique (no two players share a position)
            const positions = Array.from(placements.values())
            const uniquePositions = new Set(positions)
            expect(uniquePositions.size).toBe(positions.length)

            // All positions are >= 1
            for (const pos of positions) {
              expect(pos).toBeGreaterThanOrEqual(1)
              expect(pos).toBeLessThanOrEqual(playerCount)
            }

            // For player counts where all groups have >=2 players (power-of-2),
            // all players should have placements
            if (computeByeCount(playerCount) === 0 || playerCount >= 6) {
              // 2,4,8 players (no byes) or 6+ players all have proper consolation coverage
              // For these cases, placements cover all players
              if (playerCount === 2 || playerCount === 4 || playerCount === 8) {
                expect(placements.size).toBe(playerCount)
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("placements cover all players for even elimination groups (4, 8, 10 players)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(4, 8, 10),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            bracket.consolationRounds = generateConsolationRounds(bracket)
            if (bracket.consolationRounds.length > 0) {
              bracket = resolveAllConsolation(bracket, higherSeedWins)
            }

            const placements = computePlacements(bracket)

            // For these player counts, all players should have unique placements 1-N
            expect(placements.size).toBe(playerCount)
            const positions = Array.from(placements.values()).sort((a, b) => a - b)
            const expectedPositions = Array.from({ length: playerCount }, (_, i) => i + 1)
            expect(positions).toEqual(expectedPositions)
          }
        ),
        { numRuns: 20 }
      )
    })

    it("champion always gets placement 1", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.constantFrom("higher", "lower") as fc.Arbitrary<"higher" | "lower">,
          (playerCount, strategy) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            const resolver: MatchResolver = strategy === "higher" ? higherSeedWins : lowerSeedWins

            bracket = resolveAllMainRounds(bracket, resolver)
            bracket.consolationRounds = generateConsolationRounds(bracket)
            if (bracket.consolationRounds.length > 0) {
              bracket = resolveAllConsolation(bracket, resolver)
            }

            const placements = computePlacements(bracket)
            const finalMatchup = bracket.rounds[bracket.totalRounds - 1].matchups[0]
            const champion = finalMatchup.winner!

            expect(placements.get(champion)).toBe(1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("runner-up always gets placement 2 with consolation", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)

            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            bracket.consolationRounds = generateConsolationRounds(bracket)
            if (bracket.consolationRounds.length > 0) {
              bracket = resolveAllConsolation(bracket, higherSeedWins)
            }

            const placements = computePlacements(bracket)
            const finalMatchup = bracket.rounds[bracket.totalRounds - 1].matchups[0]
            const champion = finalMatchup.winner!
            const runnerUp = finalMatchup.playerA === champion
              ? finalMatchup.playerB
              : finalMatchup.playerA

            expect(placements.get(runnerUp)).toBe(2)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("computePlacements is deterministic for the same bracket state", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            bracket.consolationRounds = generateConsolationRounds(bracket)
            if (bracket.consolationRounds.length > 0) {
              bracket = resolveAllConsolation(bracket, higherSeedWins)
            }

            const placements1 = computePlacements(bracket)
            const placements2 = computePlacements(bracket)

            // Must be identical
            expect(placements1.size).toBe(placements2.size)
            for (const [player, pos] of placements1) {
              expect(placements2.get(player)).toBe(pos)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe("2.4: Drive initialization produces identical drive states", () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any matchup (main or consolation), drive initialization with createDriveState
     * produces identical drive states with correct initial values.
     */
    it("createDriveState initializes with yardLine=25, down=1, yardsToGo=10", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
          fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
          (playerA, playerB, seedABase) => {
            // Ensure different players
            if (playerA === playerB) return

            const seedA = seedABase === 1 ? 1 : 2
            const seedB = seedABase === 1 ? 2 : 1

            const drive = createDriveState(playerA, playerB, seedA, seedB)

            expect(drive.yardLine).toBe(25)
            expect(drive.down).toBe(1)
            expect(drive.yardsToGo).toBe(10)
            expect(drive.isComplete).toBe(false)
            expect(drive.completion).toBeNull()
            expect(drive.playHistory).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("higher seed number is offense, lower seed number is defense", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (baseId) => {
            const playerA = `player${baseId}`
            const playerB = `player${baseId + 100}`

            // seedA > seedB means playerA is offense
            const drive1 = createDriveState(playerA, playerB, 2, 1)
            expect(drive1.offensePlayerId).toBe(playerA)
            expect(drive1.defensePlayerId).toBe(playerB)

            // seedB > seedA means playerB is offense
            const drive2 = createDriveState(playerA, playerB, 1, 2)
            expect(drive2.offensePlayerId).toBe(playerB)
            expect(drive2.defensePlayerId).toBe(playerA)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("drive initialization works for matchups from a real bracket", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)

            // Get first round matchups
            const firstRound = bracket.rounds[0]
            for (const matchup of firstRound.matchups) {
              if (matchup.playerA === "" || matchup.playerB === "") continue

              // Create drive with arbitrary offense assignment
              const drive = createDriveState(matchup.playerA, matchup.playerB, 2, 1)
              expect(drive.yardLine).toBe(25)
              expect(drive.down).toBe(1)
              expect(drive.yardsToGo).toBe(10)
              expect(drive.offensePlayerId).toBe(matchup.playerA)
              expect(drive.defensePlayerId).toBe(matchup.playerB)
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe("2.5: Coin toss ceremony produces identical results", () => {
    /**
     * **Validates: Requirements 3.3, 3.6**
     *
     * createCeremonyStates, handleCoinCall, handleSideChoice produce identical
     * results for any valid matchup input.
     */
    it("createCeremonyStates assigns playerA as caller and playerB as waiter", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            const bracket = generateBracket(players)
            const firstRound = bracket.rounds[0]
            const validMatchups = firstRound.matchups.filter(
              (m) => m.playerA !== "" && m.playerB !== ""
            )

            if (validMatchups.length === 0) return

            const states = createCeremonyStates(validMatchups)

            for (const matchup of validMatchups) {
              const state = states[matchup.matchupId]
              expect(state).toBeDefined()
              expect(state.callerId).toBe(matchup.playerA)
              expect(state.waiterId).toBe(matchup.playerB)
              expect(state.step).toBe("AWAITING_CALL")
              expect(state.calledSide).toBeNull()
              expect(state.flipOutcome).toBeNull()
              expect(state.chooserId).toBeNull()
              expect(state.sideSelection).toBeNull()
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it("handleCoinCall rejects invalid caller (not playerA)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("HEADS", "TAILS"),
          (side) => {
            const matchup: Matchup = {
              matchupId: "test-m0",
              playerA: "caller",
              playerB: "waiter",
              winner: null,
            }
            const states = createCeremonyStates([matchup])
            const state = states["test-m0"]

            // Invalid caller (playerB trying to call)
            const result = handleCoinCall(state, "waiter", side)
            expect(result.ok).toBe(false)
            if (!result.ok) {
              expect(result.error).toBe("INVALID_CALLER")
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it("handleCoinCall succeeds with valid caller and transitions to AWAITING_CHOICE", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("HEADS", "TAILS"),
          (side) => {
            const matchup: Matchup = {
              matchupId: "test-m0",
              playerA: "caller",
              playerB: "waiter",
              winner: null,
            }
            const states = createCeremonyStates([matchup])
            const state = states["test-m0"]

            // Use deterministic RNG
            const rng = () => 0.3 // Will produce "HEADS"
            const result = handleCoinCall(state, "caller", side, rng)

            expect(result.ok).toBe(true)
            if (result.ok) {
              expect(result.state.step).toBe("AWAITING_CHOICE")
              expect(result.state.calledSide).toBe(side)
              expect(result.state.flipOutcome).toBe("HEADS") // rng < 0.5 = HEADS
              // Chooser: if called side matches outcome, caller wins; else waiter
              const expectedChooser = side === "HEADS" ? "caller" : "waiter"
              expect(result.state.chooserId).toBe(expectedChooser)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it("handleSideChoice succeeds with valid chooser and transitions to COMPLETE", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("OFFENSE", "DEFENSE"),
          (selection) => {
            const matchup: Matchup = {
              matchupId: "test-m0",
              playerA: "caller",
              playerB: "waiter",
              winner: null,
            }
            const states = createCeremonyStates([matchup])
            let state = states["test-m0"]

            // First complete coin call (caller wins the toss)
            const rng = () => 0.3 // HEADS
            const callResult = handleCoinCall(state, "caller", "HEADS", rng)
            expect(callResult.ok).toBe(true)
            if (!callResult.ok) return
            state = callResult.state

            // Now chooser is "caller" (called HEADS, got HEADS)
            const choiceResult = handleSideChoice(state, "caller", selection)
            expect(choiceResult.ok).toBe(true)
            if (choiceResult.ok) {
              expect(choiceResult.state.step).toBe("COMPLETE")
              expect(choiceResult.state.sideSelection).toBe(selection)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it("handleSideChoice rejects non-chooser", () => {
      const matchup: Matchup = {
        matchupId: "test-m0",
        playerA: "caller",
        playerB: "waiter",
        winner: null,
      }
      const states = createCeremonyStates([matchup])
      let state = states["test-m0"]

      // Caller wins the toss
      const rng = () => 0.3
      const callResult = handleCoinCall(state, "caller", "HEADS", rng)
      expect(callResult.ok).toBe(true)
      if (!callResult.ok) return
      state = callResult.state

      // Non-chooser (waiter) tries to make side choice - should fail
      const result = handleSideChoice(state, "waiter", "OFFENSE")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_CHOOSER")
      }
    })

    it("ceremony works for consolation matchups the same as main bracket", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 10 }),
          fc.constantFrom("HEADS", "TAILS"),
          fc.constantFrom("OFFENSE", "DEFENSE"),
          (playerCount, coinSide, sideChoice) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            bracket.consolationRounds = generateConsolationRounds(bracket)

            if (bracket.consolationRounds.length === 0) return

            // Get a consolation matchup with actual players
            const consolationMatchups = bracket.consolationRounds
              .flatMap((r) => r.matchups)
              .filter((m) => m.playerA !== "" && m.playerB !== "")

            if (consolationMatchups.length === 0) return

            const matchup = consolationMatchups[0]
            const states = createCeremonyStates([matchup])
            const state = states[matchup.matchupId]

            // Verify same structure as main bracket
            expect(state.callerId).toBe(matchup.playerA)
            expect(state.waiterId).toBe(matchup.playerB)
            expect(state.step).toBe("AWAITING_CALL")

            // Full ceremony flow
            const rng = () => 0.3 // HEADS
            const callResult = handleCoinCall(state, matchup.playerA, coinSide, rng)
            expect(callResult.ok).toBe(true)
            if (!callResult.ok) return

            const chooser = callResult.state.chooserId!
            const choiceResult = handleSideChoice(callResult.state, chooser, sideChoice)
            expect(choiceResult.ok).toBe(true)
            if (choiceResult.ok) {
              expect(choiceResult.state.step).toBe("COMPLETE")
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe("2.6: generateConsolationRounds preservation", () => {
    /**
     * **Validates: Requirements 3.5, 3.7**
     *
     * generateConsolationRounds produces consistent output for any completed bracket.
     */
    it("consolation rounds have correct sourceRoundIndex matching elimination round", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            const consolation = generateConsolationRounds(bracket)

            for (const round of consolation) {
              for (const matchup of round.matchups) {
                if (matchup.playerA === "" || matchup.playerB === "") continue
                // Both players should be eliminated in the source round
                expect(bracket.eliminated[matchup.playerA]).toBe(round.sourceRoundIndex)
                expect(bracket.eliminated[matchup.playerB]).toBe(round.sourceRoundIndex)
              }
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it("generateConsolationRounds is deterministic", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)

            const consolation1 = generateConsolationRounds(bracket)
            const consolation2 = generateConsolationRounds(bracket)

            expect(consolation1.length).toBe(consolation2.length)
            for (let i = 0; i < consolation1.length; i++) {
              expect(consolation1[i].placementStart).toBe(consolation2[i].placementStart)
              expect(consolation1[i].sourceRoundIndex).toBe(consolation2[i].sourceRoundIndex)
              expect(consolation1[i].matchups.length).toBe(consolation2[i].matchups.length)
              for (let m = 0; m < consolation1[i].matchups.length; m++) {
                expect(consolation1[i].matchups[m].playerA).toBe(consolation2[i].matchups[m].playerA)
                expect(consolation1[i].matchups[m].playerB).toBe(consolation2[i].matchups[m].playerB)
              }
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it("resolveConsolationRound populates mini-bracket final slots from semi-final winners", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(8, 10), // player counts that produce 4-player groups
          (playerCount) => {
            const players = makePlayers(playerCount)
            let bracket = generateBracket(players)
            bracket = resolveAllMainRounds(bracket, higherSeedWins)
            bracket.consolationRounds = generateConsolationRounds(bracket)

            // Find a mini-bracket (two consecutive rounds with same placementStart)
            for (let i = 0; i < bracket.consolationRounds.length - 1; i++) {
              const curr = bracket.consolationRounds[i]
              const next = bracket.consolationRounds[i + 1]
              if (curr.placementStart === next.placementStart) {
                // This is a semi-final → final pair
                // Before resolving, final should have empty slots
                expect(next.matchups[0].playerA).toBe("")
                expect(next.matchups[0].playerB).toBe("")

                // Resolve the semi-final
                bracket.currentConsolationIndex = i
                bracket = resolveConsolationRound(bracket, higherSeedWins)

                // After resolving semi-final, final slots should be populated
                expect(next.matchups[0].playerA).not.toBe("")
                expect(next.matchups[0].playerB).not.toBe("")
                break
              }
            }
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
