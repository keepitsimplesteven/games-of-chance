import type {
  DriveState,
  OffensivePlayId,
  DefensivePlayId,
  RngFunction,
  PlayConfig,
  PlayMatrix,
  PlayOutcome,
} from "../drive/types"

/**
 * Maximum number of re-roll attempts before forcing a safe outcome.
 */
const MAX_REROLL_ATTEMPTS = 10

/**
 * Generates a fresh play outcome using the same play config/matrix with new RNG draws.
 * Replicates the resolution logic from engine.ts without side effects.
 */
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

/**
 * Computes the absolute maximum yardage possible for a given play combination.
 * This accounts for critical success bonus (modifiedMax * 1.2).
 */
function computeMaxPossibleYards(
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId,
  config: PlayConfig,
  matrix: PlayMatrix
): number {
  const baseStats = config.offensivePlays[offensivePlay]
  const matrixKey =
    `${offensivePlay}:${defensivePlay}` as `${OffensivePlayId}:${DefensivePlayId}`
  const modifier = matrix[matrixKey]

  const modifiedMaxRaw = baseStats.yardageRange.max + modifier.yardageMaxMod
  const modifiedMax = clamp(modifiedMaxRaw, 1, 25)

  // Critical success max: modifiedMax + modifiedMax * 0.20
  return Math.round(modifiedMax * 1.2)
}

/**
 * Suppresses any play outcome that would cause the predetermined loser to win
 * the drive. This is a pure function that does not mutate input state.
 *
 * Cases handled:
 * 1. If the predetermined winner would win → pass through (no suppression)
 * 2. Offense is loser and would score a TD → re-roll until no TD
 * 3. Defense is loser and outcome is INT/fumble → re-roll until no turnover
 * 4. Defense is loser, 4th down, gain < yardsToGo → re-roll until gain ≥ yardsToGo
 *
 * @returns Corrected { outcome, yardsGained } that does not end the drive in
 *          the predetermined loser's favor.
 */
export function suppressLoserVictory(
  state: DriveState,
  outcome: PlayOutcome,
  yardsGained: number,
  predeterminedWinner: string,
  rng: RngFunction,
  config: PlayConfig,
  matrix: PlayMatrix,
  offensivePlay: OffensivePlayId,
  defensivePlay: DefensivePlayId
): { outcome: PlayOutcome; yardsGained: number } {
  const offenseIsWinner = state.offensePlayerId === predeterminedWinner
  const defenseIsWinner = state.defensePlayerId === predeterminedWinner

  // --- Case 1: Winner would win — pass through, no suppression needed ---

  // If offense is the winner and would score a TD, that's fine
  if (offenseIsWinner && state.yardLine - yardsGained <= 0) {
    return { outcome, yardsGained }
  }

  // If defense is the winner and outcome is a turnover, that's fine
  if (
    defenseIsWinner &&
    (outcome === "interception" || outcome === "fumble")
  ) {
    return { outcome, yardsGained }
  }

  // If defense is the winner and it's turnover on downs, that's fine
  if (
    defenseIsWinner &&
    state.down === 4 &&
    yardsGained < state.yardsToGo
  ) {
    return { outcome, yardsGained }
  }

  // --- Case 2: Offense is loser and would score a touchdown ---
  // (offense !== predeterminedWinner, meaning defense IS the winner)
  if (!offenseIsWinner && state.yardLine - yardsGained <= 0) {
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(
        offensivePlay,
        defensivePlay,
        rng,
        config,
        matrix
      )
      // Valid if it does NOT produce a TD (yardLine - newYards >= 1)
      if (state.yardLine - fresh.yardsGained >= 1) {
        return fresh
      }
    }
    // Fallback: cap yards to yardLine - 1
    return { outcome: "success", yardsGained: state.yardLine - 1 }
  }

  // --- Case 3: Defense is loser and outcome is interception or fumble ---
  // (defense !== predeterminedWinner, meaning offense IS the winner)
  if (!defenseIsWinner && (outcome === "interception" || outcome === "fumble")) {
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(
        offensivePlay,
        defensivePlay,
        rng,
        config,
        matrix
      )
      // Must not be INT or fumble (those award drive to defense/loser)
      if (fresh.outcome === "interception" || fresh.outcome === "fumble") {
        continue
      }
      // Must not produce a TD if offense is somehow not the winner
      // (but in this case offense IS the winner, so TD is fine)
      // However, on 4th down, ensure it doesn't cause turnover on downs for the winner
      if (state.down === 4 && fresh.yardsGained < state.yardsToGo) {
        continue
      }
      return fresh
    }
    // Fallback: if it's 4th down, force first down conversion to prevent turnover on downs
    if (state.down === 4) {
      return { outcome: "success", yardsGained: state.yardsToGo }
    }
    // Otherwise, safe non-winning outcome for the loser
    return { outcome: "incomplete_pass", yardsGained: 0 }
  }

  // --- Case 4: Defense is loser, 4th down, gain < yardsToGo (turnover on downs) ---
  // (defense !== predeterminedWinner, meaning offense IS the winner)
  if (
    !defenseIsWinner &&
    state.down === 4 &&
    yardsGained < state.yardsToGo
  ) {
    // Edge case: if max possible yardage can't reach yardsToGo, force it
    const maxPossibleYards = computeMaxPossibleYards(
      offensivePlay,
      defensivePlay,
      config,
      matrix
    )

    if (maxPossibleYards < state.yardsToGo) {
      return { outcome: "success", yardsGained: state.yardsToGo }
    }

    // Re-roll until yardsGained >= yardsToGo and no turnover
    for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
      const fresh = generateFreshOutcome(
        offensivePlay,
        defensivePlay,
        rng,
        config,
        matrix
      )
      // Must not be INT or fumble (those award drive to defense/loser)
      if (fresh.outcome === "interception" || fresh.outcome === "fumble") {
        continue
      }
      // Must convert the first down (gain >= yardsToGo)
      if (fresh.yardsGained >= state.yardsToGo) {
        return fresh
      }
    }
    // Fallback after 10 attempts: force the conversion
    return { outcome: "success", yardsGained: state.yardsToGo }
  }

  // No suppression needed — outcome doesn't cause the loser to win
  return { outcome, yardsGained }
}

// --- Internal helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
