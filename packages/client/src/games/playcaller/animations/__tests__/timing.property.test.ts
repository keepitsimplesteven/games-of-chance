/**
 * Feature: playcaller-ui, Property 3: Animation variant selection is determined by play outcome and axis
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  getBallAnimationType,
  getAnimationDuration,
  getDramaLevel,
  type PlayOutcome,
} from "../timing"
import type { DramaLevel } from "../types"

const allOutcomes: PlayOutcome[] = [
  "success",
  "critical_success",
  "incomplete_pass",
  "tackle_for_loss",
  "interception",
  "fumble",
]

const turnoverOutcomes: PlayOutcome[] = ["interception", "fumble"]
const nonTurnoverOutcomes: PlayOutcome[] = [
  "success",
  "critical_success",
  "incomplete_pass",
  "tackle_for_loss",
]

const allDramaLevels: DramaLevel[] = ["normal", "high", "critical"]
const allAxes: Array<"run" | "pass"> = ["run", "pass"]

const arbOutcome = fc.constantFrom(...allOutcomes)
const arbTurnoverOutcome = fc.constantFrom(...turnoverOutcomes)
const arbNonTurnoverOutcome = fc.constantFrom(...nonTurnoverOutcomes)
const arbAxis = fc.constantFrom(...allAxes)
const arbDramaLevel = fc.constantFrom(...allDramaLevels)

describe("Property 3: Animation variant selection is determined by play outcome and axis", () => {
  it("getBallAnimationType returns 'turnover' for interception/fumble regardless of axis", () => {
    fc.assert(
      fc.property(arbTurnoverOutcome, arbAxis, (outcome, axis) => {
        expect(getBallAnimationType(outcome, axis)).toBe("turnover")
      }),
      { numRuns: 100 }
    )
  })

  it("getBallAnimationType returns 'pass' for non-turnover outcomes with pass axis", () => {
    fc.assert(
      fc.property(arbNonTurnoverOutcome, (outcome) => {
        expect(getBallAnimationType(outcome, "pass")).toBe("pass")
      }),
      { numRuns: 100 }
    )
  })

  it("getBallAnimationType returns 'run' for non-turnover outcomes with run axis", () => {
    fc.assert(
      fc.property(arbNonTurnoverOutcome, (outcome) => {
        expect(getBallAnimationType(outcome, "run")).toBe("run")
      }),
      { numRuns: 100 }
    )
  })

  it("getAnimationDuration always returns a positive number for all valid DramaLevels", () => {
    fc.assert(
      fc.property(arbDramaLevel, (dramaLevel) => {
        const duration = getAnimationDuration(dramaLevel)
        expect(duration).toBeGreaterThan(0)
        expect(typeof duration).toBe("number")
      }),
      { numRuns: 100 }
    )
  })

  it("getDramaLevel maps each outcome to a consistent DramaLevel", () => {
    fc.assert(
      fc.property(arbOutcome, (outcome) => {
        const level = getDramaLevel(outcome)
        expect(allDramaLevels).toContain(level)
        // Consistency: calling again yields the same result
        expect(getDramaLevel(outcome)).toBe(level)
      }),
      { numRuns: 100 }
    )
  })
})
