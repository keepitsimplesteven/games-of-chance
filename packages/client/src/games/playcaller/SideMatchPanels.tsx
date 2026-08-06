import type { Matchup, RoundPhase } from "@games-of-chance/shared"
import { usePlayerName } from "./hooks/usePlayerName"

interface SideMatchPanelsProps {
  matchups: Matchup[]
  seeds: Record<string, number>
  phase: RoundPhase
}

/**
 * SideMatchPanels — compact scoreboard cards for other active matchups
 * (not the player's own). Rendered as a vertical stack of smaller cards.
 *
 * Validates: Requirements 8.1, 8.2
 */
export function SideMatchPanels({ matchups, seeds, phase }: SideMatchPanelsProps) {
  const getPlayerName = usePlayerName()

  if (matchups.length === 0) return null

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Other Matchups
      </h3>
      {matchups.map((matchup) => (
        <SideMatchCard
          key={matchup.matchupId}
          matchup={matchup}
          seeds={seeds}
          phase={phase}
          getPlayerName={getPlayerName}
        />
      ))}
    </div>
  )
}

interface SideMatchCardProps {
  matchup: Matchup
  seeds: Record<string, number>
  phase: RoundPhase
  getPlayerName: (id: string | null | undefined) => string
}

function SideMatchCard({ matchup, seeds, phase, getPlayerName }: SideMatchCardProps) {
  const seedA = seeds[matchup.playerA] ?? "?"
  const seedB = seeds[matchup.playerB] ?? "?"
  const isResolving = phase === "RESOLVING"
  const hasWinner = matchup.winner !== null

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm">
      {/* Player A row */}
      <div
        className={`flex items-center justify-between ${
          hasWinner && matchup.winner === matchup.playerA
            ? "font-semibold text-green-400"
            : hasWinner && matchup.winner !== matchup.playerA
              ? "text-gray-500 line-through"
              : "text-gray-200"
        }`}
      >
        <span>{getPlayerName(matchup.playerA)}</span>
        <span className="text-xs text-gray-500">#{seedA}</span>
      </div>

      {/* Divider / status */}
      <div className="my-1 flex items-center justify-center">
        {isResolving ? (
          <span className="animate-pulse text-xs text-amber-400">resolving</span>
        ) : hasWinner ? (
          <span className="text-xs text-gray-600">—</span>
        ) : (
          <span className="text-xs text-gray-600">vs</span>
        )}
      </div>

      {/* Player B row */}
      <div
        className={`flex items-center justify-between ${
          hasWinner && matchup.winner === matchup.playerB
            ? "font-semibold text-green-400"
            : hasWinner && matchup.winner !== matchup.playerB
              ? "text-gray-500 line-through"
              : "text-gray-200"
        }`}
      >
        <span>{getPlayerName(matchup.playerB)}</span>
        <span className="text-xs text-gray-500">#{seedB}</span>
      </div>
    </div>
  )
}
