// packages/shared/src/types.ts
// All shared TypeScript types for the Games of Chance platform

// ── Core Types ─────────────────────────────────────────────────────────────

/** Extensible game type identifier (e.g. "coin-toss", "dice-roll") */
export type GameType = string

/** Session scoring mode — selected by host at room creation */
export type ScoringMode = "grand-prix" | "chips"

// ── Room & Player ──────────────────────────────────────────────────────────

export interface RoomConfig {
  roomId: string
  gameType: GameType
  maxPlayers: number
  scoringMode: ScoringMode
  autoMode: boolean
  autoRoundIntervalMs: number
  /** GrandPrix mode: index 0 = 1st place points, etc. Default: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0] */
  placementPoints: number[]
}

export interface Player {
  /** Original connection ID — stable identity for the player */
  id: string
  name: string
  role: "host" | "player"
  connected: boolean
  /** Current active connection ID (may differ from id after re-link). Null when disconnected. */
  connectionId: string | null
}

// ── Round State Machine ────────────────────────────────────────────────────

/**
 * Valid room phases. NO BETWEEN_ROUNDS phase exists.
 * RESULT transitions directly to PICKING (next round) or LOBBY (game ended).
 */
export type RoundPhase = "LOBBY" | "PICKING" | "RESOLVING" | "RESULT"

export interface RoundState {
  phase: RoundPhase
  roundNumber: number
  pickDeadlineMs: number | null
  /** playerId → game-specific pick (opaque to core) */
  picks: Record<string, unknown>
  /** Game-specific result (opaque to core) */
  result: unknown | null
  resolvedAt: number | null
}

// ── Scoring ────────────────────────────────────────────────────────────────

export interface RoundScoreResult {
  /** playerId → raw score earned this round */
  deltas: Record<string, number>
  /** Optional per-player modifiers for UI display */
  modifiers?: Record<string, ScoreModifier[]>
}

export interface ScoreModifier {
  /** Modifier category (e.g. "streak", "combo", "bonus") */
  type: string
  /** Display label (e.g. "3x Streak!") */
  label: string
  multiplier?: number
}

// ── Session Scoring ────────────────────────────────────────────────────────

export interface SessionUpdate {
  sessionScores: Record<string, number>
  sessionLeaderboard: SessionLeaderboardEntry[]
}

export interface SessionScoringStrategy {
  mode: ScoringMode
  applyGameResult(
    players: Player[],
    gameLeaderboard: GameLeaderboardEntry[],
    rawScores: Record<string, number>
  ): SessionUpdate
}

// ── Leaderboards ───────────────────────────────────────────────────────────

/**
 * Game leaderboard: tracks score within a single game instance.
 * Owned and populated by the GamePlugin. Resets when a new game starts.
 */
export interface GameLeaderboardEntry {
  playerId: string
  playerName: string
  score: number
  rank: number
}

/**
 * Session leaderboard: tracks cumulative points across all games.
 * In GrandPrix mode: placement points from rank table.
 * In Chips mode: raw score accumulation.
 */
export interface SessionLeaderboardEntry {
  playerId: string
  playerName: string
  sessionPoints: number
  gamesPlayed: number
  rank: number
}

// ── Score Adjustment Log ───────────────────────────────────────────────────

export interface AdjustmentLogEntry {
  id: string                    // unique ID (uuid or timestamp-based)
  targetPlayerId: string
  delta: number                 // positive or negative integer
  scoreType: "game" | "session"
  reason: string                // empty string if no reason provided
  timestamp: number             // Date.now() on server
  performedBy: string           // host player ID at time of adjustment
}

// ── Room State (full sync payload) ─────────────────────────────────────────

export interface RoomState {
  room: RoomConfig
  players: Player[]
  round: RoundState
  gameLeaderboard: GameLeaderboardEntry[]
  sessionLeaderboard: SessionLeaderboardEntry[]
  adjustmentLog: AdjustmentLogEntry[]
}

// ── Messages ───────────────────────────────────────────────────────────────

/** Client → Server messages */
export type ClientMessage =
  | { type: "JOIN"; payload: { name: string; role: "host" | "player"; clientId: string; scoringMode?: ScoringMode } }
  | { type: "SUBMIT_PICK"; payload: { pick: unknown } }
  | { type: "START_ROUND"; payload?: never }
  | { type: "END_GAME"; payload?: never }
  | { type: "SKIP_ANIMATION"; payload?: never }
  | { type: "SET_AUTO_MODE"; payload: { enabled: boolean; intervalMs: number } }
  | { type: "KICK_PLAYER"; payload: { playerId: string } }
  | { type: "REASSIGN_HOST"; payload: { targetPlayerId: string } }
  | { type: "ADJUST_SCORE"; payload: { targetPlayerId: string; delta: number; scoreType: "game" | "session"; reason?: string } }
  | { type: "LINK_PLAYER"; payload: { oldPlayerId: string; newConnectionId: string } }
  | { type: "START_SIMULATION"; payload: { playerCount?: number; roundCount?: number; seed?: number } }
  | { type: "STOP_SIMULATION"; payload?: never }

/** Server → Client messages */
export type ServerMessage =
  | { type: "STATE_SYNC"; payload: RoomState }
  | { type: "PICK_ACK"; payload: { playerId: string } }
  | { type: "SKIP_ANIMATION"; payload?: never }
  | { type: "ERROR"; payload: { code: string; message: string } }
