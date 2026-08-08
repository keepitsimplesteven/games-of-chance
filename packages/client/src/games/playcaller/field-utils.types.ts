// packages/client/src/games/playcaller/field-utils.types.ts
// Minimal type definitions for field utility functions.
// These mirror the server-side drive engine types that will arrive via
// room state broadcasts. Once task 8.7 re-exports from shared, these
// can be replaced with imports from @games-of-chance/shared.

/** Offensive play identifier */
export type OffensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Defensive play identifier */
export type DefensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Outcome type for a single play */
export type PlayOutcome =
  | "success"
  | "critical_success"
  | "incomplete_pass"
  | "tackle_for_loss"
  | "interception"
  | "fumble"

/** Result of resolving a single down */
export interface PlayResult {
  outcome: PlayOutcome
  yardsGained: number
  playByPlayText: string
  offensivePlay: OffensivePlayId
  defensivePlay: DefensivePlayId
}

/** A single entry in the play history */
export interface PlayHistoryEntry {
  down: number
  yardsToGo: number
  yardLine: number
  offensivePlay: OffensivePlayId
  defensivePlay: DefensivePlayId
  result: PlayResult
  resultingYardLine: number
}

/** How the drive ended */
export type DriveEndingType = "touchdown" | "interception" | "fumble" | "turnover_on_downs"

/** Completion status of a finished drive */
export interface DriveCompletion {
  winner: string
  loser: string
  endingType: DriveEndingType
  finalState?: DriveState
}

/** Complete drive state (client-side mirror of server type) */
export interface DriveState {
  offensePlayerId: string
  defensePlayerId: string
  yardLine: number
  down: number
  yardsToGo: number
  playHistory: PlayHistoryEntry[]
  isComplete: boolean
  completion: DriveCompletion | null
}
