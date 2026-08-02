import type { CoinTossPick, CoinTossResult } from "@games-of-chance/shared"

// ── Interfaces ─────────────────────────────────────────────────────────────

/** Tracks consecutive correct and wrong guesses per player */
export interface StreakState {
  /** Consecutive correct guesses per player (resets on wrong) */
  correctStreaks: Record<string, number>
  /** Consecutive incorrect guesses per player (resets on correct) */
  wrongStreaks: Record<string, number>
}

/** Result of applying streak-based scoring to a round */
export interface StreakScoringResult {
  /** Score deltas after multiplier applied */
  deltas: Record<string, number>
  /** Updated streak state after this round */
  nextStreakState: StreakState
  /** Per-player multiplier that was applied (for UI display) */
  appliedMultipliers: Record<string, number>
}

// ── Multiplier Logic ───────────────────────────────────────────────────────

/**
 * Returns the multiplier for a given streak counter value (before this round).
 * - 0 → 1x (first correct or coming off wrong)
 * - 1 → 2x (second consecutive correct)
 * - 2+ → 3x (third+ consecutive correct)
 */
function getMultiplier(streakBefore: number): number {
  if (streakBefore >= 2) return 3
  if (streakBefore === 1) return 2
  return 1
}

// ── Core Scoring Function ──────────────────────────────────────────────────

/**
 * Computes streak-based scoring for a coin toss round.
 *
 * For each player in `picks`:
 * - Correct guess → basePoints * multiplier (based on prior streak), correctStreak increments, wrongStreak resets
 * - Incorrect guess → 0 points, correctStreak resets, wrongStreak increments
 */
export function computeStreakScoring(
  picks: Record<string, CoinTossPick>,
  result: CoinTossResult,
  currentStreak: StreakState,
  basePoints: number
): StreakScoringResult {
  const deltas: Record<string, number> = Object.create(null)
  const nextCorrectStreaks: Record<string, number> = Object.create(null)
  const nextWrongStreaks: Record<string, number> = Object.create(null)
  const appliedMultipliers: Record<string, number> = Object.create(null)

  // Carry forward existing streak state
  for (const [k, v] of Object.entries(currentStreak.correctStreaks)) {
    nextCorrectStreaks[k] = v
  }
  for (const [k, v] of Object.entries(currentStreak.wrongStreaks)) {
    nextWrongStreaks[k] = v
  }

  for (const [playerId, pick] of Object.entries(picks)) {
    const currentCorrectStreak = Object.prototype.hasOwnProperty.call(currentStreak.correctStreaks, playerId)
      ? currentStreak.correctStreaks[playerId]
      : 0
    const isCorrect = pick.side === result.outcome

    if (isCorrect) {
      const multiplier = getMultiplier(currentCorrectStreak)
      deltas[playerId] = basePoints * multiplier
      appliedMultipliers[playerId] = multiplier
      nextCorrectStreaks[playerId] = currentCorrectStreak + 1
      nextWrongStreaks[playerId] = 0
    } else {
      deltas[playerId] = 0
      appliedMultipliers[playerId] = 0
      nextCorrectStreaks[playerId] = 0
      const currentWrongStreak = Object.prototype.hasOwnProperty.call(currentStreak.wrongStreaks, playerId)
        ? currentStreak.wrongStreaks[playerId]
        : 0
      nextWrongStreaks[playerId] = currentWrongStreak + 1
    }
  }

  return {
    deltas,
    nextStreakState: {
      correctStreaks: nextCorrectStreaks,
      wrongStreaks: nextWrongStreaks,
    },
    appliedMultipliers,
  }
}

// ── Streak Indicator Utility ───────────────────────────────────────────────

/**
 * Returns the streak indicator emoji string for a player.
 *
 * - correctStreak = 2 → "🔥" (2 consecutive correct)
 * - correctStreak ≥ 3 → "🔥🔥" (3+ consecutive correct)
 * - wrongStreak = 2 → "🧊" (2 consecutive wrong)
 * - wrongStreak ≥ 3 → "🧊🧊" (3+ consecutive wrong)
 * - Otherwise → "" (no indicator)
 */
export function getStreakIndicator(correctStreak: number, wrongStreak: number): string {
  if (correctStreak >= 3) return "🔥🔥"
  if (correctStreak === 2) return "🔥"
  if (wrongStreak >= 3) return "🧊🧊"
  if (wrongStreak === 2) return "🧊"
  return ""
}
