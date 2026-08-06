// packages/client/src/games/playcaller/play-names/defense-names.ts

import type { Circumstance, DefensivePlayId, PlayNameEntry } from "./types"

/**
 * Defensive play name pool: 4 plays × 3 circumstances = 12 entries.
 * Names and formations shift based on the game situation to feel contextually appropriate.
 */
export const defenseNames: Record<Circumstance, Record<DefensivePlayId, PlayNameEntry>> = {
  standard: {
    "run-safe": { displayName: "Cover 2", formation: "4-3" },
    "run-aggressive": { displayName: "Run Blitz", formation: "4-3 Under" },
    "pass-safe": { displayName: "Cover 3 Zone", formation: "3-4" },
    "pass-aggressive": { displayName: "All-Out Blitz", formation: "3-3-5" },
  },
  short_yardage: {
    "run-safe": { displayName: "Goal Line Stack", formation: "5-2" },
    "run-aggressive": { displayName: "A-Gap Blitz", formation: "4-4" },
    "pass-safe": { displayName: "Flat Zone", formation: "4-3" },
    "pass-aggressive": { displayName: "Corner Blitz", formation: "3-4" },
  },
  desperation: {
    "run-safe": { displayName: "Prevent", formation: "3-3-5" },
    "run-aggressive": { displayName: "Spy Coverage", formation: "4-2-5" },
    "pass-safe": { displayName: "Deep Cover 4", formation: "3-3-5" },
    "pass-aggressive": { displayName: "Hail Mary D", formation: "2-4-5" },
  },
}
