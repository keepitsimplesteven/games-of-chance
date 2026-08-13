// packages/client/src/games/playcaller/play-by-play/resolver.ts

import type { CommentaryPhase, CommentaryTiers, OutcomeCategory } from "./types"

/**
 * Resolves a single commentary string for the given phase using the 3-tier
 * weighted cascade: play-specific (60%) → circumstance (30%) → default (10%).
 *
 * Algorithm:
 * 1. Roll tier using rng(): < 0.6 → play-specific, < 0.9 → circumstance, else → default
 * 2. Look up messages for the current phase in the selected tier
 * 3. If the selected tier is empty for this phase, cascade downward until a populated tier is found
 * 4. Pick uniformly from the resolved tier's message array
 *
 * This function is pure — it does not mutate inputs or access DriveState.
 *
 * @param phase - The commentary phase to resolve (preSnap, activePlay, outcome)
 * @param tiers - The three-tier commentary structure
 * @param outcomeCategory - The outcome category (reserved for future use, currently unused)
 * @param rng - A function returning a number in [0, 1) for random selection
 * @returns A commentary string from the resolved tier
 */
export function resolveCommentary(
  phase: CommentaryPhase,
  tiers: CommentaryTiers,
  outcomeCategory: OutcomeCategory | null,
  rng: () => number
): string {
  // Step 1: Roll to select initial tier
  const roll = rng()

  let messages: string[] | undefined

  if (roll < 0.6) {
    // Try play-specific first
    messages = getMessages(tiers.playSpecific, phase)
    if (!messages || messages.length === 0) {
      // Cascade: try circumstance
      messages = getMessages(tiers.circumstance, phase)
    }
    if (!messages || messages.length === 0) {
      // Cascade: fall through to default
      messages = tiers.default[phase]
    }
  } else if (roll < 0.9) {
    // Try circumstance first
    messages = getMessages(tiers.circumstance, phase)
    if (!messages || messages.length === 0) {
      // Cascade: fall through to default
      messages = tiers.default[phase]
    }
  } else {
    // Default tier (always populated by contract)
    messages = tiers.default[phase]
  }

  // Safety: if somehow we still have no messages, return empty string
  if (!messages || messages.length === 0) {
    return ""
  }

  // Step 4: Pick uniformly from the resolved message array
  return messages[Math.floor(rng() * messages.length)]
}

/**
 * Retrieves messages from a partial tier record for the given phase.
 * Returns undefined if the phase key doesn't exist or the array is empty.
 */
function getMessages(
  tier: Partial<Record<CommentaryPhase, string[]>>,
  phase: CommentaryPhase
): string[] | undefined {
  const msgs = tier[phase]
  if (msgs && msgs.length > 0) return msgs
  return undefined
}
