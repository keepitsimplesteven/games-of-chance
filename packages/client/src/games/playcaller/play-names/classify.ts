// packages/client/src/games/playcaller/play-names/classify.ts

import type { Circumstance } from "./types"

/**
 * Classifies the current game situation into a Circumstance based on down and yards to go.
 *
 * - "short_yardage": yardsToGo <= 3
 * - "desperation": 4th down with yardsToGo > 5
 * - "standard": all other situations
 */
export function classifyCircumstance(down: number, yardsToGo: number): Circumstance {
  if (yardsToGo <= 3) return "short_yardage"
  if (down === 4 && yardsToGo > 5) return "desperation"
  return "standard"
}
