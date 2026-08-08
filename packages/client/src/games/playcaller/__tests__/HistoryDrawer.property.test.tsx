import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { HistoryDrawer } from "../HistoryDrawer"
import type { PlayHistoryEntry, OffensivePlayId, DefensivePlayId, PlayOutcome } from "../field-utils.types"

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const OUTCOMES: PlayOutcome[] = ["success", "critical_success", "incomplete_pass", "tackle_for_loss", "interception", "fumble"]

/** Arbitrary for generating valid PlayHistoryEntry objects */
const arbPlayHistoryEntry: fc.Arbitrary<PlayHistoryEntry> = fc.record({
  down: fc.integer({ min: 1, max: 4 }),
  yardsToGo: fc.integer({ min: 1, max: 35 }),
  yardLine: fc.integer({ min: 1, max: 35 }),
  offensivePlay: fc.constantFrom(...OFFENSIVE_PLAYS),
  defensivePlay: fc.constantFrom(...DEFENSIVE_PLAYS),
  result: fc.record({
    outcome: fc.constantFrom(...OUTCOMES),
    yardsGained: fc.integer({ min: -5, max: 35 }),
    playByPlayText: fc.string({ minLength: 1, maxLength: 40 }),
    offensivePlay: fc.constantFrom(...OFFENSIVE_PLAYS),
    defensivePlay: fc.constantFrom(...DEFENSIVE_PLAYS),
  }),
  resultingYardLine: fc.integer({ min: 0, max: 35 }),
})

/**
 * Property 8: History drawer shows all play history entries in order
 *
 * For any DriveState with N entries in playHistory (N ≥ 0), the History_Drawer
 * SHALL render exactly N entries in chronological order (index 0 = first play,
 * index N-1 = most recent play).
 *
 * **Validates: Requirements 7.4**
 */
describe("Property 8: History drawer shows all play history entries in order", () => {
  it("renders exactly N history-entry elements for N entries when isOpen=true", () => {
    fc.assert(
      fc.property(
        fc.array(arbPlayHistoryEntry, { minLength: 0, maxLength: 20 }),
        (entries) => {
          const { unmount } = render(
            <HistoryDrawer entries={entries} isOpen={true} onClose={() => {}} />
          )

          const rendered = screen.queryAllByTestId("history-entry")
          expect(rendered.length).toBe(entries.length)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("renders entries in chronological order (index 0 first, index N-1 last)", () => {
    fc.assert(
      fc.property(
        fc.array(arbPlayHistoryEntry, { minLength: 1, maxLength: 15 }),
        (entries) => {
          const { unmount } = render(
            <HistoryDrawer entries={entries} isOpen={true} onClose={() => {}} />
          )

          const rendered = screen.getAllByTestId("history-entry")
          // Each row should contain the yard line text from the corresponding entry
          for (let i = 0; i < entries.length; i++) {
            expect(rendered[i].textContent).toContain(`${entries[i].yardLine} yd`)
          }

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("renders zero entries when isOpen=false regardless of entries count", () => {
    fc.assert(
      fc.property(
        fc.array(arbPlayHistoryEntry, { minLength: 0, maxLength: 10 }),
        (entries) => {
          const { unmount } = render(
            <HistoryDrawer entries={entries} isOpen={false} onClose={() => {}} />
          )

          const rendered = screen.queryAllByTestId("history-entry")
          expect(rendered.length).toBe(0)

          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })
})
