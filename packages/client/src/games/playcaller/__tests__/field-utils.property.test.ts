import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  yardLineToY,
  formatDownDistance,
  getRoundName,
  computeDriveSummary,
  formatPlayResult,
} from "../field-utils"
import type {
  DriveState,
  PlayHistoryEntry,
  PlayResult,
  PlayOutcome,
  OffensivePlayId,
  DefensivePlayId,
} from "../field-utils.types"

// ── Generators ──────────────────────────────────────────────────────────────

const offensivePlayIds: OffensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]
const defensivePlayIds: DefensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]
const playOutcomes: PlayOutcome[] = [
  "success",
  "critical_success",
  "incomplete_pass",
  "tackle_for_loss",
  "interception",
  "fumble",
]

const arbOffensivePlay = fc.constantFrom(...offensivePlayIds)
const arbDefensivePlay = fc.constantFrom(...defensivePlayIds)
const arbOutcome = fc.constantFrom(...playOutcomes)

const arbPlayHistoryEntry: fc.Arbitrary<PlayHistoryEntry> = fc.record({
  down: fc.integer({ min: 1, max: 4 }),
  yardsToGo: fc.integer({ min: 1, max: 35 }),
  yardLine: fc.integer({ min: 0, max: 35 }),
  offensivePlay: arbOffensivePlay,
  defensivePlay: arbDefensivePlay,
  result: fc.record({
    outcome: arbOutcome,
    yardsGained: fc.integer({ min: -10, max: 35 }),
    playByPlayText: fc.string(),
    offensivePlay: arbOffensivePlay,
    defensivePlay: arbDefensivePlay,
  }),
  resultingYardLine: fc.integer({ min: 0, max: 35 }),
})

const arbPlayResult: fc.Arbitrary<PlayResult> = fc.record({
  outcome: arbOutcome,
  yardsGained: fc.integer({ min: -10, max: 50 }),
  playByPlayText: fc.string(),
  offensivePlay: arbOffensivePlay,
  defensivePlay: arbDefensivePlay,
})

// ── Property 1: Ball position maps yard line to Y coordinate ────────────────

describe("Property 1: Ball position maps yard line to Y coordinate", () => {
  /**
   * For any valid yard line value (0 through maxYards), yardLineToY SHALL produce
   * a Y coordinate equal to endZoneHeight + (yardLine / maxYards) * fieldHeight.
   *
   * **Validates: Requirements 2.2**
   */
  it("yardLineToY produces endZoneHeight + (yardLine/maxYards)*fieldHeight for any valid inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // yardLine
        fc.integer({ min: 1, max: 100 }), // maxYards (must be > 0)
        fc.double({ min: 50, max: 1000, noNaN: true, noDefaultInfinity: true }), // fieldHeight
        fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }), // endZoneHeight
        (yardLine, maxYards, fieldHeight, endZoneHeight) => {
          fc.pre(yardLine <= maxYards)

          const result = yardLineToY(yardLine, maxYards, fieldHeight, endZoneHeight)
          const expected = endZoneHeight + (yardLine / maxYards) * fieldHeight

          expect(result).toBeCloseTo(expected, 10)
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ── Property 2: Down/distance formatting produces correct ordinal text ──────

describe("Property 2: Down/distance formatting produces correct ordinal text", () => {
  /**
   * For any valid down number (1–4) and positive yards-to-go value, formatDownDistance
   * SHALL produce a string in the format "{ordinal} & {yardsToGo}" where the ordinal
   * is "1st", "2nd", "3rd", or "4th".
   *
   * **Validates: Requirements 2.4**
   */
  it("formatDownDistance produces correct ordinal for down 1-4 and includes yardsToGo", () => {
    const expectedOrdinals: Record<number, string> = {
      1: "1st",
      2: "2nd",
      3: "3rd",
      4: "4th",
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }), // down
        fc.integer({ min: 1, max: 99 }), // yardsToGo (positive)
        (down, yardsToGo) => {
          const result = formatDownDistance(down, yardsToGo)
          const expectedOrdinal = expectedOrdinals[down]

          expect(result).toBe(`${expectedOrdinal} & ${yardsToGo}`)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 12: Round name derivation is correct for all bracket sizes ─────

describe("Property 12: Round name derivation is correct for all bracket sizes", () => {
  /**
   * For any valid (roundIndex, totalRounds) pair where roundIndex < totalRounds,
   * getRoundName SHALL return "Final" for the last round, "Semifinal" for the
   * second-to-last, "Quarterfinal" for the third-to-last, and "Round N" for
   * all earlier rounds.
   *
   * **Validates: Requirements 10.1**
   */
  it("getRoundName returns Final/Semifinal/Quarterfinal for last 3 rounds, Round N for earlier", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // totalRounds (at least 1)
        fc.integer({ min: 0, max: 9 }), // roundIndex
        (totalRounds, roundIndex) => {
          fc.pre(roundIndex < totalRounds)

          const result = getRoundName(roundIndex, totalRounds)
          const roundsFromEnd = totalRounds - roundIndex

          if (roundsFromEnd === 1) {
            expect(result).toBe("Final")
          } else if (roundsFromEnd === 2) {
            expect(result).toBe("Semifinal")
          } else if (roundsFromEnd === 3) {
            expect(result).toBe("Quarterfinal")
          } else {
            expect(result).toBe(`Round ${roundIndex + 1}`)
          }
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ── Property 13: Drive summary computes correct totals from play history ────

describe("Property 13: Drive summary computes correct totals from play history", () => {
  /**
   * For any completed DriveState, computeDriveSummary SHALL return totalPlays equal
   * to playHistory.length and totalYards equal to the sum of all
   * playHistory[i].result.yardsGained values.
   *
   * **Validates: Requirements 11.3**
   */
  it("computeDriveSummary totalPlays equals playHistory.length and totalYards equals sum of yardsGained", () => {
    fc.assert(
      fc.property(
        fc.array(arbPlayHistoryEntry, { minLength: 1, maxLength: 20 }),
        fc.constantFrom("touchdown", "interception", "fumble", "turnover_on_downs") as fc.Arbitrary<"touchdown" | "interception" | "fumble" | "turnover_on_downs">,
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (playHistory, endingType, winner, loser) => {
          const state: DriveState = {
            offensePlayerId: "player-1",
            defensePlayerId: "player-2",
            yardLine: 20,
            down: 1,
            yardsToGo: 10,
            playHistory,
            isComplete: true,
            completion: {
              winner,
              loser,
              endingType,
            },
          }

          const summary = computeDriveSummary(state)

          expect(summary).not.toBeNull()
          expect(summary!.totalPlays).toBe(playHistory.length)

          const expectedTotalYards = playHistory.reduce(
            (sum, entry) => sum + entry.result.yardsGained,
            0
          )
          expect(summary!.totalYards).toBe(expectedTotalYards)
          expect(summary!.endingType).toBe(endingType)
          expect(summary!.winner).toBe(winner)
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ── Property 7: Play result formatting includes play name and outcome ───────

describe("Property 7: Play result formatting includes play name and outcome", () => {
  /**
   * For any PlayResult, the formatPlayResult function SHALL produce a non-empty
   * string containing a recognizable outcome descriptor (yards gained, "Intercepted!",
   * "Fumble!", "Incomplete", or yardage loss).
   *
   * **Validates: Requirements 7.1**
   */
  it("always returns a non-empty string", () => {
    fc.assert(
      fc.property(arbPlayResult, (result) => {
        const formatted = formatPlayResult(result)
        expect(formatted.length).toBeGreaterThan(0)
      }),
      { numRuns: 500 }
    )
  })

  it("contains a recognizable outcome descriptor for every valid outcome", () => {
    fc.assert(
      fc.property(arbPlayResult, (result) => {
        const formatted = formatPlayResult(result)

        // Every formatted result must contain one of these outcome descriptors
        const hasOutcomeDescriptor =
          formatted.includes("Intercepted!") ||
          formatted.includes("Fumble!") ||
          formatted.includes("Incomplete") ||
          formatted.includes("Loss of") ||
          formatted.includes("yard")

        expect(hasOutcomeDescriptor).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it("produces meaningful output for all valid PlayOutcome values and offensive plays", () => {
    fc.assert(
      fc.property(
        arbOffensivePlay,
        arbOutcome,
        fc.integer({ min: -10, max: 50 }),
        arbDefensivePlay,
        (offensivePlay, outcome, yardsGained, defensivePlay) => {
          const result: PlayResult = {
            outcome,
            yardsGained,
            playByPlayText: "",
            offensivePlay,
            defensivePlay,
          }

          const formatted = formatPlayResult(result)

          // Must be a non-empty string
          expect(formatted.length).toBeGreaterThan(0)

          // Must contain the em dash separator indicating structured formatting
          expect(formatted).toContain("\u2014")

          // The play name portion (before the dash) should be non-empty
          const parts = formatted.split("\u2014")
          expect(parts[0].trim().length).toBeGreaterThan(0)
          expect(parts[1].trim().length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })
})
