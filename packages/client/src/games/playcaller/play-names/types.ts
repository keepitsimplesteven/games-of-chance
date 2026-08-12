// packages/client/src/games/playcaller/play-names/types.ts

import type { PlayArtData } from "../play-art/types"
import type { PlayByPlayMessages } from "../play-by-play/types"

/** Offensive play identifier — mirrors server-side drive engine types */
export type OffensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Defensive play identifier — mirrors server-side drive engine types */
export type DefensivePlayId = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** Game-state classification determining play name and art variant */
export type Circumstance =
  | "standard"
  | "short_yardage"
  | "medium_yardage"
  | "long_yardage"
  | "desperation"
  | "goal_line"
  | "must_convert"

/** One of the four mechanical play identifiers */
export type PlaySlot = "run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"

/** A play definition associating display info, valid circumstances, weight, and optional commentary */
export interface PlayDefinition {
  /** Display name shown on play card (1–50 chars) */
  displayName: string
  /** Formation label (1–30 chars) */
  formation: string
  /** Which circumstances this play is valid for */
  circumstances: Circumstance[]
  /** Play art data rendered on the play card */
  playArt: PlayArtData
  /** Relative selection weight, > 0, default 1 */
  weight?: number
  /** Optional play-specific commentary (partial — any subset of phases) */
  messages?: Partial<PlayByPlayMessages>
}

/** Pool of play definitions indexed by slot */
export type PlayPool = Record<PlaySlot, PlayDefinition[]>

/** Complete registry: role → PlayPool */
export interface PlayPoolRegistry {
  offense: PlayPool
  defense: PlayPool
}
