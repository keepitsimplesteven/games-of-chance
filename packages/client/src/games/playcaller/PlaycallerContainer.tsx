import { useEffect, useRef, useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import type { PlaycallerGameState, Matchup } from "@games-of-chance/shared"
import { BracketVisualization } from "./BracketVisualization"
import { MatchPanel } from "./MatchPanel"
import { SideMatchPanels } from "./SideMatchPanels"
import { SpectatorView } from "./SpectatorView"
import { RoundHeader } from "./RoundHeader"
import { DriveView } from "./DriveView"
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"
import { SpectatorGrid } from "./SpectatorGrid"
import { SpectatorDriveView } from "./SpectatorDriveView"
import { CoinTossCeremony } from "./CoinTossCeremony"
import { MatchupIntro } from "../../components/game/MatchupIntro"
import RoundControls from "../../components/game/RoundControls"
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

  // VS intro animation state: true when entering a new bracket round with drives
  const [showIntro, setShowIntro] = useState(true)

  // Spectate-after-completion: when player's drive finishes but others are ongoing
  const [showSpectator, setShowSpectator] = useState(false)

  // Track the round index so we can reset showIntro on round change
  const prevRoundIndexRef = useRef<number | null>(null)

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

  /** Format a player name with their bracket seed prefix */
  function getSeededName(id: string): string {
    const seed = bracket.seeds[id]
    const name = getPlayerName(id)
    return seed ? `(${seed}) ${name}` : name
  }

  /** Configurable delay (ms) before signaling round animation is done.
   *  Gives the final play's announcer timeline time to complete. */
  const ROUND_END_DELAY_MS = 500

  // Delay marking the round animation as done so the last play's timeline
  // has time to show the outcome before the host can advance.
  useEffect(() => {
    if (phase === "RESULT" || phase === "RESOLVING") {
      const timer = setTimeout(() => {
        useGameStore.setState({ roundAnimationDone: true })
      }, ROUND_END_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Reset spectator selection when round changes or drive states disappear
  useEffect(() => {
    setSelectedMatchupId(null)
  }, [bracket.currentRoundIndex, hasDriveStates])

  // Reset showIntro to true when bracket round index changes (new bracket round)
  useEffect(() => {
    if (prevRoundIndexRef.current !== null && prevRoundIndexRef.current !== bracket.currentRoundIndex) {
      setShowIntro(true)
      setShowSpectator(false)
    }
    prevRoundIndexRef.current = bracket.currentRoundIndex
  }, [bracket.currentRoundIndex])

  // ═══════════════════════════════════════════════════════════════════════════
  // COIN_TOSS phase: render the coin toss ceremony container
  // (placed AFTER all hooks to satisfy React's Rules of Hooks)
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === "COIN_TOSS") {
    return <CoinTossCeremony />
  }

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
    // Determine if this is the first down of the round (for VS intro)
    const isFirstDown = Object.values(driveStates).every(
      (d) => !d.isComplete && d.playHistory.length === 0
    )

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

        // VS Intro: show on first down of a new bracket round
        if (showIntro && isFirstDown) {
          const introMatchups = activeMatchups.map((m) => {
            const drive = driveStates[m.matchupId]
            return {
              playerAName: drive ? getSeededName(drive.offensePlayerId) : getSeededName(m.playerA),
              playerBName: drive ? getSeededName(drive.defensePlayerId) : getSeededName(m.playerB),
              isCurrentPlayer: m.playerA === playerId || m.playerB === playerId,
            }
          })
          return (
            <MatchupIntro
              roundName={roundName}
              matchups={introMatchups}
              onComplete={() => setShowIntro(false)}
              durationMs={3000}
            />
          )
        }

        // Spectate after completion: player's drive is done, but others are still active
        if (matchupDriveState.isComplete) {
          const otherActiveDrives = Object.entries(driveStates)
            .filter(([id, d]) => id !== playerMatchup.matchupId && !d.isComplete)
            .map(([id, d]) => ({ matchupId: id, driveState: d }))

          if (otherActiveDrives.length > 0 && showSpectator) {
            // Show compact completion overlay + spectator grid
            if (selectedMatchupId && driveStates[selectedMatchupId]) {
              return (
                <SpectatorDriveView
                  driveState={driveStates[selectedMatchupId]}
                  onBack={() => setSelectedMatchupId(null)}
                  roundName={roundName}
                />
              )
            }
            return (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-2 py-1 text-center text-xs text-amber-300 font-medium">
                  Your drive is complete — watching other games
                </div>
                <div className="flex-1 overflow-auto">
                  <SpectatorGrid
                    matchups={otherActiveDrives}
                    onSelectMatchup={(matchupId) => setSelectedMatchupId(matchupId)}
                  />
                </div>
              </div>
            )
          }

          // Show DriveCompletionOverlay, then switch to spectator after 5s
          // if (otherActiveDrives.length > 0 && !showSpectator) {
          //   return (
          //     <DriveCompletionOverlayWithTimer
          //       driveState={matchupDriveState}
          //       onTransitionToSpectator={() => setShowSpectator(true)}
          //     />
          //   )
          // }

          // All drives complete — just show completion overlay (server will advance soon)
        }

        // Build list of other drives for the side panel
        const otherDrivesForPanel = Object.entries(driveStates)
          .filter(([id]) => id !== playerMatchup.matchupId)
          .map(([id, ds]) => ({ matchupId: id, driveState: ds }))

        return (
          <DriveView
            matchupId={playerMatchup.matchupId}
            driveState={matchupDriveState}
            roundName={roundName}
            opponentName={opponentName}
            role={role}
            otherDrives={otherDrivesForPanel}
          />
        )
      }
    }

    // Spectator → SpectatorGrid with tap-to-view or SpectatorDriveView
    if (isSpectator) {
      // VS Intro for spectators too
      if (showIntro && isFirstDown) {
        const introMatchups = activeMatchups.map((m) => {
          const drive = driveStates[m.matchupId]
          return {
            playerAName: drive ? getSeededName(drive.offensePlayerId) : getSeededName(m.playerA),
            playerBName: drive ? getSeededName(drive.defensePlayerId) : getSeededName(m.playerB),
            isCurrentPlayer: false,
          }
        })
        if (introMatchups.length > 0) {
          return (
            <MatchupIntro
              roundName={roundName}
              matchups={introMatchups}
              onComplete={() => setShowIntro(false)}
              durationMs={3000}
            />
          )
        }
      }

      // If a matchup is selected, show the read-only drive view
      if (selectedMatchupId && driveStates[selectedMatchupId]) {
        return (
          <SpectatorDriveView
            driveState={driveStates[selectedMatchupId]}
            onBack={() => setSelectedMatchupId(null)}
            roundName={roundName}
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

      // Auto-spectate when there's only one matchup (the final)
      if (spectatorMatchups.length === 1) {
        return (
          <SpectatorDriveView
            driveState={spectatorMatchups[0].driveState}
            onBack={() => {}} // No grid to go back to
            roundName={roundName}
          />
        )
      }

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

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 flex flex-col items-center gap-2 pt-4">
          <RoundHeader
            roundIndex={resolvedRoundIndex}
            totalRounds={bracket.totalRounds}
          />
          <div className="text-sm text-[#f5c542] font-medium uppercase tracking-wider">
            Round Complete
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto py-2">
          <BracketVisualization bracket={bracket} />
        </div>
        <div className="shrink-0 w-full max-w-sm mx-auto px-4 pb-4 pt-2">
          <RoundControls />
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

// ── Helper: Shows completion overlay, then transitions to spectator after 5s ──

interface DriveCompletionOverlayWithTimerProps {
  driveState: import("./field-utils.types").DriveState
  onTransitionToSpectator: () => void
}

function DriveCompletionOverlayWithTimer({
  driveState,
  onTransitionToSpectator,
}: DriveCompletionOverlayWithTimerProps) {
  useEffect(() => {
    const timer = setTimeout(onTransitionToSpectator, 5_000)
    return () => clearTimeout(timer)
  }, [onTransitionToSpectator])

  return (
    <div className="flex items-center justify-center h-full">
      <DriveCompletionOverlay
        driveState={driveState}
        onAnimationDone={() => {
          // Animation done — timer will handle the transition to spectator
        }}
      />
    </div>
  )
}
