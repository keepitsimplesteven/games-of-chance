import type { FFABracketState, FinalRanking } from "../types"

/** Participant info needed to populate ranking display fields */
export interface ParticipantInfo {
  name: string
  isBot: boolean
}

/**
 * Computes final rankings from the FFA bracket states for both brackets.
 *
 * Players are ranked by their cumulative game score (descending).
 * The bracket indicator (winners/losers) is preserved for display purposes.
 * Tied scores share the same rank.
 *
 * @param gameScores - Cumulative scores (Round 2 + Round 3) for each player.
 *   When not provided (e.g., in unit tests), falls back to bracket-position ranking.
 */
export function computeFinalRankings(
  winnersBracket: FFABracketState,
  losersBracket: FFABracketState,
  participantInfo: Map<string, ParticipantInfo>,
  gameScores?: Record<string, number>
): FinalRanking[] {
  const rankings: FinalRanking[] = []

  // --- Collect all participants with their bracket info ---
  // Winners bracket participants
  for (const id of winnersBracket.participantIds) {
    const info = participantInfo.get(id)
    rankings.push({
      playerId: id,
      playerName: info?.name ?? id,
      rank: 0, // will be assigned below
      bracket: "winners",
      isBot: info?.isBot ?? false,
      score: gameScores?.[id] ?? 0,
    })
  }

  // Losers bracket participants
  for (const id of losersBracket.participantIds) {
    const info = participantInfo.get(id)
    rankings.push({
      playerId: id,
      playerName: info?.name ?? id,
      rank: 0, // will be assigned below
      bracket: "losers",
      isBot: info?.isBot ?? false,
      score: gameScores?.[id] ?? 0,
    })
  }

  // --- Sort by cumulative score descending ---
  rankings.sort((a, b) => b.score - a.score)

  // --- Assign ranks (tied scores share the same rank) ---
  for (let i = 0; i < rankings.length; i++) {
    if (i === 0) {
      rankings[i].rank = 1
    } else if (rankings[i].score === rankings[i - 1].score) {
      rankings[i].rank = rankings[i - 1].rank
    } else {
      rankings[i].rank = i + 1
    }
  }

  return rankings
}
