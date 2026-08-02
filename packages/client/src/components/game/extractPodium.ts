/**
 * Pure utility function that extracts podium positions from a game leaderboard.
 *
 * Given a leaderboard (which may be in any order), returns:
 * - center: the entry with rank 1 (1st place)
 * - left: the entry with rank 2 (2nd place)
 * - right: the entry with rank 3 (3rd place)
 * - remaining: all entries with rank 4+ in ascending rank order
 *
 * Validates: Requirements 5.3, 5.4
 */

export interface PodiumEntry {
  playerId: string
  playerName: string
  score: number
  rank: number
  [key: string]: unknown
}

export interface PodiumLayout<T extends PodiumEntry> {
  center: T // rank 1
  left: T // rank 2
  right: T // rank 3
  remaining: T[] // rank 4+ in ascending order
}

/**
 * Extracts podium layout positions from a leaderboard.
 *
 * Sorts the leaderboard by rank ascending, then assigns:
 * - sorted[0] → center (rank 1, 1st place)
 * - sorted[1] → left (rank 2, 2nd place)
 * - sorted[2] → right (rank 3, 3rd place)
 * - sorted[3..N] → remaining (in ascending rank order)
 *
 * Requires at least 3 entries. For fewer entries, use the FinalResultsScreen
 * component's edge-case handling directly.
 */
export function extractPodium<T extends PodiumEntry>(leaderboard: T[]): PodiumLayout<T> {
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank)

  return {
    center: sorted[0], // rank 1
    left: sorted[1], // rank 2
    right: sorted[2], // rank 3
    remaining: sorted.slice(3), // rank 4+ in ascending order
  }
}
