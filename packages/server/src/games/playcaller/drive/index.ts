/**
 * Playcaller Drive Engine — Public API
 *
 * Re-exports core engine functions, types, configuration, and play-by-play generation.
 * Also provides createDriveResolver for MatchResolver-compatible integration.
 */

// Core engine functions
export {
  createDriveState,
  resolveDown,
  isDriveComplete,
  getDriveCompletion,
  selectRandomPlay,
} from "./engine"

// Types and error classes
export type {
  PlayAxis,
  PlayStyle,
  OffensivePlayId,
  DefensivePlayId,
  OffensivePlayStats,
  DefensiveModifier,
  DefensivePlayDef,
  PlayConfig,
  PlayMatrix,
  RngFunction,
  PlayOutcome,
  PlayResult,
  PlayHistoryEntry,
  DriveEndingType,
  DriveCompletion,
  DriveState,
} from "./types"

export {
  InvalidPlayError,
  DriveCompleteError,
  InvalidPlayerError,
  InvalidSeedError,
} from "./types"

// Configuration
export { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"

// Play-by-play
export { generatePlayByPlay, DEFAULT_TEMPLATES } from "./playByPlay"

// --- MatchResolver adapter ---

import type { MatchResolver } from "@games-of-chance/shared"
import type { RngFunction, PlayConfig, PlayMatrix, OffensivePlayId, DefensivePlayId } from "./types"
import { createDriveState, resolveDown, isDriveComplete, selectRandomPlay } from "./engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"

const OFFENSIVE_PLAYS: OffensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

const DEFENSIVE_PLAYS: DefensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

/**
 * Creates a MatchResolver that runs a full auto-resolved drive to determine the winner.
 * This is the Phase 2 replacement for randomResolver.
 *
 * The returned function accepts two player IDs and returns the winner's player ID.
 * It runs an entire drive with random play selection for both sides using the injected rng.
 *
 * @param rng - Injectable RNG function returning values in [0, 1)
 * @param config - Play configuration (defaults to DEFAULT_PLAY_CONFIG)
 * @param matrix - Play matrix (defaults to DEFAULT_PLAY_MATRIX)
 */
export function createDriveResolver(
  rng: RngFunction,
  config: PlayConfig = DEFAULT_PLAY_CONFIG,
  matrix: PlayMatrix = DEFAULT_PLAY_MATRIX
): MatchResolver {
  return (playerA: string, playerB: string): string => {
    // Create drive state with playerA as offense (seedA=2 > seedB=1)
    let state = createDriveState(playerA, playerB, 2, 1)

    // Loop until drive is complete, selecting random plays for both sides
    while (!isDriveComplete(state)) {
      const offPlay = selectRandomPlay(OFFENSIVE_PLAYS, rng) as OffensivePlayId
      const defPlay = selectRandomPlay(DEFENSIVE_PLAYS, rng) as DefensivePlayId

      const resolved = resolveDown(state, offPlay, defPlay, rng, config, matrix)
      state = resolved.state
    }

    // Return the winner's player ID
    return state.completion!.winner
  }
}
