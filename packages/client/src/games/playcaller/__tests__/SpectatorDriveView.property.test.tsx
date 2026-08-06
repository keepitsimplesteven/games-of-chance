import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { render, screen } from "@testing-library/react"
import { SpectatorDriveView } from "../SpectatorDriveView"
import type { DriveState, PlayHistoryEntry, PlayResult, PlayOutcome, OffensivePlayId, DefensivePlayId } from "../field-utils.types"

/**
 * Property 11: Spectators cannot see or interact with play cards
 *
 * For any spectator viewing any matchup, the play card grid SHALL not be
 * rendered, ensuring zero play card elements are present in the spectator
 * drive view.
 *
 * **Validates: Requirements 9.3**
 */

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

const arbDriveState: fc.Arbitrary<DriveState> = fc.record({
  offensePlayerId: fc.string({ minLength: 1, maxLength: 20 }),
  defensePlayerId: fc.string({ minLength: 1, maxLength: 20 }),
  yardLine: fc.integer({ min: 1, max: 35 }),
  down: fc.integer({ min: 1, max: 4 }),
  yardsToGo: fc.integer({ min: 1, max: 35 }),
  playHistory: fc.array(arbPlayHistoryEntry, { minLength: 0, maxLength: 8 }),
  isComplete: fc.boolean(),
  completion: fc.constant(null),
})

// ── Property Tests ──────────────────────────────────────────────────────────

describe("Property 11: Spectators cannot see or interact with play cards", () => {
  it("renders zero play card elements (no buttons with 'Select play:*' aria-label) for any DriveState", () => {
    fc.assert(
      fc.property(arbDriveState, (driveState) => {
        const { unmount } = render(
          <SpectatorDriveView driveState={driveState} onBack={() => {}} />
        )

        // PlayCard components use aria-label="Select play: {name}" pattern
        const playCardButtons = screen.queryAllByRole("button", {
          name: /^Select play:/i,
        })
        expect(playCardButtons).toHaveLength(0)

        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it("does not render any PlayCardGrid-related markup for any DriveState", () => {
    fc.assert(
      fc.property(arbDriveState, (driveState) => {
        const { container, unmount } = render(
          <SpectatorDriveView driveState={driveState} onBack={() => {}} />
        )

        // PlayCardGrid renders a 2x2 grid with data-testid="play-card-grid"
        const grid = container.querySelector("[data-testid='play-card-grid']")
        expect(grid).toBeNull()

        // Also verify no individual play cards exist
        const playCards = container.querySelectorAll("[data-testid='play-card']")
        expect(playCards).toHaveLength(0)

        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it("the only interactive button is the back button for any DriveState", () => {
    fc.assert(
      fc.property(arbDriveState, (driveState) => {
        const { unmount } = render(
          <SpectatorDriveView driveState={driveState} onBack={() => {}} />
        )

        // The back button should be the only button without play-selection semantics
        const backButton = screen.queryByLabelText("Back to matchup grid")
        expect(backButton).not.toBeNull()

        // No play selection buttons should exist
        const allButtons = screen.queryAllByRole("button")
        const playSelectionButtons = allButtons.filter((btn) =>
          btn.getAttribute("aria-label")?.startsWith("Select play:")
        )
        expect(playSelectionButtons).toHaveLength(0)

        unmount()
      }),
      { numRuns: 100 }
    )
  })
})
