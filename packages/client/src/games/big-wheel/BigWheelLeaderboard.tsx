import type { GameLeaderboardEntry, Player } from "@games-of-chance/shared"

// ── BigWheelLeaderboard ────────────────────────────────────────────────────

interface BigWheelLeaderboardProps {
  /** Final game leaderboard entries (sorted by rank) */
  leaderboard: GameLeaderboardEntry[]
  /** All players in the room */
  players: Player[]
}

/**
 * BigWheelLeaderboard — final rankings display shown at END_GAME phase.
 * Shows rank, player name, and score with gold/silver/bronze styling for top 3.
 *
 * Validates: Requirements 7.5, 10.3
 */
export function BigWheelLeaderboard({ leaderboard, players }: BigWheelLeaderboardProps) {
  if (leaderboard.length === 0) return null

  // Sort defensively by rank
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank)

  return (
    <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500">
        🏆 Final Rankings
      </h3>
      <ul className="space-y-1.5">
        {sorted.map((entry) => {
          const rankStyle = getRankStyle(entry.rank)

          return (
            <li
              key={entry.playerId}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${rankStyle.bg}`}
            >
              {/* Rank + Name */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${rankStyle.badge}`}
                >
                  {entry.rank}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {rankStyle.emoji && (
                    <span className="mr-1">{rankStyle.emoji}</span>
                  )}
                  {entry.playerName}
                </span>
              </div>

              {/* Score */}
              <span className={`text-xs font-semibold ${rankStyle.scoreText}`}>
                {entry.score} pts
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface RankStyle {
  bg: string
  badge: string
  scoreText: string
  emoji: string
}

function getRankStyle(rank: number): RankStyle {
  switch (rank) {
    case 1:
      return {
        bg: "bg-yellow-50",
        badge: "bg-yellow-400 text-white",
        scoreText: "text-yellow-700",
        emoji: "🥇",
      }
    case 2:
      return {
        bg: "bg-gray-100",
        badge: "bg-gray-400 text-white",
        scoreText: "text-gray-600",
        emoji: "🥈",
      }
    case 3:
      return {
        bg: "bg-orange-50",
        badge: "bg-orange-400 text-white",
        scoreText: "text-orange-700",
        emoji: "🥉",
      }
    default:
      return {
        bg: "bg-gray-50",
        badge: "bg-gray-200 text-gray-600",
        scoreText: "text-gray-600",
        emoji: "",
      }
  }
}
