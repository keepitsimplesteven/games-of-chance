/**
 * Suppress Early Ending — prevents drives from completing before a minimum play count.
 *
 * Used in lottery "Final" games to guarantee dramatic, extended matchups.
 * If a play would end the drive (TD, turnover, turnover-on-downs) but the
 * minimum number of plays hasn't been reached yet, the outcome is re-rolled
 * or capped to keep the drive alive.
 */

import type {
  DriveState,
  OffensivePlayId,
  DefensivePlayId,
  RngFunction,
  PlayConfig,
  PlayMatrix,
  PlayOutcome,
} from "../drive/types"

const MAX_REROLL_ATTEMPTS = 10

/**
 * Checks whether the current play would end the drive, and if so (and the
 * minimum play count hasn't been reached), returns a corrected outcome that
 * keeps the drive going.
 *
 * Drive-ending conditions suppressed:
 * 1. Touchdown (yardLine - yardsGained <= 0) → cap yards to yardLine - 1
 * 2. Interception / fumble → re-roll until non-turnover
 * 3. Turnover on downs (4th down, gain < yardsToGo) → force first-down conversion
 *
 * @param state - Current drive state (before this play is applied)
 * @param outcome - The resolved play outcome
 * @param yardsGained - The resolved yards gained
 * @param minPlays - Minimum number of plays required before the drive can end
 * @param rng - RNG function for re-rolls
 * @param config - Play configuration
 * @param matrix - Play matrix
 * @param offensivePlay - The offensive play called
 * @param defensivePlay - The defensive play called
 * @returns Corrected { outcome, yardsGained } that keeps the drive alive, or
 *          the original values if suppression isn't needed.
 */
export function suppressEarlyEnding(
  state: DriveState,
  outcome: PlayOutcome,
  yardsGained: number,
  minPlays: number,
  rng: RngFunction,
  config: PlayConfig,
  matrix: PlayMatrix,
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId
): { outcome: PlayOutcome; yardsGained: number } {
  // Current play count is the number of already-completed plays.
  // This play (being resolved now) would be play #(playHistory.length + 1).
  const playsAfterThis = state.playHistory.length + 1

  // If we've already reached the minimum, no suppression needed
  if (playsAfterThis >= minPlays) {
    return { outcome, yardsGained }
  }

  // --- Suppress touchdown ---
  if (state.yardLine - yardsGained <= 0) {
    // Try to re-roll for a non-TD outcome
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(offensivePlay, defensivePlay, rng, config, matrix)
      // Must not produce a TD AND must not be a turnover (keep drive alive)
      if (
        state.yardLine - fresh.yardsGained >= 1 &&
        fresh.outcome !== "interception" &&
        fresh.outcome !== "fumble"
      ) {
        // Also ensure it doesn't cause turnover on downs
        if (state.down === 4 && fresh.yardsGained < state.yardsToGo) {
          continue // would end via turnover on downs
        }
        return fresh
      }
    }
    // Fallback: cap yards so we stop 1 yard short of the end zone
    return { outcome: "success", yardsGained: state.yardLine - 1 }
  }

  // --- Suppress interception / fumble ---
  if (outcome === "interception" || outcome === "fumble") {
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(offensivePlay, defensivePlay, rng, config, matrix)
      if (fresh.outcome === "interception" || fresh.outcome === "fumble") {
        continue
      }
      // Ensure no TD
      if (state.yardLine - fresh.yardsGained <= 0) {
        continue
      }
      // Ensure no turnover on downs
      if (state.down === 4 && fresh.yardsGained < state.yardsToGo) {
        continue
      }
      return fresh
    }
    // Fallback: incomplete pass (safe, doesn't end the drive unless 4th down)
    if (state.down === 4) {
      // Force a first-down conversion to avoid turnover on downs
      return { outcome: "success", yardsGained: state.yardsToGo }
    }
    return { outcome: "incomplete_pass", yardsGained: 0 }
  }

  // --- Suppress turnover on downs (4th down, gain < yardsToGo) ---
  if (state.down === 4 && yardsGained < state.yardsToGo) {
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(offensivePlay, defensivePlay, rng, config, matrix)
      if (fresh.outcome === "interception" || fresh.outcome === "fumble") {
        continue
      }
      if (state.yardLine - fresh.yardsGained <= 0) {
        continue
      }
      if (fresh.yardsGained >= state.yardsToGo) {
        return fresh
      }
    }
    // Fallback: force the first-down conversion
    return { outcome: "success", yardsGained: state.yardsToGo }
  }

  // No suppression needed — outcome doesn't end the drive
  return { outcome, yardsGained }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function generateFreshOutcome(
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId,
  rng: RngFunction,
  config: PlayConfig,
  matrix: PlayMatrix
): { outcome: PlayOutcome; yardsGained: number } {
  const baseStats = config.offensivePlays[offensivePlay]
  const matrixKey =
    `${offensivePlay}:${defensivePlay}` as `${OffensivePlayId}:${DefensivePlayId}`
  const modifier = matrix[matrixKey]

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

  let outcome: PlayOutcome
  let yardsGained: number

  const successRoll = rng()

  if (successRoll < modifiedSuccessRate) {
    const critSuccessRoll = rng()

    if (critSuccessRoll < modifiedCritSuccess) {
      outcome = "critical_success"
      const bonusRoll = rng()
      yardsGained = Math.round(modifiedMax + bonusRoll * (modifiedMax * 0.2))
    } else {
      outcome = "success"
      const yardageRoll = rng()
      yardsGained = Math.round(
        modifiedMin + yardageRoll * (modifiedMax - modifiedMin)
      )
    }
  } else {
    const critFailureRoll = rng()

    if (critFailureRoll < modifiedCritFailure) {
      if (baseStats.axis === "pass") {
        outcome = "interception"
        yardsGained = 0
      } else {
        outcome = "fumble"
        yardsGained = 0
      }
    } else {
      if (baseStats.axis === "pass") {
        outcome = "incomplete_pass"
        yardsGained = 0
      } else {
        outcome = "tackle_for_loss"
        const lossRoll = rng()
        yardsGained = -Math.round(1 + lossRoll * 2)
      }
    }
  }

  return { outcome, yardsGained }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
