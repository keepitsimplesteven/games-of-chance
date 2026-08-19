/**
 * Lottery Drive Resolver — wraps the standard drive engine with suppression.
 *
 * Provides:
 * - resolveLotteryDown: resolves a single down with loser-victory suppression
 * - createLotteryDriveResolver: MatchResolver that runs a full drive with suppression
 */

import type { MatchResolver } from "@games-of-chance/shared"
import type {
  DriveState,
  DriveCompletion,
  PlayResult,
  PlayHistoryEntry,
  OffensivePlayId,
  DefensivePlayId,
  RngFunction,
  PlayConfig,
  PlayMatrix,
  PlayOutcome,
} from "../drive/types"
import { createDriveState, resolveDown, isDriveComplete, selectRandomPlay } from "../drive/engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "../drive/config"
import { generatePlayByPlay } from "../drive/playByPlay"
import { suppressLoserVictory } from "./suppressLoserVictory"
import { suppressEarlyEnding } from "./suppressEarlyEnding"

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
 * Resolves a single down with lottery suppression applied.
 *
 * Calls `resolveDown` normally, then checks if the outcome would cause the
 * predetermined loser to win the drive. If so, applies `suppressLoserVictory`
 * to get a corrected outcome and reconstructs the DriveState with the corrected
 * values (recomputing down progression, yard line, completion).
 *
 * @param state - Current drive state
 * @param offensivePlay - Offensive play called
 * @param defensivePlay - Defensive play called
 * @param rng - Injectable RNG function
 * @param config - Play configuration
 * @param matrix - Play matrix
 * @param predeterminedWinner - Player ID that must win this drive
 * @param minPlays - Optional minimum play count before the drive can end (dramatic final override)
 * @returns Updated state and play result (with suppression applied if needed)
 */
export function resolveLotteryDown(
  state: DriveState,
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId,
  rng: RngFunction,
  config: PlayConfig,
  matrix: PlayMatrix,
  predeterminedWinner: string,
  minPlays?: number
): { state: DriveState; result: PlayResult } {
  // First, resolve normally
  const normalResult = resolveDown(state, offensivePlay, defensivePlay, rng, config, matrix)
  let currentOutcome = normalResult.result.outcome
  let currentYards = normalResult.result.yardsGained

  // Apply minimum-plays suppression first (keeps the drive alive for drama)
  if (minPlays !== undefined) {
    const earlyCheck = suppressEarlyEnding(
      state,
      currentOutcome,
      currentYards,
      minPlays,
      rng,
      config,
      matrix,
      offensivePlay,
      defensivePlay
    )
    currentOutcome = earlyCheck.outcome
    currentYards = earlyCheck.yardsGained
  }

  // Then apply loser-victory suppression (ensures predetermined winner wins)
  const corrected = suppressLoserVictory(
    state,
    currentOutcome,
    currentYards,
    predeterminedWinner,
    rng,
    config,
    matrix,
    offensivePlay,
    defensivePlay
  )

  // If nothing changed from the original resolution, return normalResult as-is
  if (corrected.outcome === normalResult.result.outcome && corrected.yardsGained === normalResult.result.yardsGained) {
    return normalResult
  }

  // Outcome was suppressed — reconstruct the DriveState with corrected values
  const outcome = corrected.outcome
  const yardsGained = corrected.yardsGained

  const previousYardLine = state.yardLine
  const previousDown = state.down
  const previousYardsToGo = state.yardsToGo

  // Update yard line with clamping [0, 99]
  const newYardLine = Math.max(0, Math.min(99, previousYardLine - yardsGained))

  // Determine drive state changes
  let newDown = previousDown
  let newYardsToGo = previousYardsToGo
  let isComplete = false
  let completion: DriveCompletion | null = null

  // Check for turnovers first (interception / fumble end immediately)
  if (outcome === "interception" || outcome === "fumble") {
    isComplete = true
    completion = {
      winner: state.defensePlayerId,
      loser: state.offensePlayerId,
      endingType: outcome,
      finalState: null as unknown as DriveState,
    }
  }
  // Check for touchdown
  else if (newYardLine === 0) {
    isComplete = true
    completion = {
      winner: state.offensePlayerId,
      loser: state.defensePlayerId,
      endingType: "touchdown",
      finalState: null as unknown as DriveState,
    }
  }
  // Check first down conversion
  else if (yardsGained >= previousYardsToGo) {
    newDown = 1
    newYardsToGo = Math.min(10, newYardLine)
  }
  // Check turnover on downs (4th down failure)
  else if (previousDown === 4) {
    isComplete = true
    completion = {
      winner: state.defensePlayerId,
      loser: state.offensePlayerId,
      endingType: "turnover_on_downs",
      finalState: null as unknown as DriveState,
    }
  }
  // Normal down progression
  else {
    newDown = previousDown + 1
    newYardsToGo = previousYardsToGo - yardsGained
  }

  // Build play-by-play text
  const playByPlayText = generatePlayByPlay({
    outcome,
    yardsGained,
    offensivePlay,
    defensivePlay,
  })

  // Build result
  const result: PlayResult = {
    outcome,
    yardsGained,
    playByPlayText,
    offensivePlay,
    defensivePlay,
  }

  // Build play history entry
  const historyEntry: PlayHistoryEntry = {
    down: previousDown,
    yardsToGo: previousYardsToGo,
    yardLine: previousYardLine,
    offensivePlay,
    defensivePlay,
    result,
    resultingYardLine: newYardLine,
  }

  // Build new state (immutable)
  const newState: DriveState = {
    offensePlayerId: state.offensePlayerId,
    defensePlayerId: state.defensePlayerId,
    yardLine: newYardLine,
    down: newDown,
    yardsToGo: newYardsToGo,
    playHistory: [...state.playHistory, historyEntry],
    isComplete,
    completion,
  }

  // Set finalState on completion
  if (newState.completion) {
    newState.completion.finalState = newState
  }

  return { state: newState, result }
}

/**
 * Creates a MatchResolver that runs a full auto-resolved drive with lottery suppression.
 * The predetermined winner for each matchup is looked up by finding which entry in
 * `predeterminedWinners` contains both players.
 *
 * @param predeterminedWinners - Record of matchupId → winnerId
 * @param rng - Injectable RNG function
 * @param config - Play configuration (defaults to DEFAULT_PLAY_CONFIG)
 * @param matrix - Play matrix (defaults to DEFAULT_PLAY_MATRIX)
 */
export function createLotteryDriveResolver(
  predeterminedWinners: Record<string, string>,
  rng: RngFunction,
  config: PlayConfig = DEFAULT_PLAY_CONFIG,
  matrix: PlayMatrix = DEFAULT_PLAY_MATRIX
): MatchResolver {
  return (playerA: string, playerB: string): string => {
    // Find the predetermined winner for this matchup by checking which entry
    // contains either playerA or playerB as the winner value
    let predeterminedWinner: string | null = null
    for (const [_matchupId, winnerId] of Object.entries(predeterminedWinners)) {
      if (winnerId === playerA || winnerId === playerB) {
        // The winner is one of our two players — this is the right matchup
        predeterminedWinner = winnerId
        break
      }
    }

    // If no predetermined winner found (shouldn't happen in lottery mode), fall back to random
    if (!predeterminedWinner) {
      predeterminedWinner = rng() < 0.5 ? playerA : playerB
    }

    // Create drive state (playerA as offense, seedA=2 > seedB=1)
    let state = createDriveState(playerA, playerB, 2, 1)

    while (!isDriveComplete(state)) {
      const offPlay = selectRandomPlay(OFFENSIVE_PLAYS, rng) as OffensivePlayId
      const defPlay = selectRandomPlay(DEFENSIVE_PLAYS, rng) as DefensivePlayId

      const resolved = resolveLotteryDown(state, offPlay, defPlay, rng, config, matrix, predeterminedWinner)
      state = resolved.state
    }

    return state.completion!.winner
  }
}
