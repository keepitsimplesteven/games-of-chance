import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { renderHook } from "@testing-library/react"
import { usePlayCards } from "../usePlayCards"
import type { Circumstance, OffensivePlayId, DefensivePlayId } from "../../play-names/types"

/**
 * Property 4: Play set correctness by player role
 *
 * For any DriveState where the drive is not complete and it is the picking phase,
 * when the current player is on offense the UI presents exactly the 4 offensive
 * play IDs (run-safe, run-aggressive, pass-safe, pass-aggressive), and when on
 * defense presents exactly the 4 defensive play IDs.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe("usePlayCards property tests", () => {
  const circumstanceArb: fc.Arbitrary<Circumstance> = fc.constantFrom(
    "standard",
    "short_yardage",
    "desperation"
  )

  const OFFENSIVE_PLAY_IDS: OffensivePlayId[] = [
    "run-safe",
    "run-aggressive",
    "pass-safe",
    "pass-aggressive",
  ]

  const DEFENSIVE_PLAY_IDS: DefensivePlayId[] = [
    "run-safe",
    "run-aggressive",
    "pass-safe",
    "pass-aggressive",
  ]

  it("returns exactly 4 cards with offensive play IDs when role is offense", () => {
    fc.assert(
      fc.property(circumstanceArb, (circumstance) => {
        const { result } = renderHook(() => usePlayCards(circumstance, "offense"))

        // Exactly 4 cards
        expect(result.current).toHaveLength(4)

        // All IDs are the offensive play IDs
        const ids = result.current.map((card) => card.playId)
        expect(ids).toEqual(OFFENSIVE_PLAY_IDS)
      }),
      { numRuns: 50 }
    )
  })

  it("returns exactly 4 cards with defensive play IDs when role is defense", () => {
    fc.assert(
      fc.property(circumstanceArb, (circumstance) => {
        const { result } = renderHook(() => usePlayCards(circumstance, "defense"))

        // Exactly 4 cards
        expect(result.current).toHaveLength(4)

        // All IDs are the defensive play IDs
        const ids = result.current.map((card) => card.playId)
        expect(ids).toEqual(DEFENSIVE_PLAY_IDS)
      }),
      { numRuns: 50 }
    )
  })

  it("each card has a non-empty displayName and formation", () => {
    fc.assert(
      fc.property(
        circumstanceArb,
        fc.constantFrom<"offense" | "defense">("offense", "defense"),
        (circumstance, role) => {
          const { result } = renderHook(() => usePlayCards(circumstance, role))

          for (const card of result.current) {
            expect(card.displayName).toBeTruthy()
            expect(card.displayName.length).toBeGreaterThan(0)
            expect(card.formation).toBeTruthy()
            expect(card.formation.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it("each card has valid artData with a non-null markers array", () => {
    fc.assert(
      fc.property(
        circumstanceArb,
        fc.constantFrom<"offense" | "defense">("offense", "defense"),
        (circumstance, role) => {
          const { result } = renderHook(() => usePlayCards(circumstance, role))

          for (const card of result.current) {
            expect(card.artData).toBeDefined()
            expect(card.artData).not.toBeNull()
            expect(Array.isArray(card.artData.markers)).toBe(true)
            expect(card.artData.markers.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
