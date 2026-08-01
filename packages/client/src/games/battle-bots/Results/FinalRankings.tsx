interface RankingEntry {
  playerId: string
  playerName: string
  rank: number
  bracket: "winners" | "losers"
  isBot: boolean
  points: number
}

interface FinalRankingsProps {
  rankings: RankingEntry[]
}

/** Medal emoji for top 3 positions */
function getRankDisplay(rank: number): { emoji: string; colorClass: string } {
  switch (rank) {
    case 1:
      return { emoji: "🥇", colorClass: "text-yellow-400" }
    case 2:
      return { emoji: "🥈", colorClass: "text-gray-300" }
    case 3:
      return { emoji: "🥉", colorClass: "text-amber-600" }
    default:
      return { emoji: "", colorClass: "text-gray-400" }
  }
}

/** Row background styling for top 3 positions */
function getRowBgClass(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-yellow-500/10 border-yellow-500/30"
    case 2:
      return "bg-gray-400/10 border-gray-400/30"
    case 3:
      return "bg-amber-600/10 border-amber-600/30"
    default:
      return "bg-gray-800/50 border-gray-700"
  }
}

/**
 * FinalRankings — Final ranking table for Battle Bots results.
 *
 * Displays a ranked list with columns: Rank, Name, Bracket, Points.
 * Top 3 positions are highlighted with gold/silver/bronze styling.
 * Winners bracket entries show a distinct badge/color from losers bracket.
 * Bot personas are expected to be filtered out before passing to this component.
 *
 * Validates: Requirements 8.5
 */
export function FinalRankings({ rankings }: FinalRankingsProps) {
  // Sort by rank ascending
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h2 className="text-center text-lg font-bold text-white">
        Final Rankings
      </h2>

      {/* Table header */}
      <div className="grid grid-cols-[48px_1fr_auto_64px] items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>Rank</span>
        <span>Name</span>
        <span>Bracket</span>
        <span className="text-right">Points</span>
      </div>

      {/* Ranking rows */}
      <div className="flex flex-col gap-1.5">
        {sorted.map((entry) => {
          const { emoji, colorClass } = getRankDisplay(entry.rank)
          const rowBg = getRowBgClass(entry.rank)
          const isTopThree = entry.rank <= 3

          return (
            <div
              key={entry.playerId}
              className={`grid grid-cols-[48px_1fr_auto_64px] items-center gap-2 rounded-lg border px-3 py-2.5 ${rowBg}`}
            >
              {/* Rank */}
              <div className="flex items-center gap-1">
                {emoji ? (
                  <span className="text-lg" aria-label={`Rank ${entry.rank}`}>
                    {emoji}
                  </span>
                ) : (
                  <span className={`text-sm font-bold ${colorClass}`}>
                    #{entry.rank}
                  </span>
                )}
              </div>

              {/* Player name */}
              <span
                className={`truncate text-sm font-medium ${
                  isTopThree ? "text-white" : "text-gray-300"
                }`}
              >
                {entry.playerName}
              </span>

              {/* Bracket badge */}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  entry.bracket === "winners"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {entry.bracket === "winners" ? "Winners" : "Losers"}
              </span>

              {/* Points */}
              <span
                className={`text-right text-sm font-bold ${
                  isTopThree ? "text-white" : "text-gray-400"
                }`}
              >
                {entry.points}
              </span>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">
          No rankings available yet.
        </p>
      )}
    </div>
  )
}

export type { RankingEntry, FinalRankingsProps }
