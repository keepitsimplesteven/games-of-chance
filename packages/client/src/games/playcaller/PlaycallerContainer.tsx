import { useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import type { PlaycallerGameState, Matchup } from "@games-of-chance/shared"
import { BracketVisualization } from "./BracketVisualization"
import { MatchPanel } from "./MatchPanel"
import { SideMatchPanels } from "./SideMatchPanels"
import { SpectatorView } from "./SpectatorView"
import { RoundHeader } from "./RoundHeader"

/**
 * PlaycallerContainer — top-level game view for the Playcaller tournament.
 * Determines which sub-view to show based on player state.
 *
 * View modes:
 * - Active competitor: shows MatchPanel (center) + SideMatchPanels
 * - Spectator (eliminated or on bye): shows SpectatorView (all matches equally)
 * - Between rounds (RESULT phase): shows BracketVisualization full-size
 *
 * Validates: Requirements 8.1, 8.3
 */
export function PlaycallerContainer() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const phase = roomState.round.phase
  const playcallerGameState = roomState.playcallerGameState as PlaycallerGameState | null | undefined

  if (phase === "LOBBY" || phase === "END_GAME") return null

  // If no playcaller game state is available yet, show loading
  if (!playcallerGameState) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-gray-500">
        Waiting for bracket data...
      </div>
    )
  }

  const { bracket, spectators, activeCompetitors } = playcallerGameState
  const isSpectator = spectators.includes(playerId ?? "")
  const isActiveCompetitor = activeCompetitors.includes(playerId ?? "")

  // Phase 1: no animation — mark round animation as done immediately when
  // entering RESULT or RESOLVING phase so the host can advance.
  useEffect(() => {
    if (phase === "RESULT" || phase === "RESOLVING") {
      useGameStore.setState({ roundAnimationDone: true })
    }
  }, [phase])

  // Get current round's matchups for display
  const currentRound = bracket.rounds[bracket.currentRoundIndex]
  const activeMatchups: Matchup[] = currentRound?.matchups ?? []

  // Find this player's matchup (if active competitor)
  const playerMatchup = activeMatchups.find(
    (m) => m.playerA === playerId || m.playerB === playerId
  )
  // Other matchups (for side panels)
  const otherMatchups = activeMatchups.filter(
    (m) => m.playerA !== playerId && m.playerB !== playerId
  )

  // Between rounds (RESULT phase): show full bracket visualization
  if (phase === "RESULT") {
    // Show the just-resolved round's matchups (currentRoundIndex was already incremented)
    const resolvedRoundIndex = bracket.currentRoundIndex - 1
    const resolvedRound = bracket.rounds[resolvedRoundIndex]
    const resolvedMatchups = resolvedRound?.matchups ?? []

    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <RoundHeader
          roundIndex={resolvedRoundIndex}
          totalRounds={bracket.totalRounds}
        />
        <div className="text-sm text-amber-300 font-medium">
          Round Complete
        </div>
        <BracketVisualization bracket={bracket} />
        <div className="text-xs text-gray-500 mt-2">
          Waiting for host to advance...
        </div>
      </div>
    )
  }

  // Active competitor: show their matchup prominently + side panels
  if (isActiveCompetitor && playerMatchup) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <RoundHeader
          roundIndex={bracket.currentRoundIndex}
          totalRounds={bracket.totalRounds}
        />
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl md:flex-row md:items-start md:justify-center">
          {/* Main matchup panel */}
          <MatchPanel
            matchup={playerMatchup}
            seeds={bracket.seeds}
            phase={phase}
          />
          {/* Side panels for other matchups */}
          {otherMatchups.length > 0 && (
            <SideMatchPanels
              matchups={otherMatchups}
              seeds={bracket.seeds}
              phase={phase}
            />
          )}
        </div>
      </div>
    )
  }

  // Spectator: show all matchups equally
  if (isSpectator) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <RoundHeader
          roundIndex={bracket.currentRoundIndex}
          totalRounds={bracket.totalRounds}
        />
        <SpectatorView
          matchups={activeMatchups}
          seeds={bracket.seeds}
          phase={phase}
        />
      </div>
    )
  }

  // Fallback — active competitor whose matchup wasn't found (race condition),
  // show spectator view
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <RoundHeader
        roundIndex={bracket.currentRoundIndex}
        totalRounds={bracket.totalRounds}
      />
      <SpectatorView
        matchups={activeMatchups}
        seeds={bracket.seeds}
        phase={phase}
      />
    </div>
  )
}
