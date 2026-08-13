// packages/client/src/games/playcaller/play-names/classify.ts

import type { Circumstance } from "./types"

/**
 * Classifies the current game situation into a Circumstance based on
 * down, yards-to-go, and yard-line.
 *
 * Priority rules (first match wins):
 * 1. goal_line:      yardLine <= 5
 * 2. desperation:    down === 4 && yardsToGo >= 4
 * 3. must_convert:   down === 4 && yardsToGo >= 1 && yardsToGo <= 3
 * 4. short_yardage:  yardsToGo <= 2
 * 5. medium_yardage: yardsToGo >= 3 && yardsToGo <= 5
 * 6. long_yardage:   yardsToGo >= 6 && yardsToGo <= 9
 * 7. standard:       otherwise
 *
 * This function is pure — same inputs always produce the same output,
 * no mutation, no side effects.
 */
export function classifyCircumstance(
  down: number,
  yardsToGo: number,
  yardLine: number
): Circumstance {
  // Priority 1: Goal line takes precedence over everything
  if (yardLine <= 5) return "goal_line"

  // Priority 2–3: 4th down situations
  if (down === 4 && yardsToGo >= 4) return "desperation"
  if (down === 4 && yardsToGo >= 1 && yardsToGo <= 3) return "must_convert"

  // Priority 4–6: Yardage-based classification
  if (yardsToGo <= 2) return "short_yardage"
  if (yardsToGo >= 3 && yardsToGo <= 5) return "medium_yardage"
  if (yardsToGo >= 6 && yardsToGo <= 9) return "long_yardage"

  // Priority 7: Default
  return "standard"
}
