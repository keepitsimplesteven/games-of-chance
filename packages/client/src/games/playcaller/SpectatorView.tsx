import type { Matchup, RoundPhase } from "@games-of-chance/shared"
import { usePlayerName } from "./hooks/usePlayerName"

interface SpectatorViewProps {
  matchups: Matchup[]
  seeds: Record<string, number>
  phase: RoundPhase
}

/**
 * SpectatorView — equal-size display of all active matchups for spectators.
 * Shown to eliminated or bye players who aren't competing in the current round.
 *
 * Validates: Requirements 8.3, 9.1
 */
export function SpectatorView({ matchups, seeds, phase }: SpectatorViewProps) {
  const getPlayerName = usePlayerName()

  if (matchups.length === 0) {
    return (
      <div className="text-center text-gray-400 py-4">
        No active matchups this round.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      <div className="text-center text-sm text-gray-400 uppercase tracking-wide">
        Spectating
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {matchups.map((matchup) => (
          <MatchupCard
            key={matchup.matchupId}
            matchup={matchup}
            seeds={seeds}
            phase={phase}
            getPlayerName={getPlayerName}
          />
        ))}
      </div>
    </div>
  )
}

interface MatchupCardProps {
  matchup: Matchup
  seeds: Record<string, number>
  phase: RoundPhase
  getPlayerName: (id: string | null | undefined) => string
}

function MatchupCard({ matchup, seeds, phase, getPlayerName }: MatchupCardProps) {
  const { playerA, playerB, winner } = matchup
  const seedA = seeds[playerA] ?? "?"
  const seedB = seeds[playerB] ?? "?"
  const isResolved = winner !== null

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 flex flex-col gap-2">asdfasdfasdf
      <PlayerRow
        playerId={playerA}
        displayName={getPlayerName(playerA)}
        seed={seedA}
        isWinner={winner === playerA}
        isResolved={isResolved}
      />
      <div className="text-center text-xs text-gray-500">
        {phase === "RESOLVING" && !isResolved ? "Resolving..." : "vs"}
      </div>
      <PlayerRow
        playerId={playerB}
        displayName={getPlayerName(playerB)}
        seed={seedB}
        isWinner={winner === playerB}
        isResolved={isResolved}
      />
    </div>
  )
}

interface PlayerRowProps {
  playerId: string
  displayName: string
  seed: number | string
  isWinner: boolean
  isResolved: boolean
}

function PlayerRow({ playerId, displayName, seed, isWinner, isResolved }: PlayerRowProps) {
  const textColor = isResolved
    ? isWinner
      ? "text-green-400 font-semibold"
      : "text-gray-500 line-through"
    : "text-white"

  return (
    <div className={`flex items-center justify-between ${textColor}`}>
      <span className="truncate">{displayName}</span>
      <span className="text-xs text-gray-400 ml-2">#{seed}</span>
    </div>
  )
}
