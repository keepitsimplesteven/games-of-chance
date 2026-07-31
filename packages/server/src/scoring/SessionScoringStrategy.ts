import type {
  Player,
  GameLeaderboardEntry,
  SessionLeaderboardEntry,
  SessionUpdate,
  ScoringMode,
} from "@games-of-chance/shared"

/**
 * Server-side session scoring strategy interface.
 * Mirrors the shared type but serves as the concrete contract for server implementations.
 */
export interface SessionScoringStrategy {
  mode: ScoringMode
  applyGameResult(
    players: Player[],
    gameLeaderboard: GameLeaderboardEntry[],
    rawScores: Record<string, number>
  ): SessionUpdate
}

/**
 * Compute ranks for session leaderboard entries.
 * Tied players (same sessionPoints) receive equal rank values.
 */
export function computeSessionRanks(
  entries: Omit<SessionLeaderboardEntry, "rank">[]
): SessionLeaderboardEntry[] {
  // Sort by sessionPoints descending
  const sorted = [...entries].sort((a, b) => b.sessionPoints - a.sessionPoints)

  const ranked: SessionLeaderboardEntry[] = []
  for (let i = 0; i < sorted.length; i++) {
    // Tied players get the same rank
    const rank =
      i > 0 && sorted[i].sessionPoints === sorted[i - 1].sessionPoints
        ? ranked[i - 1].rank
        : i + 1

    ranked.push({ ...sorted[i], rank })
  }

  return ranked
}
