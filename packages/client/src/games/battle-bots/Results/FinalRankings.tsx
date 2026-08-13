import { useTheme } from "../../../theme"

interface RankingEntry {
  playerId: string
  playerName: string
  rank: number
  bracket: "winners" | "losers"
  isBot: boolean
  points: number
  /** Points earned just from Battle Bots (game delta) */
  delta?: number
}

interface FinalRankingsProps {
  rankings: RankingEntry[]
}

/** Medal emoji for top 3 positions */
function getRankDisplay(rank: number): { emoji: string; colorClass: string } {
  switch (rank) {
    case 1:
      return { emoji: "🥇", colorClass: "text-[#f5c542]" }
    case 2:
      return { emoji: "🥈", colorClass: "text-[#f0f0f0]/80" }
    case 3:
      return { emoji: "🥉", colorClass: "text-[#cc6633]" }
    default:
      return { emoji: "", colorClass: "text-[#3a9a4a]" }
  }
}

/** Row border styling for top 3 positions */
function getRowBorderClass(rank: number): string {
  switch (rank) {
    case 1:
      return "border-[#f5c542] bg-[#f5c542]/5"
    case 2:
      return "border-[#f0f0f0]/30 bg-[#f0f0f0]/5"
    case 3:
      return "border-[#cc6633]/30 bg-[#cc6633]/5"
    default:
      return "border-[#2a7a3a] bg-[#0f3d18]/50"
  }
}

/**
 * FinalRankings — Final ranking table for Battle Bots results.
 *
 * Displays a ranked list with columns: Rank, Name, Bracket, Points.
 * Top 3 positions are highlighted with gold/silver/bronze styling.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 8.5
 */
export function FinalRankings({ rankings }: FinalRankingsProps) {
  const theme = useTheme()

  // Sort by rank ascending
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank)

  return (
    <div className={`flex h-full flex-col gap-2 overflow-hidden rounded-md p-3 lg:p-5 ${theme.card}`}>
      <h2 className={`text-center text-base lg:text-lg font-bold ${theme.titleText}`}>
        FFA Complete
      </h2>

      {/* Table header */}
      <div className={`grid grid-cols-[36px_1fr_auto_64px] items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide lg:grid-cols-[48px_1fr_auto_80px] lg:px-3 lg:py-2 ${theme.mutedText}`}>
        <span>Rank</span>
        <span>Name</span>
        <span>Bracket</span>
        <span className="text-right">Pts</span>
      </div>

      {/* Ranking rows — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 lg:gap-1.5">
          {sorted.map((entry) => {
            const { emoji, colorClass } = getRankDisplay(entry.rank)
            const rowBorder = getRowBorderClass(entry.rank)
            const isTopThree = entry.rank <= 3

            return (
              <div
                key={entry.playerId}
                className={`grid grid-cols-[36px_1fr_auto_64px] items-center gap-2 rounded-md border-2 px-2 py-2 lg:grid-cols-[48px_1fr_auto_80px] lg:px-3 lg:py-2.5 ${rowBorder}`}
              >
                {/* Rank */}
                <div className="flex items-center gap-1">
                  {emoji ? (
                    <span className="text-base lg:text-lg" aria-label={`Rank ${entry.rank}`}>
                      {emoji}
                    </span>
                  ) : (
                    <span className={`text-xs lg:text-sm font-bold font-mono ${colorClass}`}>
                      #{entry.rank}
                    </span>
                  )}
                </div>

                {/* Player name */}
                <span
                  className={`truncate text-xs lg:text-sm font-medium font-mono ${
                    isTopThree ? "text-[#f0f0f0]" : "text-[#f0f0f0]/70"
                  }`}
                >
                  {entry.playerName}
                </span>

                {/* Bracket badge */}
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] lg:text-xs font-semibold border ${
                    entry.bracket === "winners"
                      ? "border-[#2a7a3a] text-[#3a9a4a] bg-[#0f3d18]"
                      : "border-[#8b1a1a] text-[#cc3333] bg-[#3d0f0f]"
                  }`}
                >
                  {entry.bracket === "winners" ? "W" : "L"}
                </span>

                {/* Points: session total + battle bots delta */}
                <div className="flex flex-col items-end">
                  <span
                    className={`text-xs lg:text-sm font-bold font-mono ${
                      isTopThree ? theme.accentText : "text-[#3a9a4a]"
                    }`}
                  >
                    {entry.points}
                  </span>
                  {entry.delta !== undefined && (
                    <span className="text-[10px] font-mono text-[#f5c542]/70">
                      +{entry.delta}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {sorted.length === 0 && (
        <p className={`py-4 text-center text-sm ${theme.mutedText}`}>
          No rankings available yet.
        </p>
      )}
    </div>
  )
}

export type { RankingEntry, FinalRankingsProps }
