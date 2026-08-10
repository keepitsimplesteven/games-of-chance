import type { SessionLeaderboardEntry } from "@games-of-chance/shared"

/**
 * Fisher-Yates shuffle — mutates the array in place.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/**
 * Determines the spin order for a Big Wheel game.
 *
 * Players are sorted by their session leaderboard rank in DESCENDING order
 * (last place spins first, first place spins last). This creates more
 * dramatic lead changes and comeback narratives throughout the game.
 * Players sharing the same rank are shuffled randomly using a Fisher-Yates
 * shuffle within their tied group.
 *
 * @param playerIds - Array of player IDs participating in the game
 * @param sessionLeaderboard - Current session leaderboard entries
 * @returns Ordered array of player IDs representing spin order
 */
export function determineSpinOrder(
  playerIds: string[],
  sessionLeaderboard: SessionLeaderboardEntry[]
): string[] {
  // Build a rank lookup: playerId → rank
  const rankMap = new Map<string, number>()
  for (const entry of sessionLeaderboard) {
    rankMap.set(entry.playerId, entry.rank)
  }

  // Assign a fallback rank for players not on the leaderboard (e.g. new players).
  // They get rank 0 so they spin first (they have no standing yet).
  const maxRank = sessionLeaderboard.length > 0
    ? Math.max(...sessionLeaderboard.map((e) => e.rank))
    : 0
  const fallbackRank = maxRank + 1

  // Sort players by rank DESCENDING (last place first → first place last)
  const sorted = [...playerIds].sort((a, b) => {
    const rankA = rankMap.get(a) ?? fallbackRank
    const rankB = rankMap.get(b) ?? fallbackRank
    return rankB - rankA
  })

  // Group players by rank
  const groups: string[][] = []
  let currentGroup: string[] = []
  let currentRank: number | null = null

  for (const playerId of sorted) {
    const rank = rankMap.get(playerId) ?? fallbackRank
    if (rank !== currentRank) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
      }
      currentGroup = [playerId]
      currentRank = rank
    } else {
      currentGroup.push(playerId)
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // Shuffle within each tied group
  for (const group of groups) {
    shuffle(group)
  }

  // Flatten groups back into ordered list
  return groups.flat()
}
