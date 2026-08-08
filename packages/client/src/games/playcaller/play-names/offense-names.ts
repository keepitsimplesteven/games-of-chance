// packages/client/src/games/playcaller/play-names/offense-names.ts

import type { Circumstance, OffensivePlayId, PlayNameEntry } from "./types"

/**
 * Offensive play name pool: 4 plays × 3 circumstances = 12 entries.
 * Names and formations shift based on the game situation to feel contextually appropriate.
 */
export const offenseNames: Record<Circumstance, Record<OffensivePlayId, PlayNameEntry>> = {
  standard: {
    "run-safe": { displayName: "HB Dive", formation: "I-Formation" },
    "run-aggressive": { displayName: "Stretch Run", formation: "Spread" },
    "pass-safe": { displayName: "Slant Route", formation: "Shotgun" },
    "pass-aggressive": { displayName: "Fly Route", formation: "Shotgun Spread" },
  },
  short_yardage: {
    "run-safe": { displayName: "QB Sneak", formation: "Under Center" },
    "run-aggressive": { displayName: "Power Sweep", formation: "I-Formation" },
    "pass-safe": { displayName: "Quick Out", formation: "Under Center" },
    "pass-aggressive": { displayName: "Fade", formation: "Shotgun" },
  },
  desperation: {
    "run-safe": { displayName: "Draw Play", formation: "Shotgun" },
    "run-aggressive": { displayName: "Reverse", formation: "Shotgun" },
    "pass-safe": { displayName: "Screen Pass", formation: "Shotgun" },
    "pass-aggressive": { displayName: "Hail Mary", formation: "Shotgun Empty" },
  },
}
