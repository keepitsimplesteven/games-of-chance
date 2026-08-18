/**
 * Property tests for PlayerSlot styling behavior.
 *
 * Property 6: isConsolation controls elimination styling
 * Property 7: Resolved consolation applies correct winner/loser styling
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { getPlayerSlotState } from "./playerSlotStyling"

describe("Property 6: isConsolation controls elimination styling", () => {
  /**
   * **Validates: Requirements 4.1, 4.4**
   *
   * For any player who is eliminated from the main bracket, when rendered with
   * isConsolation === true, the eliminated styling shall NOT be applied.
   * When the same player is rendered with isConsolation === false or undefined,
   * the eliminated styling SHALL be applied.
   */
  it("eliminated player in consolation context does NOT get eliminated styling", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // non-empty playerId (not TBD)
        (playerId) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: false,
            isLoser: false,
            isEliminated: true,
            isConsolation: true,
          })

          // isConsolation suppresses eliminated styling → player appears normal
          expect(state).toBe("normal")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("eliminated player outside consolation context DOES get eliminated styling", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // non-empty playerId
        fc.constantFrom(false, undefined),
        (playerId, isConsolation) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: false,
            isLoser: false,
            isEliminated: true,
            isConsolation,
          })

          // Without consolation flag, eliminated players get eliminated styling
          expect(state).toBe("eliminated")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("non-eliminated player is never styled as eliminated regardless of isConsolation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.boolean(),
        (playerId, isConsolation) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: false,
            isLoser: false,
            isEliminated: false,
            isConsolation,
          })

          expect(state).toBe("normal")
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("Property 7: Resolved consolation applies correct winner/loser styling", () => {
  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any resolved consolation matchup, the winning player's slot shall have
   * winner styling and the losing player's slot shall have loser styling,
   * regardless of their main-bracket elimination status.
   */
  it("winner in consolation always gets winner styling regardless of elimination status", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.boolean(), // isEliminated can be true or false
        (playerId, isEliminated) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: true,
            isLoser: false,
            isEliminated,
            isConsolation: true,
          })

          // Winner styling always takes precedence
          expect(state).toBe("winner")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("loser in consolation always gets eliminated/loser styling regardless of isConsolation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.boolean(), // isEliminated
        fc.boolean(), // isConsolation
        (playerId, isEliminated, isConsolation) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: false,
            isLoser: true,
            isEliminated,
            isConsolation,
          })

          // Loser styling always applies (rendered as "eliminated" state which
          // maps to the dimmed/line-through CSS class)
          expect(state).toBe("eliminated")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("winner styling takes precedence over all other flags", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.boolean(), // isLoser
        fc.boolean(), // isEliminated
        fc.boolean(), // isConsolation
        (playerId, isLoser, isEliminated, isConsolation) => {
          const state = getPlayerSlotState({
            playerId,
            isWinner: true,
            isLoser,
            isEliminated,
            isConsolation,
          })

          // isWinner is checked before isLoser/isEliminated in the logic
          expect(state).toBe("winner")
        }
      ),
      { numRuns: 100 }
    )
  })
})
