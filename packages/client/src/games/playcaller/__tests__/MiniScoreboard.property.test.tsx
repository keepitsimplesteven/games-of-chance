import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { MiniScoreboard } from "../MiniScoreboard"
import { formatDownDistance } from "../field-utils"

/**
 * Property 9: Scoreboard reflects current drive state
 *
 * For any DriveState, the Mini_Scoreboard SHALL display values equal to
 * driveState.down, driveState.yardsToGo, and driveState.yardLine respectively.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */
describe("Property 9: Scoreboard reflects current drive state", () => {
  // ── Generators ──────────────────────────────────────────────────────────

  /** Valid down: 1-4 */
  const arbDown = fc.integer({ min: 1, max: 4 })

  /** Valid yards to go: 1-99 */
  const arbYardsToGo = fc.integer({ min: 1, max: 99 })

  /** Valid yard line: 0-35 (field range in playcaller) */
  const arbYardLine = fc.integer({ min: 0, max: 35 })

  /** Player name: non-empty alphanumeric string */
  const arbPlayerName = fc.stringMatching(/^[A-Za-z0-9_]{1,20}$/)

  it("rendered output contains the formatted down/distance string for any valid down and yardsToGo", () => {
    fc.assert(
      fc.property(
        arbDown,
        arbYardsToGo,
        arbYardLine,
        arbPlayerName,
        arbPlayerName,
        (down, yardsToGo, yardLine, offName, defName) => {
          const { container, unmount } = render(
            <MiniScoreboard
              down={down}
              yardsToGo={yardsToGo}
              yardLine={yardLine}
              offensePlayerName={offName}
              defensePlayerName={defName}
            />
          )

          const expectedText = formatDownDistance(down, yardsToGo, yardLine)
          expect(container.textContent).toContain(expectedText)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rendered output contains the yardLine value", () => {
    fc.assert(
      fc.property(
        arbDown,
        arbYardsToGo,
        arbYardLine,
        arbPlayerName,
        arbPlayerName,
        (down, yardsToGo, yardLine, offName, defName) => {
          const { container, unmount } = render(
            <MiniScoreboard
              down={down}
              yardsToGo={yardsToGo}
              yardLine={yardLine}
              offensePlayerName={offName}
              defensePlayerName={defName}
            />
          )

          expect(container.textContent).toContain(`${yardLine}`)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rendered output contains both player names", () => {
    fc.assert(
      fc.property(
        arbDown,
        arbYardsToGo,
        arbYardLine,
        arbPlayerName,
        arbPlayerName,
        (down, yardsToGo, yardLine, offName, defName) => {
          const { container, unmount } = render(
            <MiniScoreboard
              down={down}
              yardsToGo={yardsToGo}
              yardLine={yardLine}
              offensePlayerName={offName}
              defensePlayerName={defName}
            />
          )

          expect(container.textContent).toContain(offName)
          expect(container.textContent).toContain(defName)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})
