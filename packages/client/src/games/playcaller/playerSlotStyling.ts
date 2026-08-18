/**
 * Pure function extracting the PlayerSlot styling logic for testability.
 *
 * This mirrors the logic in BracketVisualization.tsx's PlayerSlot component,
 * making it possible to property-test independently of React rendering.
 */

export type PlayerSlotState = "tbd" | "winner" | "eliminated" | "normal"

export interface PlayerSlotStylingInput {
  playerId: string
  isWinner: boolean
  isLoser: boolean
  isEliminated: boolean
  isConsolation?: boolean
}

/**
 * Determines which visual state a PlayerSlot should be in based on its props.
 * The result maps 1:1 to the CSS class assignment in the component.
 */
export function getPlayerSlotState(input: PlayerSlotStylingInput): PlayerSlotState {
  const { playerId, isWinner, isLoser, isEliminated, isConsolation } = input
  const isTBD = !playerId

  if (isTBD) {
    return "tbd"
  } else if (isWinner) {
    return "winner"
  } else if (isLoser || (!isConsolation && isEliminated)) {
    return "eliminated"
  }
  return "normal"
}
