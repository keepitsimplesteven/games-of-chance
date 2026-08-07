// packages/client/src/games/playcaller/play-by-play/types.ts

import type { PlayOutcome } from "../field-utils.types"

/**
 * Outcome category used to select appropriate commentary.
 * Maps from raw PlayOutcome to a broader bucket for message selection.
 */
export type OutcomeCategory =
  | "small_gain"
  | "big_gain"
  | "touchdown"
  | "incomplete"
  | "negative"
  | "turnover"

/**
 * Play-by-play commentary definition for a single play name.
 * Each phase has an array of possible messages — one is randomly selected.
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
 * Derives an OutcomeCategory from a PlayOutcome + yardsGained.
 */
export function categorizeOutcome(
  outcome: PlayOutcome,
  yardsGained: number,
  yardsToGo: number
): OutcomeCategory {
  if (outcome === "interception" || outcome === "fumble") return "turnover"
  if (outcome === "incomplete_pass") return "incomplete"
  if (outcome === "tackle_for_loss") return "negative"
  // Touchdown: ball reached end zone (yardsGained >= yardLine, roughly)
  if (outcome === "critical_success" && yardsGained >= 35) return "touchdown"
  if (yardsGained >= 10) return "big_gain"
  if (yardsGained >= yardsToGo) return "big_gain"
  return "small_gain"
}
