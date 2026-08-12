// packages/client/src/games/playcaller/play-by-play/selectCommentary.ts

import { resolveCommentary } from "./resolver"
import { defaultMessages, playByPlayRegistry } from "./messages"
import { CircumstanceCommentary, CircumstanceActivePlayByAxis } from "./circumstance-messages"
import type { PlayAxis } from "./circumstance-messages"
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
 * preSnap and activePlay use the standard 3-tier cascade.
 * activePlay additionally uses axis-specific circumstance messages (run vs. pass)
 * to ensure commentary matches the play type.
 *
 * outcome ALWAYS uses OutcomeCategory-keyed messages to ensure the commentary
 * matches what actually happened on the play.
 *
 * @param displayName - The play's display name (unused in new system, kept for compat)
 * @param playOutcome - The outcome enum from the play result
 * @param yardsGained - Yards gained on the play
 * @param yardsToGo - Yards needed for first down at snap
 * @param yardLine - Distance to end zone at snap
 * @param down - Current down (1–4)
 * @param circumstance - The current game circumstance
 * @param playMessages - Optional play-specific commentary from the PlayDefinition
 * @param playAxis - "run" or "pass" — used to select axis-appropriate circumstance messages
 */
export function selectCommentary(
  displayName: string,
  playOutcome: PlayOutcome,
  yardsGained: number,
  yardsToGo: number,
  yardLine: number,
  down: number,
  circumstance: Circumstance,
  playMessages?: Partial<PlayByPlayMessages>,
  playAxis?: PlayAxis
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

  // Build circumstance tier — use axis-specific activePlay messages when available
  const circumstanceTier: Record<CommentaryPhase, string[]> = {
    ...CircumstanceCommentary[circumstance],
  }
  if (playAxis) {
    const axisMessages = CircumstanceActivePlayByAxis[circumstance]?.[playAxis]
    if (axisMessages && axisMessages.length > 0) {
      circumstanceTier.activePlay = axisMessages
    }
  }

  // Build the three-tier commentary structure for preSnap and activePlay
  const tiers: CommentaryTiers = {
    playSpecific,
    circumstance: circumstanceTier,
    default: defaultMessages,
  }

  // Resolve preSnap and activePlay with the standard 3-tier cascade
  const preSnap = resolveCommentary("preSnap", tiers, outcomeCategory, Math.random)
  const activePlay = resolveCommentary("activePlay", tiers, outcomeCategory, Math.random)

  // Resolve outcome SEPARATELY — always use OutcomeCategory-keyed messages
  // so the commentary matches the actual play result
  const outcomeLine = resolveOutcomeCommentary(outcomeCategory, playMessages, Math.random)

  if (!preSnap || !activePlay || !outcomeLine) return null

  // Replace {yards} placeholder with actual yardage (clamped to remaining yardLine)
  const displayYards = yardsGained > 0 ? Math.min(yardsGained, yardLine) : Math.abs(yardsGained)
  const formattedOutcome = outcomeLine.replace(/\{yards\}/g, String(displayYards))

  return {
    preSnap,
    activePlay,
    outcome: formattedOutcome,
  }
}

/**
 * Resolves outcome commentary using OutcomeCategory-keyed message arrays.
 * Priority: play-specific outcome messages → default registry outcome messages.
 * This ensures the outcome line always describes what actually happened.
 */
function resolveOutcomeCommentary(
  outcomeCategory: OutcomeCategory,
  playMessages: Partial<PlayByPlayMessages> | undefined,
  rng: () => number
): string {
  // Try play-specific outcome messages first (60% chance if available)
  const playSpecificLines = playMessages?.outcome?.[outcomeCategory]
  const defaultLines = playByPlayRegistry["Default"].outcome[outcomeCategory]

  if (playSpecificLines && playSpecificLines.length > 0) {
    const roll = rng()
    if (roll < 0.6) {
      // Use play-specific
      return playSpecificLines[Math.floor(rng() * playSpecificLines.length)]
    }
  }

  // Fall through to default category-keyed messages (always appropriate)
  if (defaultLines && defaultLines.length > 0) {
    return defaultLines[Math.floor(rng() * defaultLines.length)]
  }

  return ""
}
