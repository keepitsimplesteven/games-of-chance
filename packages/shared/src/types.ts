// packages/shared/src/types.ts
// All shared TypeScript types for the Games of Chance platform

import type { CoinTossGameState } from "./games/coin-toss/types"
import type { CoinSide } from "./games/coin-toss/types"
import type { CoinTossCeremonyMatchupState, SideSelection } from "./games/coin-toss/ceremonyTypes"

// ── Core Types ─────────────────────────────────────────────────────────────

/** Extensible game type identifier (e.g. "coin-toss", "dice-roll") */
export type GameType = string

/** Session scoring mode — selected by host at room creation */
export type ScoringMode = "grand-prix" | "chips"

/** Progression mode — selected by host at room creation, orthogonal to ScoringMode */
export type ProgressionMode = "endless" | "tournament"

/** Status of a game tile in tournament mode */
export type TournamentTileStatus = "available" | "locked" | "unavailable"

/** Tournament progress record — tracks completed games in the current session */
export interface TournamentProgress {
  /** Set of gameType identifiers that have been completed and locked */
  completedGames: string[]
  /** Computed availability map for all registered games */
  availability: Record<string, TournamentTileStatus>
}

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
  tuning: Record<string, number | boolean | string | number[]>
  /** Visual theme applied to all players in the room (defaults to "retro-casino") */
  theme?: ThemeId
}

/** Available visual theme identifiers */
export type ThemeId = "pixel-vapor" | "retro-casino"

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
  /** Progression mode — "endless" (default) or "tournament" */
  progressionMode: ProgressionMode
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
export type RoundPhase = "LOBBY" | "SPLASH" | "COIN_TOSS" | "PICKING" | "RESOLVING" | "RESULT" | "END_GAME" | "END_TOURNAMENT"

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
  /** Coin Toss game state — present only during a coin-toss game */
  coinTossGameState?: CoinTossGameState | null
  /** Big Wheel game state — present only during a big-wheel game */
  bigWheelGameState?: BigWheelGameState | null
  /** Playcaller game state — present only during a playcaller game */
  playcallerGameState?: PlaycallerGameState | null
  /** Game votes — gameType → array of player IDs who voted for it */
  gameVotes?: Record<string, string[]>
  /** Tournament progress — present when progressionMode is "tournament" */
  tournamentProgress?: TournamentProgress | null
  /** Pre-game session rank snapshot for risers/fallers display. Key = playerId, value = rank before game started. */
  preGameRanks: Record<string, number>
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
  | { type: "JOIN"; payload: { name: string; role: "host" | "player"; clientId: string; reconnectPlayerId?: string; scoringMode?: ScoringMode; roomSize?: number; progressionMode?: ProgressionMode } }
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
  | { type: "PLAY_SELECTION"; payload: { matchupId: string; play: string } }
  | { type: "COIN_TOSS_CALL"; payload: { matchupId: string; side: CoinSide } }
  | { type: "COIN_TOSS_CHOICE"; payload: { matchupId: string; selection: SideSelection } }

/** Server → Client messages */
export type ServerMessage =
  | { type: "STATE_SYNC"; payload: RoomState }
  | { type: "PICK_ACK"; payload: { playerId: string } }
  | { type: "SKIP_ANIMATION"; payload?: never }
  | { type: "ERROR"; payload: { code: string; message: string } }
  | BattleTickUpdate


// ── Playcaller Tournament ──────────────────────────────────────────────────

/** Playcaller pick — Phase 1: any value accepted (unused) */
export interface PlaycallerPick {
  type: "ready"  // placeholder for Phase 1
}

/** A single matchup in a bracket round */
export interface Matchup {
  /** Unique matchup identifier within the bracket */
  matchupId: string
  /** Seed 1 player (higher seed) */
  playerA: string
  /** Seed 2 player (lower seed) */
  playerB: string
  /** Winner (null if unresolved) */
  winner: string | null
}

/** A single round in the bracket */
export interface BracketRound {
  /** Round index (0 = first round) */
  roundIndex: number
  /** Matchups in this round */
  matchups: Matchup[]
  /** Players with byes this round (first round only) */
  byes: string[]
  /** Whether this round has been resolved */
  resolved: boolean
}

/** Complete bracket state */
export interface Bracket {
  /** All rounds in the bracket */
  rounds: BracketRound[]
  /** Index of the current active round */
  currentRoundIndex: number
  /** Total number of rounds */
  totalRounds: number
  /** Player seed assignments: playerId → seed number (1-based) */
  seeds: Record<string, number>
  /** Eliminated players and the round they were eliminated in */
  eliminated: Record<string, number>
}

/** Result of resolving a bracket round */
export interface PlaycallerRoundResult {
  /** Which bracket round was just resolved */
  bracketRound: number
  /** Resolved matchups with winners */
  matchups: Matchup[]
  /** Whether the tournament is complete (champion found) */
  isComplete: boolean
}

// ── Playcaller Drive State ─────────────────────────────────────────────────

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

/** Complete drive state for a single matchup */
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

/** Playcaller game state broadcast to clients */
export interface PlaycallerGameState {
  /** Full bracket structure */
  bracket: Bracket
  /** Current spectators (eliminated + bye players) */
  spectators: string[]
  /** Active competitors in current round */
  activeCompetitors: string[]
  /** Phase 2: per-matchup drive states. Null when SKIP_GAMEPLAY is true. */
  driveStates?: Record<string, DriveState> | null
  /** Coin toss ceremony states — present during COIN_TOSS phase */
  ceremonyStates?: Record<string, CoinTossCeremonyMatchupState> | null
}

/** Match resolver function signature */
export type MatchResolver = (playerA: string, playerB: string) => string
