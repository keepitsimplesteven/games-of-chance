import type { Bracket, BracketRound, Matchup } from "@games-of-chance/shared"
import { useGameStore } from "../../store/useGameStore"

// ── BracketVisualization ───────────────────────────────────────────────────

/**
 * Renders the full tournament bracket as a visual diagram.
 * Shows all rounds, seeds, matchups, winners, and byes.
 * Displayed full-size between rounds (RESULT phase), hidden/collapsed during active play.
 *
 * Visual distinctions:
 * - Eliminated players: dimmed text with line-through
 * - Active competitors: normal styling
 * - Winners: highlighted with green border
 * - Bye recipients: dashed border with "BYE" label
 * - Unresolved matchups: "TBD" in gray
 *
 * Validates: Requirements 8.4, 8.5, 9.1, 9.2, 9.3, 9.4
 */

interface BracketVisualizationProps {
  bracket: Bracket
}

/** Returns a human-friendly label for a bracket round */
function getRoundLabel(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundIndex
  if (roundsFromEnd === 1) return "Final"
  if (roundsFromEnd === 2) return "Semi-Finals"
  if (roundsFromEnd === 3) return "Quarter-Finals"
  return `Round ${roundIndex + 1}`
}

export function BracketVisualization({ bracket }: BracketVisualizationProps) {
  const players = useGameStore((s) => s.roomState?.players ?? [])

  /** Resolve a player ID to display name with seed */
  function getPlayerDisplay(playerId: string): string {
    if (!playerId) return "TBD"
    const player = players.find((p) => p.id === playerId)
    const seed = bracket.seeds[playerId]
    const name = player?.name ?? playerId
    return seed ? `(${seed}) ${name}` : name
  }

  /** Check if a player is eliminated */
  function isEliminated(playerId: string): boolean {
    return playerId in bracket.eliminated
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max gap-4 px-2 py-4">
        {bracket.rounds.map((round) => (
          <RoundColumn
            key={round.roundIndex}
            round={round}
            totalRounds={bracket.totalRounds}
            getPlayerDisplay={getPlayerDisplay}
            isEliminated={isEliminated}
          />
        ))}
      </div>
    </div>
  )
}

// ── RoundColumn ────────────────────────────────────────────────────────────

interface RoundColumnProps {
  round: BracketRound
  totalRounds: number
  getPlayerDisplay: (playerId: string) => string
  isEliminated: (playerId: string) => boolean
}

function RoundColumn({
  round,
  totalRounds,
  getPlayerDisplay,
  isEliminated,
}: RoundColumnProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Round label */}
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {getRoundLabel(round.roundIndex, totalRounds)}
      </div>

      {/* Bye indicators (first round only) */}
      {round.byes.length > 0 && (
        <div className="flex flex-col gap-2">
          {round.byes.map((playerId) => (
            <ByeCard
              key={playerId}
              playerDisplay={getPlayerDisplay(playerId)}
            />
          ))}
        </div>
      )}

      {/* Matchup cards */}
      <div className="flex flex-col justify-center gap-3 flex-1">
        {round.matchups.map((matchup) => (
          <MatchupCard
            key={matchup.matchupId}
            matchup={matchup}
            resolved={round.resolved}
            getPlayerDisplay={getPlayerDisplay}
            isEliminated={isEliminated}
          />
        ))}
      </div>
    </div>
  )
}

// ── MatchupCard ────────────────────────────────────────────────────────────

interface MatchupCardProps {
  matchup: Matchup
  resolved: boolean
  getPlayerDisplay: (playerId: string) => string
  isEliminated: (playerId: string) => boolean
}

function MatchupCard({
  matchup,
  resolved,
  getPlayerDisplay,
  isEliminated,
}: MatchupCardProps) {
  const { playerA, playerB, winner } = matchup

  return (
    <div className="w-44 rounded-lg border border-gray-700 bg-gray-800 shadow-sm">
      {/* Player A */}
      <PlayerSlot
        playerId={playerA}
        display={playerA ? getPlayerDisplay(playerA) : "TBD"}
        isWinner={resolved && winner === playerA}
        isLoser={resolved && !!winner && winner !== playerA && !!playerA}
        isEliminated={playerA ? isEliminated(playerA) : false}
        position="top"
      />

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* Player B */}
      <PlayerSlot
        playerId={playerB}
        display={playerB ? getPlayerDisplay(playerB) : "TBD"}
        isWinner={resolved && winner === playerB}
        isLoser={resolved && !!winner && winner !== playerB && !!playerB}
        isEliminated={playerB ? isEliminated(playerB) : false}
        position="bottom"
      />
    </div>
  )
}

// ── PlayerSlot ─────────────────────────────────────────────────────────────

interface PlayerSlotProps {
  playerId: string
  display: string
  isWinner: boolean
  isLoser: boolean
  isEliminated: boolean
  position: "top" | "bottom"
}

function PlayerSlot({
  playerId,
  display,
  isWinner,
  isLoser,
  isEliminated,
  position,
}: PlayerSlotProps) {
  const isTBD = !playerId

  // Build class names based on state
  const baseClasses = "px-3 py-2 text-sm truncate"
  const roundingClasses =
    position === "top" ? "rounded-t-lg" : "rounded-b-lg"

  let stateClasses = "text-gray-300"
  if (isTBD) {
    stateClasses = "text-gray-600 italic"
  } else if (isWinner) {
    stateClasses = "text-green-400 font-bold bg-green-900/20 border-l-2 border-green-500"
  } else if (isLoser || isEliminated) {
    stateClasses = "text-gray-500 line-through opacity-50"
  }

  return (
    <div className={`${baseClasses} ${roundingClasses} ${stateClasses}`}>
      {display}
    </div>
  )
}

// ── ByeCard ────────────────────────────────────────────────────────────────

interface ByeCardProps {
  playerDisplay: string
}

function ByeCard({ playerDisplay }: ByeCardProps) {
  return (
    <div className="w-44 rounded-lg border border-dashed border-amber-600/50 bg-gray-800/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-amber-300 truncate">{playerDisplay}</span>
        <span className="ml-2 text-xs font-medium uppercase text-amber-500">
          BYE
        </span>
      </div>
    </div>
  )
}
