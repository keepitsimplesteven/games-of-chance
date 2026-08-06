import { useEffect, useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import type { PlaycallerGameState, Matchup } from "@games-of-chance/shared"
import { BracketVisualization } from "./BracketVisualization"
import { MatchPanel } from "./MatchPanel"
import { SideMatchPanels } from "./SideMatchPanels"
import { SpectatorView } from "./SpectatorView"
import { RoundHeader } from "./RoundHeader"
import { DriveView } from "./DriveView"
import { SpectatorGrid } from "./SpectatorGrid"
import { SpectatorDriveView } from "./SpectatorDriveView"
import { getRoundName } from "./field-utils"
import { usePlayerName } from "./hooks/usePlayerName"

/**
 * PlaycallerContainer — top-level game view for the Playcaller tournament.
 * Determines which sub-view to show based on player state.
 *
 * View modes (Phase 2 — when driveStates present):
 * - Active competitor: shows DriveView (full interactive drive experience)
 * - Spectator: shows SpectatorGrid → SpectatorDriveView (read-only)
 *
 * View modes (Phase 1 fallback — no driveStates):
 * - Active competitor: shows MatchPanel (center) + SideMatchPanels
 * - Spectator (eliminated or on bye): shows SpectatorView (all matches equally)
 * - Between rounds (RESULT phase): shows BracketVisualization full-size
 *
 * Validates: Requirements 8.1, 8.3, 14.1, 14.2, 14.4
 */
export function PlaycallerContainer() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const getPlayerName = usePlayerName()

  // Spectator navigation state: which matchup is the spectator viewing?
  // null = show grid, string = show that matchup's drive view
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null)

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

  const { bracket, spectators, activeCompetitors, driveStates } = playcallerGameState
  const isSpectator = spectators.includes(playerId ?? "")
  const isActiveCompetitor = activeCompetitors.includes(playerId ?? "")
  const hasDriveStates = !!driveStates

  // Phase 1: no animation — mark round animation as done immediately when
  // entering RESULT or RESOLVING phase so the host can advance.
  useEffect(() => {
    if (phase === "RESULT" || phase === "RESOLVING") {
      useGameStore.setState({ roundAnimationDone: true })
    }
  }, [phase])

  // Reset spectator selection when round changes or drive states disappear
  useEffect(() => {
    setSelectedMatchupId(null)
  }, [bracket.currentRoundIndex, hasDriveStates])

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

  // Derive round name for Phase 2 DriveView
  const roundName = getRoundName(bracket.currentRoundIndex, bracket.totalRounds)

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Drive states present — render interactive drive experience
  // ═══════════════════════════════════════════════════════════════════════════

  if (hasDriveStates) {
    // Active competitor with an active matchup → full interactive DriveView
    if (isActiveCompetitor && playerMatchup) {
      const matchupDriveState = driveStates[playerMatchup.matchupId]
      if (matchupDriveState) {
        // Determine the player's role (offense or defense)
        const role: "offense" | "defense" =
          matchupDriveState.offensePlayerId === playerId ? "offense" : "defense"

        // Determine opponent name
        const opponentId =
          role === "offense"
            ? matchupDriveState.defensePlayerId
            : matchupDriveState.offensePlayerId
        const opponentName = getPlayerName(opponentId)

        return (
          <DriveView
            matchupId={playerMatchup.matchupId}
            driveState={matchupDriveState}
            roundName={roundName}
            opponentName={opponentName}
            role={role}
          />
        )
      }
    }

    // Spectator → SpectatorGrid with tap-to-view or SpectatorDriveView
    if (isSpectator) {
      // If a matchup is selected, show the read-only drive view
      if (selectedMatchupId && driveStates[selectedMatchupId]) {
        return (
          <SpectatorDriveView
            driveState={driveStates[selectedMatchupId]}
            onBack={() => setSelectedMatchupId(null)}
          />
        )
      }

      // Otherwise, show the grid of all active matchups
      const spectatorMatchups = activeMatchups
        .filter((m) => driveStates[m.matchupId])
        .map((m) => ({
          matchupId: m.matchupId,
          driveState: driveStates[m.matchupId]!,
        }))

      return (
        <SpectatorGrid
          matchups={spectatorMatchups}
          onSelectMatchup={(matchupId) => setSelectedMatchupId(matchupId)}
        />
      )
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1 fallback: No drive states — bracket visualization behavior
  // ═══════════════════════════════════════════════════════════════════════════

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
