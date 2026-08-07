// packages/client/src/games/playcaller/play-by-play/selectCommentary.ts

import { playByPlayRegistry } from "./messages"
import { categorizeOutcome } from "./types"
import type { OutcomeCategory } from "./types"
import type { PlayOutcome } from "../field-utils.types"

export interface CommentaryLines {
  preSnap: string
  activePlay: string
  outcome: string
}

/**
 * Selects a set of 3 commentary lines for a given play result.
 * Falls back to the "Default" registry entry if no play-specific messages exist.
 * Returns null only if even the Default entry is somehow missing (should never happen).
 *
 * @param displayName - The play's display name (e.g. "Fly Route")
 * @param playOutcome - The outcome enum from the play result
 * @param yardsGained - Yards gained on the play
 * @param yardsToGo - Yards needed for first down at snap
 */
export function selectCommentary(
  displayName: string,
  playOutcome: PlayOutcome,
  yardsGained: number,
  yardsToGo: number
): CommentaryLines | null {
  const messages = playByPlayRegistry[displayName] ?? playByPlayRegistry["Default"]
  if (!messages) return null

  const category: OutcomeCategory = categorizeOutcome(playOutcome, yardsGained, yardsToGo)

  const preSnap = pickRandom(messages.preSnap)
  const activePlay = pickRandom(messages.activePlay)
  const outcomeLines = messages.outcome[category]
  const outcomeLine = outcomeLines?.length ? pickRandom(outcomeLines) : null

  if (!preSnap || !activePlay || !outcomeLine) return null

  // Replace {yards} placeholder with actual yardage
  const formattedOutcome = outcomeLine.replace("{yards}", String(Math.abs(yardsGained)))

  return {
    preSnap,
    activePlay,
    outcome: formattedOutcome,
  }
}

/** Picks a random element from an array */
function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}
