import type { Matchup, RoundPhase } from "@games-of-chance/shared"
import { usePlayerName } from "./hooks/usePlayerName"

interface MatchPanelProps {
  matchup: Matchup
  seeds: Record<string, number>
  phase: RoundPhase
}

/**
 * MatchPanel — large center panel showing the active player's current matchup.
 * Displays player names and seeds prominently, with phase-aware status indicators.
 *
 * Validates: Requirements 8.1, 8.2
 */
export function MatchPanel({ matchup, seeds, phase }: MatchPanelProps) {
  const getPlayerName = usePlayerName()
  const seedA = seeds[matchup.playerA] ?? "?"
  const seedB = seeds[matchup.playerB] ?? "?"
  const isResolving = phase === "RESOLVING"
  const hasWinner = matchup.winner !== null

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-gray-700 bg-gray-800/80 px-8 py-6 shadow-lg w-full max-w-md">
      {/* Player A */}
      <div
        className={`flex w-full items-center justify-between rounded-lg px-4 py-3 ${
          hasWinner && matchup.winner === matchup.playerA
            ? "border border-[#f5c542] bg-[#f5c542]/10"
            : hasWinner && matchup.winner !== matchup.playerA
              ? "border border-gray-600 bg-gray-900/40 opacity-50"
              : "border border-gray-600 bg-gray-900/40"
        }`}
      >
        <span className="text-lg font-bold text-white">{getPlayerName(matchup.playerA)}</span>
        <span className="rounded bg-gray-700 px-2 py-0.5 text-sm text-gray-300">
          Seed {seedA}
        </span>
      </div>

      {/* VS / Status */}
      <div className="flex flex-col items-center gap-1">
        {isResolving ? (
          <span className="animate-pulse text-lg font-semibold text-amber-400">
            Resolving...
          </span>
        ) : hasWinner ? (
          <span className="text-sm font-medium text-[#f5c542]">
            🏆 {getPlayerName(matchup.winner)} wins!
          </span>
        ) : (
          <span className="text-xl font-bold text-gray-400">VS</span>
        )}
      </div>

      {/* Player B */}
      <div
        className={`flex w-full items-center justify-between rounded-lg px-4 py-3 ${
          hasWinner && matchup.winner === matchup.playerB
            ? "border border-[#f5c542] bg-[#f5c542]/10"
            : hasWinner && matchup.winner !== matchup.playerB
              ? "border border-gray-600 bg-gray-900/40 opacity-50"
              : "border border-gray-600 bg-gray-900/40"
        }`}
      >
        <span className="text-lg font-bold text-white">{getPlayerName(matchup.playerB)}</span>
        <span className="rounded bg-gray-700 px-2 py-0.5 text-sm text-gray-300">
          Seed {seedB}
        </span>
      </div>
    </div>
  )
}
