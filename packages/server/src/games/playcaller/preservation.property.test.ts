/**
 * Preservation Property Tests — Server-Side
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.7**
 *
 * These tests capture the BASELINE behavior of `fillMissingPicks()` on UNFIXED code.
 * They must PASS before and after the bugfix to ensure no regressions.
 *
 * Property 2: Preservation — Timeout Fills Genuinely Missing Picks
 *
 * For all matchup configurations where at least one pick is genuinely missing,
 * `fillMissingPicks` fills and returns those matchups correctly.
 */
import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import {
  fillMissingPicks,
  setDriveStates,
  resetDriveStates,
  getDownPicks,
  clearDownPicks,
} from "./PlaycallerPlugin"
import { createDriveState } from "./drive"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./drive"

// ── Arbitraries ──

const offensivePlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom(
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive"
)

const defensivePlayArb: fc.Arbitrary<DefensivePlayId> = fc.constantFrom(
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive"
)

/** Generates a pick state: either undefined (missing) or a valid play */
const optionalOffenseArb: fc.Arbitrary<OffensivePlayId | undefined> = fc.oneof(
  fc.constant(undefined as OffensivePlayId | undefined),
  offensivePlayArb
)

const optionalDefenseArb: fc.Arbitrary<DefensivePlayId | undefined> = fc.oneof(
  fc.constant(undefined as DefensivePlayId | undefined),
  defensivePlayArb
)

/**
 * Generates a matchup configuration with a guaranteed missing pick.
 * At least one of offense/defense is undefined.
 */
const genuinelyMissingPickArb: fc.Arbitrary<{
  offense: OffensivePlayId | undefined
  defense: DefensivePlayId | undefined
}> = fc
  .tuple(optionalOffenseArb, optionalDefenseArb)
  .filter(([off, def]) => off === undefined || def === undefined)
  .map(([offense, defense]) => ({ offense, defense }))

/**
 * Generates a multi-matchup configuration where every matchup has at least one missing pick.
 */
const multiMatchupMissingPicksArb = fc
  .integer({ min: 1, max: 6 })
  .chain((count) =>
    fc.tuple(
      fc.constant(count),
      fc.array(genuinelyMissingPickArb, { minLength: count, maxLength: count })
    )
  )

describe("Preservation Property: fillMissingPicks fills genuinely missing picks", () => {
  beforeEach(() => {
    resetDriveStates()
    clearDownPicks()
  })

  it("for all matchups with at least one missing pick, fillMissingPicks fills and returns those matchup IDs", () => {
    /**
     * **Validates: Requirements 3.5, 3.7**
     *
     * Property: For any set of active matchups where at least one pick (offense or defense)
     * is undefined, fillMissingPicks SHALL:
     * 1. Fill the undefined picks with valid plays
     * 2. Return the matchup IDs of ALL matchups that were processed
     * 3. After filling, both offense and defense picks are defined for each returned matchup
     */
    fc.assert(
      fc.property(multiMatchupMissingPicksArb, ([count, pickConfigs]) => {
        resetDriveStates()
        clearDownPicks()

        // Set up drive states for N matchups
        const states: Record<string, DriveState> = {}
        const matchupIds: string[] = []
        for (let i = 0; i < count; i++) {
          const matchupId = `matchup-${i}`
          matchupIds.push(matchupId)
          states[matchupId] = createDriveState(`playerA-${i}`, `playerB-${i}`, 2, 1)
        }
        setDriveStates(states)

        // Pre-fill picks according to generated config (leaving some undefined)
        const downPicks = getDownPicks()
        for (let i = 0; i < count; i++) {
          const matchupId = `matchup-${i}`
          const config = pickConfigs[i]
          downPicks[matchupId] = {
            offense: config.offense,
            defense: config.defense,
          }
        }

        // Call fillMissingPicks
        const resolved = fillMissingPicks()

        // Assert: every matchup with a missing pick is returned
        for (const matchupId of matchupIds) {
          expect(resolved).toContain(matchupId)
        }

        // Assert: after filling, all picks are defined
        for (const matchupId of matchupIds) {
          const picks = downPicks[matchupId]
          expect(picks.offense).toBeDefined()
          expect(picks.defense).toBeDefined()
        }

        // Assert: filled picks are valid play IDs
        const validOffense: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
        const validDefense: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
        for (const matchupId of matchupIds) {
          const picks = downPicks[matchupId]
          expect(validOffense).toContain(picks.offense)
          expect(validDefense).toContain(picks.defense)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("fillMissingPicks skips completed drives", () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * Property: For any set of matchups where some are complete and some are active
     * with missing picks, fillMissingPicks only fills and returns the active ones.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        (activeCount, completeCount) => {
          resetDriveStates()
          clearDownPicks()

          const states: Record<string, DriveState> = {}
          const activeIds: string[] = []
          const completeIds: string[] = []

          // Create active matchups with missing picks
          for (let i = 0; i < activeCount; i++) {
            const matchupId = `active-${i}`
            activeIds.push(matchupId)
            states[matchupId] = createDriveState(`aPlayerA-${i}`, `aPlayerB-${i}`, 2, 1)
          }

          // Create completed matchups
          for (let i = 0; i < completeCount; i++) {
            const matchupId = `complete-${i}`
            completeIds.push(matchupId)
            const drive = createDriveState(`cPlayerA-${i}`, `cPlayerB-${i}`, 2, 1)
            drive.isComplete = true
            drive.completion = {
              winner: `cPlayerA-${i}`,
              loser: `cPlayerB-${i}`,
              endingType: "touchdown",
              finalState: drive,
            }
            states[matchupId] = drive
          }

          setDriveStates(states)

          // Active matchups have no picks at all (genuinely missing)
          const downPicks = getDownPicks()
          for (const matchupId of activeIds) {
            downPicks[matchupId] = {}
          }

          const resolved = fillMissingPicks()

          // Active matchups are returned
          for (const matchupId of activeIds) {
            expect(resolved).toContain(matchupId)
          }

          // Completed matchups are NOT returned
          for (const matchupId of completeIds) {
            expect(resolved).not.toContain(matchupId)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it("fillMissingPicks fills offense-only-missing correctly", () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * When only the offense pick is missing but defense is present,
     * fillMissingPicks fills offense and preserves the existing defense pick.
     */
    fc.assert(
      fc.property(defensivePlayArb, (existingDefense) => {
        resetDriveStates()
        clearDownPicks()

        const states: Record<string, DriveState> = {}
        states["m1"] = createDriveState("p1", "p2", 2, 1)
        setDriveStates(states)

        const downPicks = getDownPicks()
        downPicks["m1"] = { offense: undefined, defense: existingDefense }

        const resolved = fillMissingPicks()

        expect(resolved).toContain("m1")
        expect(downPicks["m1"].offense).toBeDefined()
        // Existing defense pick is preserved
        expect(downPicks["m1"].defense).toBe(existingDefense)
      }),
      { numRuns: 50 }
    )
  })

  it("fillMissingPicks fills defense-only-missing correctly", () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * When only the defense pick is missing but offense is present,
     * fillMissingPicks fills defense and preserves the existing offense pick.
     */
    fc.assert(
      fc.property(offensivePlayArb, (existingOffense) => {
        resetDriveStates()
        clearDownPicks()

        const states: Record<string, DriveState> = {}
        states["m1"] = createDriveState("p1", "p2", 2, 1)
        setDriveStates(states)

        const downPicks = getDownPicks()
        downPicks["m1"] = { offense: existingOffense, defense: undefined }

        const resolved = fillMissingPicks()

        expect(resolved).toContain("m1")
        // Existing offense pick is preserved
        expect(downPicks["m1"].offense).toBe(existingOffense)
        expect(downPicks["m1"].defense).toBeDefined()
      }),
      { numRuns: 50 }
    )
  })

  it("fillMissingPicks returns empty array when no drive states exist", () => {
    resetDriveStates()
    clearDownPicks()
    // driveStates is null after reset
    const resolved = fillMissingPicks()
    expect(resolved).toEqual([])
  })
})
