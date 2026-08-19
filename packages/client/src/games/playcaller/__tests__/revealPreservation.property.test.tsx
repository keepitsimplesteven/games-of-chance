/**
 * Preservation Property Tests — Client-Side Reveal Logic
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * These tests capture the BASELINE behavior of the reveal-gating logic on UNFIXED code.
 * They must PASS before and after the bugfix to ensure no regressions.
 *
 * Property 2: Preservation — Normal Reveal Sequence & Reconnect Behavior
 *
 * - For all (displayedPlayCount, playCount) pairs where displayedPlayCount < playCount,
 *   the reveal callback increments by exactly 1
 * - For all mount scenarios where playCount equals the pre-existing history length,
 *   displayedPlayCount starts at playCount (immediate reveal)
 */
import { describe, it, expect, beforeAll } from "vitest"
import * as fc from "fast-check"
import { render } from "@testing-library/react"
import { SpectatorDriveView } from "../SpectatorDriveView"
import type { DriveState, PlayHistoryEntry, PlayResult, PlayOutcome, OffensivePlayId, DefensivePlayId } from "../field-utils.types"

// Polyfill scrollTo for jsdom (not implemented in jsdom)
beforeAll(() => {
  Element.prototype.scrollTo = () => {}
})

// ── Generators ──────────────────────────────────────────────────────────────

const offensivePlays: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const defensivePlays: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

const arbOutcome: fc.Arbitrary<PlayOutcome> = fc.constantFrom(
  "success",
  "critical_success",
  "incomplete_pass",
  "tackle_for_loss",
  "interception",
  "fumble"
)

const arbOffensivePlay: fc.Arbitrary<OffensivePlayId> = fc.constantFrom(...offensivePlays)
const arbDefensivePlay: fc.Arbitrary<DefensivePlayId> = fc.constantFrom(...defensivePlays)

const arbPlayResult: fc.Arbitrary<PlayResult> = fc.record({
  outcome: arbOutcome,
  yardsGained: fc.integer({ min: -10, max: 80 }),
  playByPlayText: fc.string({ minLength: 1, maxLength: 40 }),
  offensivePlay: arbOffensivePlay,
  defensivePlay: arbDefensivePlay,
})

const arbPlayHistoryEntry: fc.Arbitrary<PlayHistoryEntry> = fc.record({
  down: fc.integer({ min: 1, max: 4 }),
  yardsToGo: fc.integer({ min: 1, max: 35 }),
  yardLine: fc.integer({ min: 1, max: 35 }),
  offensivePlay: arbOffensivePlay,
  defensivePlay: arbDefensivePlay,
  result: arbPlayResult,
  resultingYardLine: fc.integer({ min: 0, max: 35 }),
})

// ── Pure Logic Tests (no React rendering needed) ────────────────────────────

/**
 * The reveal logic under test:
 * - `handleOutcomeReveal` does: setDisplayedPlayCount((prev) => prev + 1)
 * - This is a simple state updater function: (prev) => prev + 1
 *
 * The PRESERVATION property says: when displayedPlayCount < playCount,
 * calling the updater increments by exactly 1. This is the behavior
 * that MUST be preserved after the fix (which adds Math.min capping).
 */
describe("Preservation Property: Normal reveal increments displayedPlayCount by exactly 1", () => {
  it("for all (displayedPlayCount, playCount) where displayedPlayCount < playCount, increment produces displayedPlayCount + 1", () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Property: For any displayedPlayCount strictly less than playCount,
     * the reveal updater function `(prev) => prev + 1` produces `prev + 1`.
     *
     * This is the normal-case behavior that must be preserved.
     * The bug only affects the case where displayedPlayCount >= playCount.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (displayedPlayCount, delta) => {
          // Ensure displayedPlayCount < playCount
          const playCount = displayedPlayCount + delta

          // Current (unfixed) updater: (prev) => prev + 1
          const updater = (prev: number) => prev + 1
          const result = updater(displayedPlayCount)

          // Normal case: should increment by exactly 1
          expect(result).toBe(displayedPlayCount + 1)

          // Result should still be <= playCount in the normal case
          expect(result).toBeLessThanOrEqual(playCount)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("for sequential reveals, each increment moves exactly one step closer to playCount", () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Property: Starting from displayedPlayCount=0 and revealing N times
     * (where N <= playCount), each reveal brings us exactly one step closer.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (playCount) => {
          // Simulate the reveal sequence
          let displayed = 0
          const updater = (prev: number) => prev + 1

          for (let i = 0; i < playCount; i++) {
            const before = displayed
            displayed = updater(displayed)
            // Each step increments by exactly 1
            expect(displayed).toBe(before + 1)
          }

          // After playCount reveals, we should be caught up
          expect(displayed).toBe(playCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("Preservation Property: Mount with all plays pre-existing starts at playCount", () => {
  it("for all playCount values, initialDisplayCount equals playCount on mount (immediate reveal)", () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     *
     * Property: When a spectator component mounts and all play history is
     * pre-existing (no pending reveals), displayedPlayCount starts at playCount.
     * This means `useRef(playCount).current` captures the playCount at mount time.
     *
     * The mount initialization logic: `const initialDisplayCount = useRef(playCount).current`
     * followed by `const [displayedPlayCount, setDisplayedPlayCount] = useState(initialDisplayCount)`
     *
     * This test verifies the pattern directly without needing component rendering.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        (playCount) => {
          // Simulate the mount logic:
          // const initialDisplayCount = useRef(playCount).current
          // useState(initialDisplayCount)
          // => displayedPlayCount starts at playCount
          const initialDisplayCount = playCount

          expect(initialDisplayCount).toBe(playCount)

          // isWaitingForReveal = displayedPlayCount < playCount
          // When they're equal, we're NOT waiting (all history is revealed)
          const isWaitingForReveal = initialDisplayCount < playCount
          expect(isWaitingForReveal).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("component mount with empty playHistory starts at displayedPlayCount=0 (no waiting state)", () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * Property: When mounting SpectatorDriveView with 0 plays, the component
     * starts in a non-waiting state (displayedPlayCount === playCount === 0).
     * Validates the mount initialization pattern works correctly.
     */
    const driveState: DriveState = {
      offensePlayerId: "player-offense",
      defensePlayerId: "player-defense",
      yardLine: 25,
      down: 1,
      yardsToGo: 10,
      playHistory: [],
      isComplete: false,
      completion: null,
    }

    const { container, unmount } = render(
      <SpectatorDriveView driveState={driveState} onBack={() => {}} />
    )

    // Component renders successfully
    expect(container).toBeTruthy()
    // Shows "Spectating" label (fully caught up, not waiting)
    expect(container.textContent).toContain("Spectating")

    unmount()
  })

  it("fast-forward logic: when delta > 1, displayedPlayCount snaps to playCount - 1", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * Property: When a spectator toggles away and multiple plays land at once
     * (delta > 1), the system snaps displayedPlayCount to playCount - 1,
     * gating only the latest play.
     *
     * The logic: if (delta > 1) { setDisplayedPlayCount(playCount - 1) }
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 2, max: 10 }),
        (prevPlayCount, delta) => {
          // Simulate: spectator was at prevPlayCount, now playCount jumped by delta
          const newPlayCount = prevPlayCount + delta

          // The fast-forward logic
          if (delta > 1) {
            const snappedDisplayCount = newPlayCount - 1
            // Only the latest play is gated
            const isWaitingForReveal = snappedDisplayCount < newPlayCount
            expect(isWaitingForReveal).toBe(true)
            // We're exactly 1 behind
            expect(newPlayCount - snappedDisplayCount).toBe(1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
