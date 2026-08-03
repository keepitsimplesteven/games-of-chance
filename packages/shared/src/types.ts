// packages/shared/src/types.ts
// All shared TypeScript types for the Games of Chance platform

// ── Core Types ─────────────────────────────────────────────────────────────

/** Extensible game type identifier (e.g. "coin-toss", "dice-roll") */
export type GameType = string

/** Session scoring mode — selected by host at room creation */
export type ScoringMode = "grand-prix" | "chips"

// ── Settings Schema ────────────────────────────────────────────────────────

/** A single configurable field in a game plugin's settings schema */
export interface SettingsFieldSchema {
  /** Unique key — must match the constant name in the plugin's constants file */
  key: string
  /** Human-readable label for the UI */
  label: string
  /** Field type determines which input control is rendered */
  type: "number" | "boolean" | "select"
  /** Default value (matches the plugin constant's value) */
  defaultValue: number | boolean | string
  /** Validation constraints (type-specific) */
  constraints?: {
    min?: number
    max?: number
    step?: number
    /** For "select" type only */
    options?: { label: string; value: string }[]
  }
}

/** The full settings schema a plugin may declare */
export type SettingsSchema = SettingsFieldSchema[]

/** Resolved game settings — defaults merged with host overrides */
export interface GameSettings {
  /** Number of rounds per game */
  roundCount: number
  /** Duration of the pick window in milliseconds */
  pickWindowMs: number
  /** Game-specific tuning constants (keyed by constant name) */
  tuning: Record<string, number | boolean | string>
}

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
  /** Total number of player slots (humans + bots). Integer 2–10, default 4. */
  roomSize: number
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
export type RoundPhase = "LOBBY" | "PICKING" | "RESOLVING" | "RESULT" | "END_GAME"

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
  /** Current correct streak length (0 = no streak) */
  streak?: number
  /** Current wrong streak length (0 = no streak) */
  coldStreak?: number
  /** Multiplier applied in the most recent round (for UI display) */
  lastMultiplier?: number
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
  /** Resolved game settings — shared + game-specific tuning */
  gameSettings: GameSettings
  /** Whether settings are currently locked (active game in progress) */
  settingsLocked: boolean
  /** Big Wheel game state — present only during a big-wheel game */
  bigWheelGameState?: BigWheelGameState | null
  /** Game votes — gameType → array of player IDs who voted for it */
  gameVotes?: Record<string, string[]>
}

// ── Battle Bots ────────────────────────────────────────────────────────────

/** HP snapshot for a single battle, sent as part of a tick update */
export interface BattleHPSnapshot {
  battleId: string
  robots: { ownerId: string; currentHp: number; eliminated: boolean }[]
}

/** Tick update sent to clients during battle-bots battles */
export interface BattleTickUpdate {
  type: "BATTLE_TICK"
  payload: {
    tick: number
    battles: BattleHPSnapshot[]
  }
}

// ── Big Wheel ──────────────────────────────────────────────────────────────

/** Big Wheel pick — the only action is to trigger a spin */
export interface BigWheelPick {
  type: "spin"
}

/** Big Wheel spin result — sent as round result in STATE_SYNC */
export interface BigWheelSpinResult {
  spinnerPlayerId: string
  spinNumber: 1 | 2
  reelIndex: number
  value: number
  spinTotal: number | null  // null until both spins complete
}

/** Big Wheel game state included in STATE_SYNC for client rendering */
export interface BigWheelGameState {
  spinOrder: string[]
  currentTurnIndex: number
  currentSpinNumber: 1 | 2
  activeSpinnerId: string
  spinResults: Record<string, number[]>  // playerId → [spin1, spin2?]
  reelStrip: number[]
}

// ── Messages ───────────────────────────────────────────────────────────────

/** Client → Server messages */
export type ClientMessage =
  | { type: "JOIN"; payload: { name: string; role: "host" | "player"; clientId: string; scoringMode?: ScoringMode; roomSize?: number } }
  | { type: "SUBMIT_PICK"; payload: { pick: unknown } }
  | { type: "START_ROUND"; payload?: never }
  | { type: "END_GAME"; payload?: never }
  | { type: "SKIP_ANIMATION"; payload?: never }
  | { type: "SET_AUTO_MODE"; payload: { enabled: boolean; intervalMs: number } }
  | { type: "KICK_PLAYER"; payload: { playerId: string } }
  | { type: "REASSIGN_HOST"; payload: { targetPlayerId: string } }
  | { type: "ADJUST_SCORE"; payload: { targetPlayerId: string; delta: number; scoreType: "game" | "session"; reason?: string } }
  | { type: "LINK_PLAYER"; payload: { oldPlayerId: string; newConnectionId: string } }
  | { type: "UPDATE_SETTINGS"; payload: { changes: Partial<GameSettings> } }
  | { type: "SET_GAME_TYPE"; payload: { gameType: GameType } }
  | { type: "START_SIMULATION"; payload: { playerCount?: number; roundCount?: number; seed?: number } }
  | { type: "STOP_SIMULATION"; payload?: never }
  | { type: "UPDATE_ROOM_SIZE"; payload: { roomSize: number } }
  | { type: "RETURN_TO_LOBBY"; payload?: never }
  | { type: "VOTE_GAME"; payload: { gameType: GameType } }

/** Server → Client messages */
export type ServerMessage =
  | { type: "STATE_SYNC"; payload: RoomState }
  | { type: "PICK_ACK"; payload: { playerId: string } }
  | { type: "SKIP_ANIMATION"; payload?: never }
  | { type: "ERROR"; payload: { code: string; message: string } }
  | BattleTickUpdate
