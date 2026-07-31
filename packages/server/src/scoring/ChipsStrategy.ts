import type {
  Player,
  GameLeaderboardEntry,
  SessionUpdate,
} from "@games-of-chance/shared"
import {
  type SessionScoringStrategy,
  computeSessionRanks,
} from "./SessionScoringStrategy"

/**
 * Chips scoring strategy.
 *
 * Accumulates raw game deltas directly as session points —
 * no rank-based transformation.
 *
 * Produces monotonically increasing session scores (additive only).
 * Tied players get equal rank values in session leaderboard.
 */
export class ChipsStrategy implements SessionScoringStrategy {
  mode = "chips" as const

  applyGameResult(
    players: Player[],
    _gameLeaderboard: GameLeaderboardEntry[],
    rawScores: Record<string, number>
  ): SessionUpdate {
    // Accumulate raw scores directly as session points (delta for this game)
    const sessionScores: Record<string, number> = {}

    for (const player of players) {
      // rawScores contains the total game score for this game
      // Use it directly as the session points delta
      sessionScores[player.id] = rawScores[player.id] ?? 0
    }

    // Build session leaderboard entries
    const entries = players.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      sessionPoints: sessionScores[player.id] ?? 0,
      gamesPlayed: 1, // This represents the delta — room.ts will accumulate
    }))

    const sessionLeaderboard = computeSessionRanks(entries)

    return { sessionScores, sessionLeaderboard }
  }
}
