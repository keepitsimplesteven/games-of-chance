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
} from "./types"

import {
  InvalidPlayerError,
  InvalidSeedError,
  InvalidPlayError,
  DriveCompleteError,
} from "./types"

import { generatePlayByPlay } from "./playByPlay"

// --- Valid play IDs for validation ---
const VALID_OFFENSIVE_PLAYS: OffensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

const VALID_DEFENSIVE_PLAYS: DefensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

/**
 * Creates initial drive state. Higher seed = offense.
 * Throws InvalidPlayerError if both player IDs are the same.
 * Throws InvalidSeedError if seeds are equal.
 */
export function createDriveState(
  playerA: string,
  playerB: string,
  seedA: number,
  seedB: number
): DriveState {
  if (playerA === playerB) {
    throw new InvalidPlayerError(
      "Cannot create a drive with the same player on both sides"
    )
  }

  if (seedA === seedB) {
    throw new InvalidSeedError(
      "Seeds must differ to determine offense and defense"
    )
  }

  const offensePlayerId = seedA > seedB ? playerA : playerB
  const defensePlayerId = seedA > seedB ? playerB : playerA

  return {
    offensePlayerId,
    defensePlayerId,
    yardLine: 25,
    down: 1,
    yardsToGo: 10,
    playHistory: [],
    isComplete: false,
    completion: null,
  }
}

/**
 * Resolves a single down. Pure function — no side effects.
 * Returns updated DriveState and the PlayResult for this down.
 */
export function resolveDown(
  state: DriveState,
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId,
  rng: RngFunction,
  config: PlayConfig,
  matrix: PlayMatrix
): { state: DriveState; result: PlayResult } {
  // Validate: drive must not be complete
  if (state.isComplete) {
    throw new DriveCompleteError("Cannot resolve a down on a completed drive")
  }

  // Validate play IDs
  if (!VALID_OFFENSIVE_PLAYS.includes(offensivePlay)) {
    throw new InvalidPlayError(
      `Invalid offensive play: "${offensivePlay}"`
    )
  }
  if (!VALID_DEFENSIVE_PLAYS.includes(defensivePlay)) {
    throw new InvalidPlayError(
      `Invalid defensive play: "${defensivePlay}"`
    )
  }

  // Look up base stats and defensive modifier
  const baseStats = config.offensivePlays[offensivePlay]
  const matrixKey = `${offensivePlay}:${defensivePlay}` as `${OffensivePlayId}:${DefensivePlayId}`
  const modifier = matrix[matrixKey]

  // Apply modifiers with clamping
  const modifiedSuccessRate = clamp(
    baseStats.successRate + modifier.successRateMod,
    0.05,
    0.95
  )

  const modifiedMaxRaw = baseStats.yardageRange.max + modifier.yardageMaxMod
  const modifiedMax = clamp(modifiedMaxRaw, 1, 25)

  const modifiedMinRaw = baseStats.yardageRange.min + modifier.yardageMinMod
  const modifiedMin = clamp(modifiedMinRaw, 0, modifiedMax)

  const modifiedCritSuccess = clamp(
    baseStats.criticalSuccessChance + modifier.critSuccessMod,
    0,
    0.30
  )

  const modifiedCritFailure = clamp(
    baseStats.criticalFailureChance + modifier.critFailureMod,
    0,
    0.30
  )

  // --- Multi-step roll sequence ---
  let outcome: PlayOutcome
  let yardsGained: number

  const successRoll = rng()

  if (successRoll < modifiedSuccessRate) {
    // Success path
    const critSuccessRoll = rng()

    if (critSuccessRoll < modifiedCritSuccess) {
      // Critical success: 100-120% of modified max
      outcome = "critical_success"
      const bonusRoll = rng()
      yardsGained = Math.round(modifiedMax + bonusRoll * (modifiedMax * 0.20))
    } else {
      // Normal success: [min, max]
      outcome = "success"
      const yardageRoll = rng()
      yardsGained = Math.round(modifiedMin + yardageRoll * (modifiedMax - modifiedMin))
    }
  } else {
    // Failure path
    const critFailureRoll = rng()

    if (critFailureRoll < modifiedCritFailure) {
      // Critical failure
      if (baseStats.axis === "pass") {
        outcome = "interception"
        yardsGained = 0
      } else {
        outcome = "fumble"
        yardsGained = 0
      }
    } else {
      // Normal failure
      if (baseStats.axis === "pass") {
        outcome = "incomplete_pass"
        yardsGained = 0
      } else {
        // Tackle for loss: -(1 + rng() * 2) → rounded, yields [-1, -3]
        outcome = "tackle_for_loss"
        const lossRoll = rng()
        yardsGained = -Math.round(1 + lossRoll * 2)
      }
    }
  }

  // --- Down progression and drive completion ---
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
      finalState: null as unknown as DriveState, // will be set below
    }
  }
  // Check for touchdown
  else if (newYardLine === 0) {
    isComplete = true
    completion = {
      winner: state.offensePlayerId,
      loser: state.defensePlayerId,
      endingType: "touchdown",
      finalState: null as unknown as DriveState, // will be set below
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
      finalState: null as unknown as DriveState, // will be set below
    }
  }
  // Normal down progression
  else {
    newDown = previousDown + 1
    newYardsToGo = previousYardsToGo - yardsGained
  }

  // Build play-by-play text via template module
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

  // Build new state (immutable — no mutation of input)
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

  // Set finalState on completion (circular reference to the final state)
  if (newState.completion) {
    newState.completion.finalState = newState
  }

  return { state: newState, result }
}

/**
 * Checks if a drive is complete.
 */
export function isDriveComplete(state: DriveState): boolean {
  return state.isComplete
}

/**
 * Returns the completion status of a finished drive.
 * Throws DriveCompleteError if drive is not complete.
 */
export function getDriveCompletion(state: DriveState): DriveCompletion {
  if (!state.isComplete || !state.completion) {
    throw new DriveCompleteError(
      "Cannot get completion status of an incomplete drive"
    )
  }
  return state.completion
}

/**
 * Selects a random play from the provided list using rng.
 */
export function selectRandomPlay(
  plays: OffensivePlayId[] | DefensivePlayId[],
  rng: RngFunction
): OffensivePlayId | DefensivePlayId {
  const index = Math.floor(rng() * plays.length)
  return plays[index]
}

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
