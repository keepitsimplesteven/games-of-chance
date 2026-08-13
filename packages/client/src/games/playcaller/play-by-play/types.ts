// packages/client/src/games/playcaller/play-by-play/types.ts

import type { PlayOutcome } from "../field-utils.types"

/**
 * Outcome category used to select appropriate commentary.
 * Maps from raw PlayOutcome to a broader bucket for message selection.
 */
export type OutcomeCategory =
  | "turnover"
  | "incomplete"
  | "negative"
  | "touchdown"
  | "turnover_on_downs"
  | "big_gain"
  | "first_down"
  | "small_gain"

/**
 * The three sequential phases of play-by-play commentary.
 */
export type CommentaryPhase = "preSnap" | "activePlay" | "outcome"

/**
 * Three-tier commentary structure for the weighted cascade resolution.
 * - playSpecific: messages tied to a specific play definition (60% weight)
 * - circumstance: messages tied to the current game situation (30% weight)
 * - default: generic fallback messages guaranteed to have content (10% weight)
 */
export interface CommentaryTiers {
  playSpecific: Partial<Record<CommentaryPhase, string[]>>
  circumstance: Partial<Record<CommentaryPhase, string[]>>
  default: Record<CommentaryPhase, string[]>
}

/**
 * Outcome-phase commentary keyed by OutcomeCategory.
 */
export type OutcomeMessages = Record<OutcomeCategory, string[]>

/**
 * Play-by-play commentary definition for a single play name.
 * Each phase has an array of possible messages — one is randomly selected.
 * Keys align with CommentaryPhase values.
 */
export interface PlayByPlayMessages {
  /** Lines spoken as the offense lines up / pre-snap read */
  preSnap: string[]
  /** Lines spoken as the play develops */
  activePlay: string[]
  /** Outcome-specific lines keyed by category */
  outcome: Record<OutcomeCategory, string[]>
}

/**
 * Derives an OutcomeCategory from a PlayOutcome and game context.
 * Evaluated in strict precedence order — first matching rule wins.
 */
export function categorizeOutcome(
  outcome: PlayOutcome,
  yardsGained: number,
  yardsToGo: number,
  yardLine: number,
  down: number
): OutcomeCategory {
  // Priority 1: Turnover (interception or fumble)
  if (outcome === "interception" || outcome === "fumble") return "turnover"

  // Priority 2: Incomplete pass
  if (outcome === "incomplete_pass") return "incomplete"

  // Priority 3: Negative yards
  if (yardsGained < 0) return "negative"

  // Priority 4: Touchdown (reached end zone on success/critical_success)
  if (
    yardsGained >= yardLine &&
    (outcome === "success" || outcome === "critical_success")
  )
    return "touchdown"

  // Priority 5: Turnover on downs (4th down, didn't convert)
  // Note: interception/fumble already handled at priority 1, so no need to re-check
  if (down === 4 && yardsGained < yardsToGo) return "turnover_on_downs"

  // Priority 6: Big gain (10+ yards)
  if (yardsGained >= 10) return "big_gain"

  // Priority 7: First down (met yards-to-go but under 10 yards)
  if (yardsGained >= yardsToGo && yardsGained < 10) return "first_down"

  // Priority 8: Small gain (default — positive but didn't meet thresholds)
  return "small_gain"
}
