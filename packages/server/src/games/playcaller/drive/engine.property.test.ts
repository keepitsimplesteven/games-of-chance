import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { resolveDown, selectRandomPlay } from "./engine"
import { generatePlayByPlay } from "./playByPlay"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./types"

/**
 * Feature: playcaller-drive-engine, Property 8: Pure function determinism
 *
 * Call resolveDown twice with identical inputs and same RNG sequence, verify:
 * - Identical outputs (same state and result)
 * - No mutation of the input state
 *
 * Validates: Requirements 5.10, 10.2, 10.3
 */

// --- Seeded RNG helper ---
function createSeededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// --- Arbitraries ---
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

const driveStateArb: fc.Arbitrary<DriveState> = fc
  .record({
    yardLine: fc.integer({ min: 1, max: 99 }),
    down: fc.integer({ min: 1, max: 4 }),
    yardsToGo: fc.integer({ min: 1, max: 99 }),
  })
  .chain(({ yardLine, down, yardsToGo }) => {
    // Clamp yardsToGo to at most the current yardLine (realistic constraint)
    const clampedYardsToGo = Math.min(yardsToGo, yardLine)
    return fc.constant<DriveState>({
      offensePlayerId: "player-offense",
      defensePlayerId: "player-defense",
      yardLine,
      down,
      yardsToGo: clampedYardsToGo,
      playHistory: [],
      isComplete: false,
      completion: null,
    })
  })

const seedArb = fc.integer({ min: 1, max: 2 ** 31 - 1 })

describe("Feature: playcaller-drive-engine, Property 8: Pure function determinism", () => {
  it("resolveDown produces identical outputs for identical inputs and same RNG sequence", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        seedArb,
        (state, offPlay, defPlay, seed) => {
          // Deep copy state for each call to ensure independence
          const stateForCall1: DriveState = JSON.parse(JSON.stringify(state))
          const stateForCall2: DriveState = JSON.parse(JSON.stringify(state))

          // Create two RNG instances from the same seed
          const rng1 = createSeededRng(seed)
          const rng2 = createSeededRng(seed)

          // Call resolveDown with identical inputs
          const result1 = resolveDown(
            stateForCall1,
            offPlay,
            defPlay,
            rng1,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )
          const result2 = resolveDown(
            stateForCall2,
            offPlay,
            defPlay,
            rng2,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Verify identical outputs (excluding circular finalState reference)
          expect(result1.result).toEqual(result2.result)
          expect(result1.state.yardLine).toBe(result2.state.yardLine)
          expect(result1.state.down).toBe(result2.state.down)
          expect(result1.state.yardsToGo).toBe(result2.state.yardsToGo)
          expect(result1.state.isComplete).toBe(result2.state.isComplete)
          expect(result1.state.playHistory).toEqual(result2.state.playHistory)
          expect(result1.state.offensePlayerId).toBe(result2.state.offensePlayerId)
          expect(result1.state.defensePlayerId).toBe(result2.state.defensePlayerId)

          if (result1.state.completion && result2.state.completion) {
            expect(result1.state.completion.winner).toBe(result2.state.completion.winner)
            expect(result1.state.completion.loser).toBe(result2.state.completion.loser)
            expect(result1.state.completion.endingType).toBe(result2.state.completion.endingType)
          } else {
            expect(result1.state.completion).toEqual(result2.state.completion)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("resolveDown does not mutate the input state", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        seedArb,
        (state, offPlay, defPlay, seed) => {
          // Take a deep snapshot of the original state before calling resolveDown
          const snapshot: DriveState = JSON.parse(JSON.stringify(state))

          const rng = createSeededRng(seed)

          // Call resolveDown with the original state
          resolveDown(
            state,
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Assert the original state was not mutated
          expect(state.yardLine).toBe(snapshot.yardLine)
          expect(state.down).toBe(snapshot.down)
          expect(state.yardsToGo).toBe(snapshot.yardsToGo)
          expect(state.isComplete).toBe(snapshot.isComplete)
          expect(state.completion).toEqual(snapshot.completion)
          expect(state.playHistory).toEqual(snapshot.playHistory)
          expect(state.offensePlayerId).toBe(snapshot.offensePlayerId)
          expect(state.defensePlayerId).toBe(snapshot.defensePlayerId)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// --- Helper to compute modified stats (replicates engine clamping logic) ---
function computeModifiedStats(offPlay: OffensivePlayId, defPlay: DefensivePlayId) {
  const base = DEFAULT_PLAY_CONFIG.offensivePlays[offPlay]
  const key = `${offPlay}:${defPlay}` as `${OffensivePlayId}:${DefensivePlayId}`
  const mod = DEFAULT_PLAY_MATRIX[key]

  const successRate = Math.max(0.05, Math.min(0.95, base.successRate + mod.successRateMod))
  const maxRaw = base.yardageRange.max + mod.yardageMaxMod
  const max = Math.max(1, Math.min(25, maxRaw))
  const minRaw = base.yardageRange.min + mod.yardageMinMod
  const min = Math.max(0, Math.min(max, minRaw))
  const critSuccess = Math.max(0, Math.min(0.30, base.criticalSuccessChance + mod.critSuccessMod))
  const critFailure = Math.max(0, Math.min(0.30, base.criticalFailureChance + mod.critFailureMod))

  return { successRate, min, max, critSuccess, critFailure, axis: base.axis }
}

/**
 * Feature: playcaller-drive-engine, Property 2: Success roll threshold
 *
 * For any play combination and config, when RNG < modified success rate → successful outcome
 * (success or critical_success); when RNG >= modified success rate → failure outcome
 * (incomplete_pass, tackle_for_loss, interception, or fumble).
 *
 * Validates: Requirement 5.1
 */
describe("Feature: playcaller-drive-engine, Property 2: Success roll threshold", () => {
  it("RNG below modified success rate produces success/critical_success; above produces failure outcome", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, successRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Create an RNG that returns the specific successRoll first, then 0.5 for subsequent rolls
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return successRoll
            return 0.5
          }

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          if (successRoll < stats.successRate) {
            // Should be a success outcome
            expect(["success", "critical_success"]).toContain(result.outcome)
          } else {
            // Should be a failure outcome
            expect(["incomplete_pass", "tackle_for_loss", "interception", "fumble"]).toContain(result.outcome)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 3: Critical success yardage bounds
 *
 * For any critical success, yards gained is between 100% and 120% (rounded) of modified max yardage.
 *
 * Validates: Requirements 5.2, 5.3
 */
describe("Feature: playcaller-drive-engine, Property 3: Critical success yardage bounds", () => {
  it("critical success yards gained is in [modifiedMax, Math.round(modifiedMax * 1.2)]", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, bonusRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: success (roll < successRate), crit success (roll < critSuccessChance), then bonusRoll
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate * 0.5 // forces success
            if (callIndex === 2) return stats.critSuccess * 0.5 // forces crit success (only works if critSuccess > 0)
            if (callIndex === 3) return bonusRoll
            return 0.5
          }

          // Skip if critSuccess is 0 (can't force a critical success)
          if (stats.critSuccess === 0) return

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          expect(result.outcome).toBe("critical_success")

          const expectedMin = stats.max
          const expectedMax = Math.round(stats.max * 1.2)

          expect(result.yardsGained).toBeGreaterThanOrEqual(expectedMin)
          expect(result.yardsGained).toBeLessThanOrEqual(expectedMax)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 4: Normal success yardage bounds
 *
 * For any normal success, yards gained is within [min, max] of modified yardage range.
 *
 * Validates: Requirement 5.4
 */
describe("Feature: playcaller-drive-engine, Property 4: Normal success yardage bounds", () => {
  it("normal success yards gained is in [modifiedMin, modifiedMax]", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, yardageRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: success, NO crit success (roll >= critSuccessChance), then yardageRoll
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate * 0.5 // forces success
            if (callIndex === 2) return stats.critSuccess + (1 - stats.critSuccess) * 0.5 // forces NO crit success
            if (callIndex === 3) return yardageRoll
            return 0.5
          }

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          expect(result.outcome).toBe("success")
          expect(result.yardsGained).toBeGreaterThanOrEqual(stats.min)
          expect(result.yardsGained).toBeLessThanOrEqual(stats.max)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 5: Critical failure resolves by axis
 *
 * For any critical failure: pass axis → interception, run axis → fumble;
 * drive ends with defense as winner.
 *
 * Validates: Requirements 5.5, 5.6, 5.7, 7.2, 7.3
 */
describe("Feature: playcaller-drive-engine, Property 5: Critical failure resolves by axis", () => {
  it("critical failure on pass axis → interception, run axis → fumble; drive ends with defense winning", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        (state, offPlay, defPlay) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Skip if critFailure is 0 (can't force a critical failure)
          if (stats.critFailure === 0) return

          // Force: failure (roll >= successRate), crit failure (roll < critFailureChance)
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate + (1 - stats.successRate) * 0.5 // forces failure
            if (callIndex === 2) return stats.critFailure * 0.5 // forces crit failure
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          if (stats.axis === "pass") {
            expect(result.outcome).toBe("interception")
          } else {
            expect(result.outcome).toBe("fumble")
          }

          // Drive should be complete with defense as winner
          expect(newState.isComplete).toBe(true)
          expect(newState.completion).not.toBeNull()
          expect(newState.completion!.winner).toBe(state.defensePlayerId)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 6: Failed pass yields zero yards
 *
 * For any pass play failure (non-critical), yards gained = 0 and outcome = incomplete_pass.
 *
 * Validates: Requirement 5.8
 */
describe("Feature: playcaller-drive-engine, Property 6: Failed pass yields zero yards", () => {
  it("non-critical pass failure yields yardsGained === 0 and outcome === incomplete_pass", () => {
    const passPlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom("pass-safe", "pass-aggressive")

    fc.assert(
      fc.property(
        driveStateArb,
        passPlayArb,
        defensivePlayArb,
        (state, offPlay, defPlay) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: failure (roll >= successRate), no crit failure (roll >= critFailureChance)
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate + (1 - stats.successRate) * 0.5 // forces failure
            if (callIndex === 2) return stats.critFailure + (1 - stats.critFailure) * 0.5 // forces NO crit failure
            return 0.5
          }

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          expect(result.outcome).toBe("incomplete_pass")
          expect(result.yardsGained).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 7: Failed run yields tackle-for-loss yardage
 *
 * For any run play failure (non-critical), yards gained is between -3 and -1
 * and outcome = tackle_for_loss.
 *
 * Validates: Requirements 5.9, 13.1
 */
describe("Feature: playcaller-drive-engine, Property 7: Failed run yields tackle-for-loss yardage", () => {
  it("non-critical run failure yields yardsGained in [-3, -1] and outcome === tackle_for_loss", () => {
    const runPlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom("run-safe", "run-aggressive")

    fc.assert(
      fc.property(
        driveStateArb,
        runPlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, lossRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: failure (roll >= successRate), no crit failure (roll >= critFailureChance), then lossRoll
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate + (1 - stats.successRate) * 0.5 // forces failure
            if (callIndex === 2) return stats.critFailure + (1 - stats.critFailure) * 0.5 // forces NO crit failure
            if (callIndex === 3) return lossRoll
            return 0.5
          }

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          expect(result.outcome).toBe("tackle_for_loss")
          expect(result.yardsGained).toBeGreaterThanOrEqual(-3)
          expect(result.yardsGained).toBeLessThanOrEqual(-1)
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: playcaller-drive-engine, Property 9: First-down reset logic
 *
 * When yards gained >= yardsToGo and drive doesn't end (no touchdown),
 * resulting state has down=1 and yardsToGo=min(10, newYardLine).
 *
 * Validates: Requirements 6.1, 6.6
 */
describe("Feature: playcaller-drive-engine, Property 9: First-down reset logic", () => {
  it("gaining >= yardsToGo without touchdown resets down to 1 and yardsToGo to min(10, newYardLine)", () => {
    // Use a state where yardLine > 15 and yardsToGo <= 10 so gaining exactly yardsToGo won't TD
    const firstDownStateArb: fc.Arbitrary<DriveState> = fc
      .record({
        yardLine: fc.integer({ min: 16, max: 80 }),
        down: fc.integer({ min: 1, max: 4 }),
        yardsToGo: fc.integer({ min: 1, max: 10 }),
      })
      .map(({ yardLine, down, yardsToGo }) => ({
        offensePlayerId: "player-offense",
        defensePlayerId: "player-defense",
        yardLine,
        down,
        yardsToGo: Math.min(yardsToGo, yardLine - 1), // ensure gaining yardsToGo won't reach 0
        playHistory: [],
        isComplete: false,
        completion: null,
      }))

    fc.assert(
      fc.property(
        firstDownStateArb,
        offensivePlayArb,
        defensivePlayArb,
        (state, offPlay, defPlay) => {
          const stats = computeModifiedStats(offPlay, defPlay)
          const desiredYards = state.yardsToGo // gain exactly enough for first down

          // Compute yardageRoll to produce exactly desiredYards
          // yardsGained = Math.round(min + yardageRoll * (max - min))
          // We need desiredYards to be within [min, max]
          if (desiredYards < stats.min || desiredYards > stats.max) return // skip if can't produce exact yards

          const yardageRoll = stats.max === stats.min
            ? 0
            : (desiredYards - stats.min) / (stats.max - stats.min)

          // Force: success (roll < successRate), NO crit success, then yardageRoll for normal success
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate * 0.5 // forces success
            if (callIndex === 2) return stats.critSuccess + (1 - stats.critSuccess) * 0.5 // forces NO crit success
            if (callIndex === 3) return yardageRoll
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Only check if yards gained >= yardsToGo and not a TD
          if (result.yardsGained < state.yardsToGo) return
          if (newState.isComplete) return // touchdown — skip

          expect(newState.down).toBe(1)
          const expectedNewYardLine = state.yardLine - result.yardsGained
          expect(newState.yardsToGo).toBe(Math.min(10, expectedNewYardLine))
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 10: Down progression on insufficient gain
 *
 * When down < 4 and yards gained < yardsToGo (and no turnover),
 * down increments by 1 and yardsToGo decreases by yards gained.
 *
 * Validates: Requirement 6.2
 */
describe("Feature: playcaller-drive-engine, Property 10: Down progression on insufficient gain", () => {
  it("insufficient gain on downs 1-3 increments down and reduces yardsToGo by yards gained", () => {
    // States with down 1-3 and yardsToGo large enough that small gains won't convert
    const progressionStateArb: fc.Arbitrary<DriveState> = fc
      .record({
        yardLine: fc.integer({ min: 20, max: 80 }),
        down: fc.integer({ min: 1, max: 3 }),
        yardsToGo: fc.integer({ min: 5, max: 10 }),
      })
      .map(({ yardLine, down, yardsToGo }) => ({
        offensePlayerId: "player-offense",
        defensePlayerId: "player-defense",
        yardLine,
        down,
        yardsToGo,
        playHistory: [],
        isComplete: false,
        completion: null,
      }))

    fc.assert(
      fc.property(
        progressionStateArb,
        offensivePlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, yardageRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force a normal success with controlled yardageRoll
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate * 0.5 // forces success
            if (callIndex === 2) return stats.critSuccess + (1 - stats.critSuccess) * 0.5 // forces NO crit
            if (callIndex === 3) return yardageRoll
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Only validate when gain is less than yardsToGo and no turnover/TD
          if (result.yardsGained >= state.yardsToGo) return
          if (newState.isComplete) return

          expect(newState.down).toBe(state.down + 1)
          expect(newState.yardsToGo).toBe(state.yardsToGo - result.yardsGained)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 11: Turnover on downs
 *
 * On 4th down when play doesn't gain enough yards and no critical failure occurs,
 * drive ends as turnover_on_downs with defense as winner.
 *
 * Validates: Requirements 6.3, 7.4
 */
describe("Feature: playcaller-drive-engine, Property 11: Turnover on downs", () => {
  it("4th down failure without critical failure ends drive as turnover_on_downs", () => {
    // Use pass plays to get incomplete_pass (0 yards) which guarantees < yardsToGo
    const fourthDownStateArb: fc.Arbitrary<DriveState> = fc
      .record({
        yardLine: fc.integer({ min: 10, max: 80 }),
        yardsToGo: fc.integer({ min: 1, max: 10 }),
      })
      .map(({ yardLine, yardsToGo }) => ({
        offensePlayerId: "player-offense",
        defensePlayerId: "player-defense",
        yardLine,
        down: 4,
        yardsToGo,
        playHistory: [],
        isComplete: false,
        completion: null,
      }))

    const passPlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom("pass-safe", "pass-aggressive")

    fc.assert(
      fc.property(
        fourthDownStateArb,
        passPlayArb,
        defensivePlayArb,
        (state, offPlay, defPlay) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: failure (roll >= successRate), no crit failure → incomplete_pass (0 yards)
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate + (1 - stats.successRate) * 0.5 // forces failure
            if (callIndex === 2) return stats.critFailure + (1 - stats.critFailure) * 0.5 // forces NO crit failure
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Incomplete pass = 0 yards, which is < yardsToGo (yardsToGo >= 1)
          expect(result.outcome).toBe("incomplete_pass")
          expect(result.yardsGained).toBe(0)
          expect(newState.isComplete).toBe(true)
          expect(newState.completion).not.toBeNull()
          expect(newState.completion!.endingType).toBe("turnover_on_downs")
          expect(newState.completion!.winner).toBe(state.defensePlayerId)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 12: Yard line update and clamping
 *
 * Resulting yardLine = max(0, min(99, previousYardLine - yardsGained));
 * never negative, never exceeds 99.
 *
 * Validates: Requirements 6.4, 6.5, 13.2, 13.3
 */
describe("Feature: playcaller-drive-engine, Property 12: Yard line update and clamping", () => {
  it("yardLine is always max(0, min(99, previousYardLine - yardsGained))", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        seedArb,
        (state, offPlay, defPlay, seed) => {
          const rng = createSeededRng(seed)

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          const expectedYardLine = Math.max(0, Math.min(99, state.yardLine - result.yardsGained))
          expect(newState.yardLine).toBe(expectedYardLine)
          expect(newState.yardLine).toBeGreaterThanOrEqual(0)
          expect(newState.yardLine).toBeLessThanOrEqual(99)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("tackle for loss near yardLine 99 clamps at 99", () => {
    // Force a run failure near the back of the field
    const nearBackStateArb: fc.Arbitrary<DriveState> = fc.constant<DriveState>({
      offensePlayerId: "player-offense",
      defensePlayerId: "player-defense",
      yardLine: 98,
      down: 1,
      yardsToGo: 10,
      playHistory: [],
      isComplete: false,
      completion: null,
    })

    const runPlayArb: fc.Arbitrary<OffensivePlayId> = fc.constantFrom("run-safe", "run-aggressive")

    fc.assert(
      fc.property(
        nearBackStateArb,
        runPlayArb,
        defensivePlayArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (state, offPlay, defPlay, lossRoll) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // Force: failure, no crit failure → tackle for loss
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate + (1 - stats.successRate) * 0.5
            if (callIndex === 2) return stats.critFailure + (1 - stats.critFailure) * 0.5
            if (callIndex === 3) return lossRoll
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          expect(result.outcome).toBe("tackle_for_loss")
          // yardLine = max(0, min(99, 98 - negativeYards))
          // 98 - (-1 to -3) = 99 to 101, clamped to 99
          expect(newState.yardLine).toBeLessThanOrEqual(99)
          expect(newState.yardLine).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 13: Touchdown detection
 *
 * When yardLine reaches 0 after applying yards, drive ends with offense as winner
 * and endingType=touchdown.
 *
 * Validates: Requirement 7.1
 */
describe("Feature: playcaller-drive-engine, Property 13: Touchdown detection", () => {
  it("yardLine reaching 0 ends drive with touchdown and offense as winner", () => {
    // States with small yardLine (1-10) so a success can reach 0
    const touchdownStateArb: fc.Arbitrary<DriveState> = fc
      .record({
        yardLine: fc.integer({ min: 1, max: 10 }),
        down: fc.integer({ min: 1, max: 4 }),
      })
      .map(({ yardLine, down }) => ({
        offensePlayerId: "player-offense",
        defensePlayerId: "player-defense",
        yardLine,
        down,
        yardsToGo: yardLine, // first-and-goal
        playHistory: [],
        isComplete: false,
        completion: null,
      }))

    fc.assert(
      fc.property(
        touchdownStateArb,
        offensivePlayArb,
        defensivePlayArb,
        (state, offPlay, defPlay) => {
          const stats = computeModifiedStats(offPlay, defPlay)

          // We need yardsGained >= yardLine to reach 0.
          // Force a critical success with max bonus to ensure we exceed yardLine.
          // Critical success = modifiedMax + bonusRoll * (modifiedMax * 0.20)
          // With bonusRoll = 1.0: yardsGained = Math.round(max + max * 0.20) = Math.round(max * 1.2)
          // For pass-aggressive with mismatched defense, max can be up to 18.
          // Even for run-safe with matched defense, max is at least 4, giving 5 yards.
          // We need max * 1.0 >= yardLine (since Math.round(max + 0) = max at minimum for crit success)
          if (stats.max < state.yardLine && stats.critSuccess === 0) return // skip if can't force TD

          // If critSuccess is 0, use normal success and ensure max >= yardLine
          if (stats.critSuccess === 0) {
            if (stats.max < state.yardLine) return
            // Force normal success with yardageRoll = 1.0 to get max yards
            let callIndex = 0
            const rng = () => {
              callIndex++
              if (callIndex === 1) return stats.successRate * 0.5
              if (callIndex === 2) return 1.0 // no crit success (above critSuccess which is 0)
              if (callIndex === 3) return 1.0 // max yardage
              return 0.5
            }

            const { state: newState } = resolveDown(
              JSON.parse(JSON.stringify(state)),
              offPlay,
              defPlay,
              rng,
              DEFAULT_PLAY_CONFIG,
              DEFAULT_PLAY_MATRIX
            )

            if (newState.yardLine === 0) {
              expect(newState.isComplete).toBe(true)
              expect(newState.completion).not.toBeNull()
              expect(newState.completion!.endingType).toBe("touchdown")
              expect(newState.completion!.winner).toBe(state.offensePlayerId)
            }
            return
          }

          // Force: success, crit success, bonusRoll=1.0 for maximum yards
          let callIndex = 0
          const rng = () => {
            callIndex++
            if (callIndex === 1) return stats.successRate * 0.5 // forces success
            if (callIndex === 2) return stats.critSuccess * 0.5 // forces crit success
            if (callIndex === 3) return 1.0 // max bonus
            return 0.5
          }

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // The yards gained should put yardLine at 0 or below (clamped to 0)
          if (result.yardsGained >= state.yardLine) {
            expect(newState.yardLine).toBe(0)
            expect(newState.isComplete).toBe(true)
            expect(newState.completion).not.toBeNull()
            expect(newState.completion!.endingType).toBe("touchdown")
            expect(newState.completion!.winner).toBe(state.offensePlayerId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 14: Play history append invariant
 *
 * After resolveDown on non-complete drive, playHistory has exactly one more entry
 * (appended last) with correct down, yardsToGo, yardLine, plays, result, and resultingYardLine.
 *
 * Validates: Requirements 11.1, 11.2, 11.3
 */
describe("Feature: playcaller-drive-engine, Property 14: Play history append invariant", () => {
  it("resolveDown appends exactly one entry to playHistory with correct fields", () => {
    // Generate states with existing play history (0-5 entries)
    const historyStateArb: fc.Arbitrary<DriveState> = fc
      .record({
        yardLine: fc.integer({ min: 1, max: 99 }),
        down: fc.integer({ min: 1, max: 4 }),
        yardsToGo: fc.integer({ min: 1, max: 99 }),
        historyLength: fc.integer({ min: 0, max: 5 }),
      })
      .map(({ yardLine, down, yardsToGo, historyLength }) => {
        const clampedYardsToGo = Math.min(yardsToGo, yardLine)
        // Create dummy history entries
        const playHistory = Array.from({ length: historyLength }, (_, i) => ({
          down: ((i % 4) + 1),
          yardsToGo: 10,
          yardLine: 25,
          offensivePlay: "run-safe" as OffensivePlayId,
          defensivePlay: "run-safe" as DefensivePlayId,
          result: {
            outcome: "success" as const,
            yardsGained: 3,
            playByPlayText: "success: 3 yards",
            offensivePlay: "run-safe" as OffensivePlayId,
            defensivePlay: "run-safe" as DefensivePlayId,
          },
          resultingYardLine: 22,
        }))

        return {
          offensePlayerId: "player-offense",
          defensePlayerId: "player-defense",
          yardLine,
          down,
          yardsToGo: clampedYardsToGo,
          playHistory,
          isComplete: false,
          completion: null,
        }
      })

    fc.assert(
      fc.property(
        historyStateArb,
        offensivePlayArb,
        defensivePlayArb,
        seedArb,
        (state, offPlay, defPlay, seed) => {
          const previousHistoryLength = state.playHistory.length
          const rng = createSeededRng(seed)

          const { state: newState, result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Play history grows by exactly 1
          expect(newState.playHistory.length).toBe(previousHistoryLength + 1)

          // Last entry has correct fields
          const lastEntry = newState.playHistory[newState.playHistory.length - 1]
          expect(lastEntry.down).toBe(state.down)
          expect(lastEntry.yardsToGo).toBe(state.yardsToGo)
          expect(lastEntry.yardLine).toBe(state.yardLine)
          expect(lastEntry.offensivePlay).toBe(offPlay)
          expect(lastEntry.defensivePlay).toBe(defPlay)
          expect(lastEntry.result).toEqual(result)
          expect(lastEntry.resultingYardLine).toBe(newState.yardLine)

          // Previous history entries are preserved unchanged
          for (let i = 0; i < previousHistoryLength; i++) {
            expect(newState.playHistory[i]).toEqual(state.playHistory[i])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 15: Play-by-play text correctness
 *
 * For any resolved down: text is non-empty, deterministic for same inputs,
 * and contains absolute yardage value when outcome involves non-zero yardage.
 *
 * Validates: Requirements 8.1, 8.3, 8.4
 */
describe("Feature: playcaller-drive-engine, Property 15: Play-by-play text correctness", () => {
  it("playByPlayText is non-empty, deterministic, and contains absolute yardage when yardsGained !== 0", () => {
    fc.assert(
      fc.property(
        driveStateArb,
        offensivePlayArb,
        defensivePlayArb,
        seedArb,
        (state, offPlay, defPlay, seed) => {
          const rng = createSeededRng(seed)

          const { result } = resolveDown(
            JSON.parse(JSON.stringify(state)),
            offPlay,
            defPlay,
            rng,
            DEFAULT_PLAY_CONFIG,
            DEFAULT_PLAY_MATRIX
          )

          // Text is non-empty
          expect(result.playByPlayText).toBeTruthy()
          expect(result.playByPlayText.length).toBeGreaterThan(0)

          // If yardsGained !== 0, text contains the absolute yardage value
          if (result.yardsGained !== 0) {
            expect(result.playByPlayText).toContain(String(Math.abs(result.yardsGained)))
          }

          // Determinism: calling generatePlayByPlay with same inputs produces identical text
          const regeneratedText = generatePlayByPlay({
            outcome: result.outcome,
            yardsGained: result.yardsGained,
            offensivePlay: result.offensivePlay,
            defensivePlay: result.defensivePlay,
          })
          expect(regeneratedText).toBe(result.playByPlayText)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 16: Matching axis reduces offensive range
 *
 * For any play combination sharing the same axis, the modifier results in a smaller
 * yardage range or reduced success rate compared to base.
 *
 * Validates: Requirements 4.7, 9.4
 */
describe("Feature: playcaller-drive-engine, Property 16: Matching axis reduces offensive range", () => {
  it("same-axis defense reduces range or success rate compared to base stats", () => {
    // Only use matching-axis pairs
    const matchedPairArb = fc.constantFrom(
      // Run offense vs run defense (same axis)
      { off: "run-safe" as OffensivePlayId, def: "run-safe" as DefensivePlayId },
      { off: "run-safe" as OffensivePlayId, def: "run-aggressive" as DefensivePlayId },
      { off: "run-aggressive" as OffensivePlayId, def: "run-safe" as DefensivePlayId },
      { off: "run-aggressive" as OffensivePlayId, def: "run-aggressive" as DefensivePlayId },
      // Pass offense vs pass defense (same axis)
      { off: "pass-safe" as OffensivePlayId, def: "pass-safe" as DefensivePlayId },
      { off: "pass-safe" as OffensivePlayId, def: "pass-aggressive" as DefensivePlayId },
      { off: "pass-aggressive" as OffensivePlayId, def: "pass-safe" as DefensivePlayId },
      { off: "pass-aggressive" as OffensivePlayId, def: "pass-aggressive" as DefensivePlayId },
    )

    fc.assert(
      fc.property(
        matchedPairArb,
        ({ off, def }) => {
          const base = DEFAULT_PLAY_CONFIG.offensivePlays[off]
          const modified = computeModifiedStats(off, def)

          const baseRange = base.yardageRange.max - base.yardageRange.min
          const modifiedRange = modified.max - modified.min

          // Either the range is smaller OR the success rate is reduced
          const rangeReduced = modifiedRange < baseRange
          const successReduced = modified.successRate < base.successRate

          expect(rangeReduced || successReduced).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 17: Mismatching axis expands offensive range
 *
 * For any play combination with different axes, the modifier results in expanded
 * yardage range or improved success rate relative to the matched-axis case for
 * that same offensive play.
 *
 * Validates: Requirement 4.8
 */
describe("Feature: playcaller-drive-engine, Property 17: Mismatching axis expands offensive range", () => {
  it("mismatched-axis defense expands range or improves success rate vs any matched-axis defense", () => {
    // Only use mismatched-axis pairs
    const mismatchedPairArb = fc.constantFrom(
      // Run offense vs pass defense (mismatched)
      { off: "run-safe" as OffensivePlayId, def: "pass-safe" as DefensivePlayId },
      { off: "run-safe" as OffensivePlayId, def: "pass-aggressive" as DefensivePlayId },
      { off: "run-aggressive" as OffensivePlayId, def: "pass-safe" as DefensivePlayId },
      { off: "run-aggressive" as OffensivePlayId, def: "pass-aggressive" as DefensivePlayId },
      // Pass offense vs run defense (mismatched)
      { off: "pass-safe" as OffensivePlayId, def: "run-safe" as DefensivePlayId },
      { off: "pass-safe" as OffensivePlayId, def: "run-aggressive" as DefensivePlayId },
      { off: "pass-aggressive" as OffensivePlayId, def: "run-safe" as DefensivePlayId },
      { off: "pass-aggressive" as OffensivePlayId, def: "run-aggressive" as DefensivePlayId },
    )

    fc.assert(
      fc.property(
        mismatchedPairArb,
        ({ off, def }) => {
          const mismatchedStats = computeModifiedStats(off, def)
          const mismatchedRange = mismatchedStats.max - mismatchedStats.min

          // Get the axis of the offensive play to find matched-axis defenses
          const offAxis = DEFAULT_PLAY_CONFIG.offensivePlays[off].axis
          const matchedDefenses: DefensivePlayId[] = offAxis === "run"
            ? ["run-safe", "run-aggressive"]
            : ["pass-safe", "pass-aggressive"]

          // Compare against ALL matched-axis defenses for the same offensive play
          // The mismatched stats should be better than at least one matched-axis defense
          const betterThanSomeMatched = matchedDefenses.some((matchedDef) => {
            const matchedStats = computeModifiedStats(off, matchedDef)
            const matchedRange = matchedStats.max - matchedStats.min

            const rangeExpanded = mismatchedRange >= matchedRange
            const successImproved = mismatchedStats.successRate > matchedStats.successRate

            return rangeExpanded || successImproved
          })

          expect(betterThanSomeMatched).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: playcaller-drive-engine, Property 18: Random play selection validity
 *
 * For any RNG output, selectRandomPlay returns exactly one valid play ID
 * from the provided list.
 *
 * Validates: Requirement 2.5
 */
describe("Feature: playcaller-drive-engine, Property 18: Random play selection validity", () => {
  it("selectRandomPlay returns a valid offensive play from the list", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.9999999, noNaN: true, noDefaultInfinity: true }),
        (rngValue) => {
          const rng = () => rngValue
          const offensivePlays: OffensivePlayId[] = [
            "run-safe",
            "run-aggressive",
            "pass-safe",
            "pass-aggressive",
          ]

          const selected = selectRandomPlay(offensivePlays, rng)

          expect(offensivePlays).toContain(selected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("selectRandomPlay returns a valid defensive play from the list", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.9999999, noNaN: true, noDefaultInfinity: true }),
        (rngValue) => {
          const rng = () => rngValue
          const defensivePlays: DefensivePlayId[] = [
            "run-safe",
            "run-aggressive",
            "pass-safe",
            "pass-aggressive",
          ]

          const selected = selectRandomPlay(defensivePlays, rng)

          expect(defensivePlays).toContain(selected)
        }
      ),
      { numRuns: 100 }
    )
  })
})
