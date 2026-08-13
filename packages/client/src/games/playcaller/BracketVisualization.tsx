import { useEffect, useRef } from "react"
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
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll to the just-completed round on mobile during RESULT phase
  useEffect(() => {
    if (phase !== "RESULT" || !scrollRef.current) return
    // The resolved round is currentRoundIndex - 1 (server already incremented)
    const targetIndex = bracket.currentRoundIndex - 1
    if (targetIndex < 0) return

    const container = scrollRef.current
    const columns = container.querySelectorAll<HTMLElement>("[data-round-index]")
    const targetCol = columns[targetIndex]
    if (!targetCol) return

    // Smooth scroll so the resolved round is visible
    const scrollLeft = targetCol.offsetLeft - container.offsetLeft - 8
    container.scrollTo({ left: scrollLeft, behavior: "smooth" })
  }, [phase, bracket.currentRoundIndex])

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto">
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
    <div className="flex flex-col items-center gap-3" data-round-index={round.roundIndex}>
      {/* Round label */}
      <div className="text-xs font-semibold uppercase tracking-wide text-[#f5c542]">
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
  const { playerA, playerB, winner, endingType } = matchup

  return (
    <div className="w-44 border-2 border-[#2a7a3a] bg-[#1b5e2a] shadow-sm">
      {/* Player A */}
      <PlayerSlot
        playerId={playerA}
        display={playerA ? getPlayerDisplay(playerA) : "TBD"}
        isWinner={resolved && winner === playerA}
        isLoser={resolved && !!winner && winner !== playerA && !!playerA}
        isEliminated={playerA ? isEliminated(playerA) : false}
      />

      {/* Divider */}
      <div className="border-t border-[#2a7a3a]" />

      {/* Player B */}
      <PlayerSlot
        playerId={playerB}
        display={playerB ? getPlayerDisplay(playerB) : "TBD"}
        isWinner={resolved && winner === playerB}
        isLoser={resolved && !!winner && winner !== playerB && !!playerB}
        isEliminated={playerB ? isEliminated(playerB) : false}
      />

      {/* Outcome badge — only shown for resolved matchups with an endingType */}
      {resolved && endingType && (
        <div className="border-t border-[#2a7a3a]">
          <MatchOutcomeBadge endingType={endingType} />
        </div>
      )}
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
}

function PlayerSlot({
  playerId,
  display,
  isWinner,
  isLoser,
  isEliminated,
}: PlayerSlotProps) {
  const isTBD = !playerId

  // Build class names based on state — using retro-casino palette
  const baseClasses = "px-3 py-2 text-sm truncate"

  let stateClasses = "text-[#f0f0f0]" // bodyText white
  if (isTBD) {
    stateClasses = "text-[#3a9a4a] italic" // mutedText green
  } else if (isWinner) {
    stateClasses = "text-[#f5c542] font-bold bg-[#2a7a3a]/30 border-l-4 border-[#f5c542]"
  } else if (isLoser || isEliminated) {
    stateClasses = "text-[#3a9a4a]/50 line-through opacity-50"
  }

  return (
    <div className={`${baseClasses} ${stateClasses}`}>
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
    <div className="w-44 border-2 border-dashed border-[#f5c542]/50 bg-[#1b5e2a]/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#f5c542] truncate">{playerDisplay}</span>
        <span className="ml-2 text-xs font-medium uppercase text-[#f5c542]/70">
          BYE
        </span>
      </div>
    </div>
  )
}

// ── MatchOutcomeBadge ──────────────────────────────────────────────────────

interface MatchOutcomeBadgeProps {
  endingType: string
}

/** Small colored label showing how a resolved matchup ended */
function MatchOutcomeBadge({ endingType }: MatchOutcomeBadgeProps) {
  const { label, colorClass } = getOutcomeDisplay(endingType)
  return (
    <div className={`px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${colorClass}`}>
      {label}
    </div>
  )
}

function getOutcomeDisplay(endingType: string): { label: string; colorClass: string } {
  switch (endingType) {
    case "touchdown":
      return { label: "Touchdown", colorClass: "text-[#3a9a4a]" }
    case "interception":
      return { label: "Interception", colorClass: "text-[#cc3333]" }
    case "fumble":
      return { label: "Fumble", colorClass: "text-[#cc3333]" }
    case "turnover_on_downs":
      return { label: "Turnover on Downs", colorClass: "text-[#cc3333]" }
    default:
      return { label: "Game Over", colorClass: "text-white/60" }
  }
}
