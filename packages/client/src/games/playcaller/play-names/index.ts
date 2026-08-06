// packages/client/src/games/playcaller/play-names/index.ts

import type { Circumstance, DefensivePlayId, OffensivePlayId, PlayNameEntry } from "./types"
import { offenseNames } from "./offense-names"
import { defenseNames } from "./defense-names"

export { offenseNames } from "./offense-names"
export { defenseNames } from "./defense-names"
export { classifyCircumstance } from "./classify"
export type { Circumstance, DefensivePlayId, OffensivePlayId, PlayNameEntry, PlayNameMap, PlayNamePool } from "./types"

/** Fallback entry returned when a lookup misses (should not happen with valid inputs) */
const FALLBACK_ENTRY: PlayNameEntry = {
  displayName: "Unknown Play",
  formation: "Base",
}

/**
 * Look up the display name and formation for a play based on its ID, the current
 * circumstance, and the player's role (offense or defense).
 *
 * Returns a fallback PlayNameEntry if the combination is not found.
 */
export function getPlayName(
  playId: OffensivePlayId | DefensivePlayId,
  circumstance: Circumstance,
  role: "offense" | "defense"
): PlayNameEntry {
  const pool = role === "offense" ? offenseNames : defenseNames
  const entries = pool[circumstance]
  if (!entries) return FALLBACK_ENTRY
  return entries[playId] ?? FALLBACK_ENTRY
}
