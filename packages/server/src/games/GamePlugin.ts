import type { Player, GameLeaderboardEntry, RoundScoreResult, GameType, SettingsSchema, GameSettings, TournamentProgress } from "@games-of-chance/shared"

/**
 * Interface that each game plugin must implement.
 * Plugins are scoring-model-agnostic — they report raw deltas,
 * and the session layer interprets them based on ScoringMode.
 */
export interface GamePlugin<TPick = unknown, TResult = unknown> {
  /** Identifier for this game type (e.g. "coin-toss") */
  gameType: GameType

  /** Optional schema describing configurable fields for this game */
  settingsSchema?: SettingsSchema

  /** Validate a player's pick before accepting it */
  validatePick(pick: unknown): pick is TPick

  /** Compute the round result server-side using active game settings */
  resolveRound(picks: Record<string, TPick>, settings: GameSettings): TResult

  /**
   * Determine which players scored this round and by how much.
   * Returns RoundScoreResult with raw deltas and optional modifiers.
   * Uses active game settings for configured tuning values.
   */
  scoreRound(
    picks: Record<string, TPick>,
    result: TResult,
    players: Player[],
    settings: GameSettings
  ): RoundScoreResult

  /**
   * Produce the final ranked game leaderboard.
   * Used by GrandPrix mode to determine placement points.
   * In Chips mode, rank is informational only.
   */
  computeGameLeaderboard(
    players: Player[],
    gameScores: Record<string, number>
  ): GameLeaderboardEntry[]

  /** How long the pick window stays open (ms) */
  pickWindowMs: number

  /** Whether this game is the tournament finale (default: false) */
  isFinale?: boolean

  /**
   * Custom unlock criteria for tournament mode.
   * Receives the current tournament progress and returns whether this game is playable.
   * If not defined, defaults to: available when not in completedGames.
   */
  unlockCriteria?: (progress: TournamentProgress) => boolean
}
