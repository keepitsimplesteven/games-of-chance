import type { Player, GameLeaderboardEntry, RoundScoreResult, GameType } from "@games-of-chance/shared";
/**
 * Interface that each game plugin must implement.
 * Plugins are scoring-model-agnostic — they report raw deltas,
 * and the session layer interprets them based on ScoringMode.
 */
export interface GamePlugin<TPick = unknown, TResult = unknown> {
    /** Identifier for this game type (e.g. "coin-toss") */
    gameType: GameType;
    /** Validate a player's pick before accepting it */
    validatePick(pick: unknown): pick is TPick;
    /** Compute the round result server-side */
    resolveRound(picks: Record<string, TPick>): TResult;
    /**
     * Determine which players scored this round and by how much.
     * Returns RoundScoreResult with raw deltas and optional modifiers.
     */
    scoreRound(picks: Record<string, TPick>, result: TResult, players: Player[]): RoundScoreResult;
    /**
     * Produce the final ranked game leaderboard.
     * Used by GrandPrix mode to determine placement points.
     * In Chips mode, rank is informational only.
     */
    computeGameLeaderboard(players: Player[], gameScores: Record<string, number>): GameLeaderboardEntry[];
    /** How long the pick window stays open (ms) */
    pickWindowMs: number;
}
