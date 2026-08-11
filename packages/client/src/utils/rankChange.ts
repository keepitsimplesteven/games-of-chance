import type { SessionLeaderboardEntry } from "@games-of-chance/shared"

export interface RankChange {
  playerId: string
  delta: number // positive = improved, negative = worsened, 0 = unchanged
}

/**
 * Compute rank changes by comparing pre-game snapshot ranks to current session ranks.
 * Returns positive delta for risers, negative for fallers, 0 for unchanged.
 */
export function computeRankChanges(
  preGameRanks: Record<string, number>,
  currentSessionLeaderboard: SessionLeaderboardEntry[]
): Record<string, number> {
  const changes: Record<string, number> = {}
  for (const entry of currentSessionLeaderboard) {
    const preRank = preGameRanks[entry.playerId]
    if (preRank === undefined) {
      changes[entry.playerId] = 0 // joined mid-session, no indicator
    } else {
      changes[entry.playerId] = preRank - entry.rank // positive = improved
    }
  }
  return changes
}
