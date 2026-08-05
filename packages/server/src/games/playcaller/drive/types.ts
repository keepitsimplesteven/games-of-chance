/** Axis classification for plays */
export type PlayAxis = "run" | "pass"
export type PlayStyle = "safe" | "aggressive"

/** Offensive play identifier */
export type OffensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Defensive play identifier */
export type DefensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Base stats for an offensive play */
export interface OffensivePlayStats {
  id: OffensivePlayId
  name: string
  axis: PlayAxis
  style: PlayStyle
  successRate: number // 0-1
  yardageRange: { min: number; max: number }
  criticalSuccessChance: number // 0-1
  criticalFailureChance: number // 0-1
}

/** Modifier applied by a defensive play to an offensive play's stats */
export interface DefensiveModifier {
  successRateMod: number // additive, -1 to 1
  yardageMinMod: number // additive integer
  yardageMaxMod: number // additive integer
  critSuccessMod: number // additive, -1 to 1
  critFailureMod: number // additive, -1 to 1
}

/** Defensive play definition */
export interface DefensivePlayDef {
  id: DefensivePlayId
  name: string
  axis: PlayAxis
  style: PlayStyle
}

/** Complete play configuration */
export interface PlayConfig {
  offensivePlays: Record<OffensivePlayId, OffensivePlayStats>
  defensivePlays: Record<DefensivePlayId, DefensivePlayDef>
}

/** 4×4 matrix of defensive modifiers keyed by "offId:defId" */
export type PlayMatrix = Record<`${OffensivePlayId}:${DefensivePlayId}`, DefensiveModifier>

/** Injectable RNG function — returns a value in [0, 1) */
export type RngFunction = () => number

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
  winner: string // player ID
  loser: string // player ID
  endingType: DriveEndingType
  finalState: DriveState
}

/** Complete drive state */
export interface DriveState {
  offensePlayerId: string
  defensePlayerId: string
  yardLine: number // yards to end zone (0 = TD)
  down: number // 1-4
  yardsToGo: number // yards needed for first down
  playHistory: PlayHistoryEntry[]
  isComplete: boolean
  completion: DriveCompletion | null
}

// --- Custom Error Classes ---

/** Thrown when an invalid OffensivePlayId or DefensivePlayId is passed to resolveDown */
export class InvalidPlayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidPlayError"
  }
}

/** Thrown when resolveDown is called on a completed drive */
export class DriveCompleteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DriveCompleteError"
  }
}

/** Thrown when createDriveState is called with the same player for both sides */
export class InvalidPlayerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidPlayerError"
  }
}

/** Thrown when createDriveState is called with equal seeds */
export class InvalidSeedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidSeedError"
  }
}
