/**
 * Feature: consolation-bracket-visualization-fixes
 * Task 1.2: Property tests for buildSchedule()
 *
 * Property 1: Schedule consolidates all consolation into one entry
 * Property 2: Schedule ordering is main-rounds then consolation then finals
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  generateBracket,
  resolveCurrentRound,
  generateConsolationRounds,
  buildSchedule,
} from "./BracketEngine"
import type { Bracket } from "@games-of-chance/shared"

/**
 * Helper: generates a fully-resolved bracket with consolation rounds.
 * Creates a bracket with the given player count, resolves all main rounds
 * using a deterministic resolver (playerA always wins), then generates consolation.
 */
function buildFullBracketWithConsolation(playerCount: number): Bracket {
  const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  let bracket = generateBracket(players)

  // Resolve all main bracket rounds (playerA always wins)
  while (bracket.currentRoundIndex < bracket.totalRounds) {
    bracket = resolveCurrentRound(bracket, (a, _b) => a)
  }

  // Generate consolation rounds
  bracket.consolationRounds = generateConsolationRounds(bracket)

  return bracket
}

describe("Property 1: Schedule consolidates all consolation into one entry", () => {
  /**
   * **Validates: Requirements 1.1, 1.3**
   *
   * For any bracket with one or more consolation rounds, buildSchedule() shall produce
   * exactly one schedule entry with mainBracketRoundIndex === null, and that entry's
   * consolationRoundIndices shall contain every index from 0 to
   * bracket.consolationRounds.length - 1. No schedule entry with a non-null
   * mainBracketRoundIndex shall have any consolation indices.
   */
  it("produces exactly one consolation entry containing all consolation indices", () => {
    fc.assert(
      fc.property(
        // Use player counts 4-16 which guarantee consolation rounds exist
        fc.integer({ min: 4, max: 16 }),
        (playerCount) => {
          const bracket = buildFullBracketWithConsolation(playerCount)

          // Skip if no consolation rounds were generated (e.g., 2-3 players)
          if (bracket.consolationRounds.length === 0) return

          const schedule = buildSchedule(bracket)

          // Exactly one entry has mainBracketRoundIndex === null
          const consolationEntries = schedule.filter(
            (entry) => entry.mainBracketRoundIndex === null
          )
          expect(consolationEntries.length).toBe(1)

          // That entry contains ALL consolation indices
          const consolationEntry = consolationEntries[0]
          const expectedIndices = Array.from(
            { length: bracket.consolationRounds.length },
            (_, i) => i
          )
          expect(consolationEntry.consolationRoundIndices).toEqual(expectedIndices)

          // No main-bracket entry has any consolation indices
          const mainEntries = schedule.filter(
            (entry) => entry.mainBracketRoundIndex !== null
          )
          for (const entry of mainEntries) {
            expect(entry.consolationRoundIndices).toEqual([])
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe("Property 2: Schedule ordering is main-rounds then consolation then finals", () => {
  /**
   * **Validates: Requirements 1.2, 1.5**
   *
   * For any bracket, the schedule produced by buildSchedule() shall have all non-null
   * mainBracketRoundIndex entries in strictly increasing order at the beginning, followed
   * by the consolation entry (if any), followed by a finals entry with
   * mainBracketRoundIndex === totalRounds - 1 as the last element.
   */
  it("orders main rounds in strictly increasing order, then consolation, then finals", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 16 }),
        (playerCount) => {
          const bracket = buildFullBracketWithConsolation(playerCount)
          const schedule = buildSchedule(bracket)

          // The last entry is always finals
          const lastEntry = schedule[schedule.length - 1]
          expect(lastEntry.mainBracketRoundIndex).toBe(bracket.totalRounds - 1)
          expect(lastEntry.description).toBe("Final")

          // If consolation exists, second-to-last is the consolation entry
          if (bracket.consolationRounds.length > 0) {
            const secondToLast = schedule[schedule.length - 2]
            expect(secondToLast.mainBracketRoundIndex).toBeNull()
            expect(secondToLast.description).toBe("Consolation")
          }

          // All entries before consolation/finals have strictly increasing mainBracketRoundIndex
          const mainEntries = schedule.filter(
            (entry) =>
              entry.mainBracketRoundIndex !== null &&
              entry.mainBracketRoundIndex !== bracket.totalRounds - 1
          )
          for (let i = 1; i < mainEntries.length; i++) {
            expect(mainEntries[i].mainBracketRoundIndex!).toBeGreaterThan(
              mainEntries[i - 1].mainBracketRoundIndex!
            )
          }

          // Verify overall order: main rounds come first, then consolation, then finals
          let phase: "main" | "consolation" | "finals" = "main"
          for (const entry of schedule) {
            if (phase === "main") {
              if (entry.mainBracketRoundIndex === null) {
                phase = "consolation"
              } else if (entry.mainBracketRoundIndex === bracket.totalRounds - 1) {
                phase = "finals"
              }
            } else if (phase === "consolation") {
              // After consolation, must be finals
              expect(entry.mainBracketRoundIndex).toBe(bracket.totalRounds - 1)
              phase = "finals"
            } else {
              // After finals, nothing should follow
              expect.unreachable("No entries should follow finals")
            }
          }

          // Ensure we reached finals
          expect(phase).toBe("finals")
        }
      ),
      { numRuns: 50 }
    )
  })

  it("handles brackets with no consolation rounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 3 }),
        (playerCount) => {
          const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
          let bracket = generateBracket(players)

          // Resolve all rounds
          while (bracket.currentRoundIndex < bracket.totalRounds) {
            bracket = resolveCurrentRound(bracket, (a, _b) => a)
          }

          // No consolation rounds
          bracket.consolationRounds = []

          const schedule = buildSchedule(bracket)

          // No consolation entry should exist
          const consolationEntries = schedule.filter(
            (entry) => entry.mainBracketRoundIndex === null
          )
          expect(consolationEntries.length).toBe(0)

          // Last entry is finals
          const lastEntry = schedule[schedule.length - 1]
          expect(lastEntry.mainBracketRoundIndex).toBe(bracket.totalRounds - 1)
        }
      ),
      { numRuns: 20 }
    )
  })
})
