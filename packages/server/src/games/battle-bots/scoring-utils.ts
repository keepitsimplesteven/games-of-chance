import type { GameLeaderboardEntry } from "@games-of-chance/shared"

/**
 * Filters bot persona IDs from score deltas.
 * Bot personas participate in battles but must not appear in scoring outputs.
 */
export function filterBotPersonasFromDeltas(
  deltas: Record<string, number>,
  botPersonaIds: Set<string>
): Record<string, number> {
  const filtered: Record<string, number> = {}
  for (const [id, delta] of Object.entries(deltas)) {
    if (!botPersonaIds.has(id)) {
      filtered[id] = delta
    }
  }
  return filtered
}

/**
 * Filters bot persona entries from the game leaderboard.
 * Bot personas hold bracket positions but must not appear in leaderboard results.
 */
export function filterBotPersonasFromLeaderboard(
  leaderboard: GameLeaderboardEntry[],
  botPersonaIds: Set<string>
): GameLeaderboardEntry[] {
  return leaderboard.filter((entry) => !botPersonaIds.has(entry.playerId))
}
