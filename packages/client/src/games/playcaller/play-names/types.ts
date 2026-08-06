// packages/client/src/games/playcaller/play-names/types.ts

/** Offensive play identifier — mirrors server-side drive engine types */
export type OffensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Defensive play identifier — mirrors server-side drive engine types */
export type DefensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Game-state classification determining play name and art variant */
export type Circumstance = "standard" | "short_yardage" | "desperation"

/** A single play's display information */
export interface PlayNameEntry {
  displayName: string
  formation: string // e.g. "I-Formation", "Shotgun", "4-3 Under"
}

/** Map of play IDs to their display entries for a given circumstance */
export type PlayNamePool = Record<OffensivePlayId | DefensivePlayId, PlayNameEntry>

/** Complete map of circumstances to play name pools */
export type PlayNameMap = Record<Circumstance, PlayNamePool>
