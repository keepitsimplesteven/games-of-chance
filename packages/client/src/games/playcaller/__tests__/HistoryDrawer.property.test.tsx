import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { HistoryDrawer } from "../HistoryDrawer"

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
        fc.array(fc.string({ minLength: 1, maxLength: 60 }), {
          minLength: 0,
          maxLength: 20,
        }),
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
        fc.array(fc.string({ minLength: 1, maxLength: 60 }), {
          minLength: 1,
          maxLength: 15,
        }),
        (entries) => {
          const { unmount } = render(
            <HistoryDrawer entries={entries} isOpen={true} onClose={() => {}} />
          )

          const rendered = screen.getAllByTestId("history-entry")

          for (let i = 0; i < entries.length; i++) {
            expect(rendered[i].textContent).toContain(entries[i])
          }

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("each entry's text content matches the corresponding input string", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[A-Za-z0-9 ]{1,40}$/),
          { minLength: 1, maxLength: 10 }
        ),
        (entries) => {
          const { unmount } = render(
            <HistoryDrawer entries={entries} isOpen={true} onClose={() => {}} />
          )

          const rendered = screen.getAllByTestId("history-entry")

          for (let i = 0; i < entries.length; i++) {
            expect(rendered[i].textContent).toContain(entries[i])
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
        fc.array(fc.string({ minLength: 1, maxLength: 40 }), {
          minLength: 0,
          maxLength: 10,
        }),
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
