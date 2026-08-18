// packages/client/src/games/playcaller/play-by-play/selectCommentary.ts

import { resolveCommentary } from "./resolver"
import { defaultMessages, playByPlayRegistry } from "./messages"
import { CircumstanceCommentary, CircumstanceActivePlayByAxis } from "./circumstance-messages"
import { matchupMessages } from "./matchup-messages"
import type { PlayAxis } from "./circumstance-messages"
import { categorizeOutcome } from "./types"
import type { CommentaryTiers, CommentaryPhase, OutcomeCategory, MatchupQuality } from "./types"
import type { Circumstance } from "../play-names/types"
import type { PlayByPlayMessages } from "./types"
import type { PlayOutcome, DefensivePlayId, OffensivePlayId } from "../field-utils.types"

export interface CommentaryLines {
  preSnap: string
  activePlay: string
  outcome: string
  /** Indicates if a matchup-quality message was triggered, for text coloring */
  matchupHighlight: MatchupQuality | null
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
 * When a matchup-quality condition is met (defense_read or offense_fooled),
 * matchup messages take highest priority in outcome resolution and
 * matchupHighlight is set for UI coloring.
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
 * @param offensivePlayId - The offensive play slot (e.g. "run-safe")
 * @param defensivePlayId - The defensive play slot (e.g. "pass-aggressive")
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
  playAxis?: PlayAxis,
  offensivePlayId?: OffensivePlayId,
  defensivePlayId?: DefensivePlayId
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

  // Determine matchup quality based on offense/defense axis comparison
  const matchupQuality = determineMatchupQuality(
    offensivePlayId,
    defensivePlayId,
    outcomeCategory
  )

  // Resolve outcome — matchup messages take priority when condition is met
  const outcomeLine = resolveOutcomeCommentary(
    outcomeCategory,
    playMessages,
    matchupQuality,
    playAxis,
    Math.random
  )

  if (!preSnap || !activePlay || !outcomeLine) return null

  // Replace {yards} placeholder with actual yardage (clamped to remaining yardLine)
  const displayYards = yardsGained > 0 ? Math.min(yardsGained, yardLine) : Math.abs(yardsGained)
  const formattedOutcome = outcomeLine.replace(/\{yards\}/g, String(displayYards))

  return {
    preSnap,
    activePlay,
    outcome: formattedOutcome,
    matchupHighlight: matchupQuality,
  }
}

/**
 * Determines the matchup quality based on offense/defense axis alignment
 * and the outcome of the play.
 *
 * - defense_read: defense axis matches offense axis AND play result was non-positive
 *   (turnover, incomplete, negative, turnover_on_downs)
 * - offense_fooled: defense axis is opposite of offense axis AND play gained yards
 *   (big_gain, first_down, small_gain, touchdown)
 */
function determineMatchupQuality(
  offensivePlayId: OffensivePlayId | undefined,
  defensivePlayId: DefensivePlayId | undefined,
  outcomeCategory: OutcomeCategory
): MatchupQuality | null {
  if (!offensivePlayId || !defensivePlayId) return null

  const offenseAxis = offensivePlayId.startsWith("run") ? "run" : "pass"
  const defenseAxis = defensivePlayId.startsWith("run") ? "run" : "pass"

  const nonPositiveOutcomes: OutcomeCategory[] = ["turnover", "incomplete", "negative", "turnover_on_downs"]
  const positiveOutcomes: OutcomeCategory[] = ["big_gain", "first_down", "small_gain", "touchdown"]

  if (defenseAxis === offenseAxis && nonPositiveOutcomes.includes(outcomeCategory)) {
    return "defense_read"
  }

  if (defenseAxis !== offenseAxis && positiveOutcomes.includes(outcomeCategory)) {
    return "offense_fooled"
  }

  return null
}

/**
 * Resolves outcome commentary with matchup-awareness.
 *
 * Priority order when matchup condition is met (~100% fire rate):
 * 1. Play-specific matchupOutcome messages (highest)
 * 2. Generic matchup overlay messages (from matchup-messages.ts)
 * 3. Play-specific outcome messages (60% weight — normal cascade)
 * 4. Default outcome messages (fallback)
 *
 * When no matchup condition: normal cascade (play-specific 60% → default).
 */
function resolveOutcomeCommentary(
  outcomeCategory: OutcomeCategory,
  playMessages: Partial<PlayByPlayMessages> | undefined,
  matchupQuality: MatchupQuality | null,
  playAxis: PlayAxis | undefined,
  rng: () => number
): string {
  // If a matchup condition is met, prioritize matchup messages
  if (matchupQuality) {
    // Priority 1: Play-specific matchup messages
    const playMatchupLines = playMessages?.matchupOutcome?.[matchupQuality]
    if (playMatchupLines && playMatchupLines.length > 0) {
      return playMatchupLines[Math.floor(rng() * playMatchupLines.length)]
    }

    // Priority 2: Generic matchup messages (axis-specific)
    const axis = playAxis ?? "run"
    const genericMatchupLines = matchupMessages[matchupQuality]?.[axis]
    if (genericMatchupLines && genericMatchupLines.length > 0) {
      return genericMatchupLines[Math.floor(rng() * genericMatchupLines.length)]
    }
  }

  // Priority 3: Play-specific outcome messages (60% chance if available)
  const playSpecificLines = playMessages?.outcome?.[outcomeCategory]
  const defaultLines = playByPlayRegistry["Default"].outcome[outcomeCategory]

  if (playSpecificLines && playSpecificLines.length > 0) {
    const roll = rng()
    if (roll < 0.6) {
      return playSpecificLines[Math.floor(rng() * playSpecificLines.length)]
    }
  }

  // Priority 4: Default category-keyed messages (always appropriate)
  if (defaultLines && defaultLines.length > 0) {
    return defaultLines[Math.floor(rng() * defaultLines.length)]
  }

  return ""
}
