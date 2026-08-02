/**
 * Pure utility function that reorders a list of player results so the
 * current player appears at index 0 while preserving the relative order
 * of all other players.
 *
 * If the currentPlayerId is not found in the list, the original order is returned unchanged.
 *
 * Validates: Requirements 4.1
 */

export interface PlayerResult {
  playerId: string
  [key: string]: unknown
}

/**
 * Given a list of player results and a currentPlayerId, returns a new array with:
 * - The current player at index 0
 * - All other players in their original relative order
 *
 * If currentPlayerId is not found, returns the array in its original order.
 */
export function orderResultsByCurrentPlayer<T extends PlayerResult>(
  results: T[],
  currentPlayerId: string
): T[] {
  const currentPlayer = results.find((r) => r.playerId === currentPlayerId)

  if (!currentPlayer) {
    return [...results]
  }

  const otherPlayers = results.filter((r) => r.playerId !== currentPlayerId)
  return [currentPlayer, ...otherPlayers]
}
