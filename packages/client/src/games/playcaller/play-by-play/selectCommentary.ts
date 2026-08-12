// packages/client/src/games/playcaller/play-by-play/selectCommentary.ts

import { resolveCommentary } from "./resolver"
import { defaultMessages } from "./messages"
import { CircumstanceCommentary } from "./circumstance-messages"
import { categorizeOutcome } from "./types"
import type { CommentaryTiers, CommentaryPhase, OutcomeCategory } from "./types"
import type { Circumstance } from "../play-names/types"
import type { PlayByPlayMessages } from "./types"
import type { PlayOutcome } from "../field-utils.types"

export interface CommentaryLines {
  preSnap: string
  activePlay: string
  outcome: string
}

/**
 * Selects a set of 3 commentary lines for a given play result using the
 * 3-tier weighted cascade: play-specific (60%) → circumstance (30%) → default (10%).
 *
 * Each phase (preSnap, activePlay, outcome) is resolved independently with its own
 * tier roll. The outcome phase uses the computed OutcomeCategory to key into
 * play-specific outcome messages.
 *
 * @param displayName - The play's display name (unused in new system, kept for compat)
 * @param playOutcome - The outcome enum from the play result
 * @param yardsGained - Yards gained on the play
 * @param yardsToGo - Yards needed for first down at snap
 * @param yardLine - Distance to end zone at snap
 * @param down - Current down (1–4)
 * @param circumstance - The current game circumstance
 * @param playMessages - Optional play-specific commentary from the PlayDefinition
 */
export function selectCommentary(
  displayName: string,
  playOutcome: PlayOutcome,
  yardsGained: number,
  yardsToGo: number,
  yardLine: number,
  down: number,
  circumstance: Circumstance,
  playMessages?: Partial<PlayByPlayMessages>
): CommentaryLines | null {
  // Compute the outcome category for the outcome phase
  const outcomeCategory: OutcomeCategory = categorizeOutcome(
    playOutcome,
    yardsGained,
    yardsToGo,
    yardLine,
    down
  )

  // Build play-specific tier from the PlayDefinition's messages
  const playSpecific: Partial<Record<CommentaryPhase, string[]>> = {}
  if (playMessages) {
    if (playMessages.preSnap && playMessages.preSnap.length > 0) {
      playSpecific.preSnap = playMessages.preSnap
    }
    if (playMessages.activePlay && playMessages.activePlay.length > 0) {
      playSpecific.activePlay = playMessages.activePlay
    }
    if (playMessages.outcome) {
      // Pick the messages for the specific outcomeCategory
      const outcomeLines = playMessages.outcome[outcomeCategory]
      if (outcomeLines && outcomeLines.length > 0) {
        playSpecific.outcome = outcomeLines
      }
    }
  }

  // Build the three-tier commentary structure
  const tiers: CommentaryTiers = {
    playSpecific,
    circumstance: CircumstanceCommentary[circumstance],
    default: defaultMessages,
  }

  // Resolve each phase independently with its own tier roll
  const preSnap = resolveCommentary("preSnap", tiers, outcomeCategory, Math.random)
  const activePlay = resolveCommentary("activePlay", tiers, outcomeCategory, Math.random)
  const outcomeLine = resolveCommentary("outcome", tiers, outcomeCategory, Math.random)

  if (!preSnap || !activePlay || !outcomeLine) return null

  // Replace {yards} placeholder with actual yardage
  const formattedOutcome = outcomeLine.replace("{yards}", String(Math.abs(yardsGained)))

  return {
    preSnap,
    activePlay,
    outcome: formattedOutcome,
  }
}
