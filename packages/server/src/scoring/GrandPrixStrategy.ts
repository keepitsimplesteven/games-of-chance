import type {
  Player,
  GameLeaderboardEntry,
  SessionUpdate,
} from "@games-of-chance/shared"
import {
  type SessionScoringStrategy,
  computeSessionRanks,
} from "./SessionScoringStrategy"

/** Default placement points table: index 0 = 1st place, index 1 = 2nd, etc. */
const DEFAULT_PLACEMENT_POINTS = [10, 5, 3, 1, 1, 1, 1, 0, 0, 0]

/**
 * GrandPrix scoring strategy.
 *
 * Awards placement points based solely on final gameLeaderboard rankings
 * and placementPoints table — never from raw scores directly.
 *
 * Produces monotonically increasing session scores (additive only).
 * Tied players get equal rank values in session leaderboard.
 */
export class GrandPrixStrategy implements SessionScoringStrategy {
  mode = "grand-prix" as const
  private placementPoints: number[]

  constructor(placementPoints?: number[]) {
    this.placementPoints = placementPoints ?? DEFAULT_PLACEMENT_POINTS
  }

  applyGameResult(
    players: Player[],
    gameLeaderboard: GameLeaderboardEntry[],
    _rawScores: Record<string, number>
  ): SessionUpdate {
    // Start with current session scores (all zeros for first game)
    const sessionScores: Record<string, number> = {}

    // Initialize all players with 0 (will be added to existing scores in room state)
    for (const player of players) {
      sessionScores[player.id] = 0
    }

    // Award placement points based on gameLeaderboard rank
    for (const entry of gameLeaderboard) {
      const rankIndex = entry.rank - 1 // rank is 1-based, array is 0-based
      const points =
        rankIndex < this.placementPoints.length
          ? this.placementPoints[rankIndex]
          : 0
      sessionScores[entry.playerId] = points
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
