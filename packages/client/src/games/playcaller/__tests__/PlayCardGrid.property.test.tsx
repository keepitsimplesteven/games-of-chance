import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import { render, screen, fireEvent } from "@testing-library/react"
import { PlayCardGrid } from "../PlayCardGrid"
import { useGameStore } from "../../../store/useGameStore"
import type { PlayCardData } from "../hooks/usePlayCards"
import type { PlayArtData } from "../play-art/types"

/**
 * Property 6: Lock-in disables further play selection
 *
 * For any UI state where pickSubmitted is true and the drive is not complete,
 * all play cards SHALL be in a non-interactive (disabled) state, preventing
 * additional submissions for the current down.
 *
 * **Validates: Requirements 6.3**
 */

// ── Generators ──────────────────────────────────────────────────────────────

/** Minimal valid PlayArtData for rendering */
const stubArtData: PlayArtData = {
  markers: [{ position: { x: 50, y: 50 }, shape: "circle" }],
  routes: [],
  lineOfScrimmage: 50,
}

/** Generate a unique play ID string */
const arbPlayId = fc.constantFrom("run-safe" as const, "run-aggressive" as const, "pass-safe" as const, "pass-aggressive" as const)

/** Generate an array of exactly 4 unique play card data objects */
const arbFourCards: fc.Arbitrary<PlayCardData[]> = fc
  .constant(["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"] as const)
  .map((ids) =>
    ids.map((id) => ({
      playId: id,
      displayName: `Play ${id}`,
      formation: `Formation ${id}`,
      artData: stubArtData,
    }))
  )

/** Given 4 cards, pick an index (0-3) representing which card was selected */
const arbSelectedIndex = fc.integer({ min: 0, max: 3 })

// ── Test Setup ──────────────────────────────────────────────────────────────

function resetStore() {
  useGameStore.setState({
    playerId: "test-player",
    pickSubmitted: false,
    currentPick: null,
    _socketSend: () => {},
  })
}

// ── Property Tests ──────────────────────────────────────────────────────────

describe("Property 6: Lock-in disables further play selection", () => {
  beforeEach(() => {
    resetStore()
  })

  it("after lock-in, the selected card is marked selected and all other cards are disabled", () => {
    fc.assert(
      fc.property(arbFourCards, arbSelectedIndex, (cards, selectedIdx) => {
        resetStore()

        const { container } = render(
          <PlayCardGrid cards={cards} matchupId="test-matchup" />
        )

        // Tap the selected card to lock in
        const buttons = container.querySelectorAll("button")
        expect(buttons).toHaveLength(4)

        fireEvent.click(buttons[selectedIdx])

        // After click, pickSubmitted should be true in the store
        expect(useGameStore.getState().pickSubmitted).toBe(true)

        // Re-query buttons to get updated state
        const updatedButtons = container.querySelectorAll("button")

        for (let i = 0; i < 4; i++) {
          const button = updatedButtons[i]
          if (i === selectedIdx) {
            // Selected card should NOT be disabled
            expect(button).not.toBeDisabled()
          } else {
            // All non-selected cards should be disabled
            expect(button).toBeDisabled()
          }
        }
      }),
      { numRuns: 50 }
    )
  })

  it("when pickSubmitted is already true in store, all cards are disabled (no card can be selected)", () => {
    fc.assert(
      fc.property(arbFourCards, (cards) => {
        // Pre-set the store to pickSubmitted = true (simulating reconnection or pre-existing state)
        useGameStore.setState({ pickSubmitted: true })

        const { container } = render(
          <PlayCardGrid cards={cards} matchupId="test-matchup" />
        )

        const buttons = container.querySelectorAll("button")
        expect(buttons).toHaveLength(4)

        // When pickSubmitted is true but no local selectedPlayId was set,
        // getCardState returns "disabled" for ALL cards (none match selectedPlayId which is null)
        for (let i = 0; i < 4; i++) {
          expect(buttons[i]).toBeDisabled()
        }
      }),
      { numRuns: 50 }
    )
  })

  it("clicking a disabled card does not change the store or selection state", () => {
    fc.assert(
      fc.property(arbFourCards, arbSelectedIndex, (cards, selectedIdx) => {
        resetStore()

        const { container } = render(
          <PlayCardGrid cards={cards} matchupId="test-matchup" />
        )

        // Lock in the first card
        const buttons = container.querySelectorAll("button")
        fireEvent.click(buttons[selectedIdx])

        // Store the current pick
        const pickAfterLockIn = useGameStore.getState().currentPick

        // Try clicking a different (disabled) card
        const otherIdx = (selectedIdx + 1) % 4
        const updatedButtons = container.querySelectorAll("button")
        fireEvent.click(updatedButtons[otherIdx])

        // The pick should not have changed (lock-in prevents re-selection)
        expect(useGameStore.getState().currentPick).toEqual(pickAfterLockIn)
      }),
      { numRuns: 50 }
    )
  })
})
