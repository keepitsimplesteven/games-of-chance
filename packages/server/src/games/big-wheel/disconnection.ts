import { getBigWheelState } from "./BigWheelPlugin"

/**
 * Result of handling a disconnection for the active spinner.
 * Contains the auto-resolved spin values so the caller can
 * broadcast results and advance the game.
 */
export interface DisconnectionResolution {
  /** The player that disconnected */
  playerId: string
  /** Auto-resolved spin values (1 or 2 entries depending on how many were remaining) */
  resolvedSpins: number[]
  /** The computed spin total (sum of all spin values for the turn) */
  spinTotal: number
  /** The reel indices that were randomly selected */
  resolvedIndices: number[]
}

/**
 * Handles disconnection of the active spinner during their turn.
 *
 * Auto-resolves any remaining spins using random reel strip indices.
 * - If the spinner has done 0 spins: resolves both spins with random indices
 * - If the spinner has done 1 spin: resolves spin 2 with a random index
 *
 * Adds the player to pluginState.disconnectedPlayers and stores
 * results in pluginState.spinResults.
 *
 * @param playerId - The ID of the disconnecting active spinner
 * @returns The resolution details, or null if state is not initialized
 */
export function handleActiveSpinnerDisconnection(
  playerId: string
): DisconnectionResolution | null {
  const state = getBigWheelState()
  if (!state) return null

  // Add to disconnected players tracking
  if (!state.disconnectedPlayers.includes(playerId)) {
    state.disconnectedPlayers.push(playerId)
  }

  const reelStrip = state.reelStrip
  const existingSpins = state.spinResults[playerId] ?? []
  const completedSpinCount = existingSpins.length

  const resolvedSpins: number[] = []
  const resolvedIndices: number[] = []

  // Auto-resolve remaining spins
  const remainingSpins = 2 - completedSpinCount
  for (let i = 0; i < remainingSpins; i++) {
    const reelIndex = Math.floor(Math.random() * reelStrip.length)
    const value = reelStrip[reelIndex]
    resolvedSpins.push(value)
    resolvedIndices.push(reelIndex)
  }

  // Combine existing spins with newly resolved ones
  const allSpins = [...existingSpins, ...resolvedSpins]
  state.spinResults[playerId] = allSpins

  // Compute spin total
  const spinTotal = allSpins.length === 2 ? allSpins[0] + allSpins[1] : 0

  return {
    playerId,
    resolvedSpins,
    spinTotal,
    resolvedIndices,
  }
}

/**
 * Resolves a disconnected (non-active) player's turn when their
 * position in the spin order arrives.
 *
 * Assigns them a spinTotal of 0 with empty spin results and adds
 * them to the disconnectedPlayers list.
 *
 * @param playerId - The ID of the disconnected player whose turn is being skipped
 * @returns The resolution details, or null if state is not initialized
 */
export function resolveDisconnectedTurn(
  playerId: string
): DisconnectionResolution | null {
  const state = getBigWheelState()
  if (!state) return null

  // Add to disconnected players tracking
  if (!state.disconnectedPlayers.includes(playerId)) {
    state.disconnectedPlayers.push(playerId)
  }

  // Store empty/zero results — turn is skipped
  state.spinResults[playerId] = [0, 0]

  return {
    playerId,
    resolvedSpins: [0, 0],
    spinTotal: 0,
    resolvedIndices: [],
  }
}

/**
 * Checks whether a player is currently tracked as disconnected.
 *
 * @param playerId - The player ID to check
 * @returns true if the player is in the disconnectedPlayers list
 */
export function isPlayerDisconnected(playerId: string): boolean {
  const state = getBigWheelState()
  if (!state) return false
  return state.disconnectedPlayers.includes(playerId)
}

/**
 * General disconnection handler — determines whether the disconnecting
 * player is the active spinner or a non-active player and dispatches
 * to the appropriate resolution logic.
 *
 * @param playerId - The ID of the player who disconnected
 * @returns The resolution details, or null if state is not initialized
 */
export function handleDisconnection(
  playerId: string
): DisconnectionResolution | null {
  const state = getBigWheelState()
  if (!state) return null

  const activeSpinnerId = state.spinOrder[state.currentTurnIndex]

  if (playerId === activeSpinnerId) {
    return handleActiveSpinnerDisconnection(playerId)
  } else {
    // For non-active players, we just mark them as disconnected.
    // Their turn will be resolved via resolveDisconnectedTurn when
    // their position in spinOrder is reached.
    if (!state.disconnectedPlayers.includes(playerId)) {
      state.disconnectedPlayers.push(playerId)
    }
    return null
  }
}
