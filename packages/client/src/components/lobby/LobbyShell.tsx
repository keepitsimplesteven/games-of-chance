import type { ReactNode } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import PlayerList from "./PlayerList"
import ShareLink from "./ShareLink"
import GameTileGrid from "./GameTileGrid"
import HostControls from "./HostControls"
import SettingsPanel from "./SettingsPanel"
import ConnectionStatus from "../shared/ConnectionStatus"
import GameView from "../game/GameView"
import HostControlPanel from "../../host-panel/HostControlPanel"
import ScoreAdjustmentNotification from "../../host-panel/ScoreAdjustmentNotification"
import TournamentEndView from "./TournamentEndView"
import { SessionStandingsPopover } from "../game/SessionStandingsPopover"
import { PlaycallerLeaderboard } from "../../games/playcaller/PlaycallerLeaderboard"

interface LobbyShellProps {
  children?: ReactNode
}

export default function LobbyShell({ children }: LobbyShellProps) {
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const theme = useTheme()

  // Show lobby content (game tiles + host controls) when in LOBBY phase
  const isLobby = !phase || phase === "LOBBY"

  // END_TOURNAMENT is a terminal state — show celebration view, no game selection
  const isTournamentEnd = phase === "END_TOURNAMENT"

  // Playcaller in active drive mode: render full-viewport without surrounding chrome
  const isPlaycallerActive = gameType === "playcaller" && !isLobby && !isTournamentEnd && phase !== "END_GAME"

  // Show session standings popover during active games (non-lobby, non-tournament-end)
  const showStandingsPopover = !isLobby && !isTournamentEnd

  // Full-viewport mode for playcaller — skip page padding, standings, etc.
  if (isPlaycallerActive) {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col">
        {/* Compact header with session standings popover */}
        <PlaycallerHeader />

        {/* Game fills the rest of the viewport */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <GameView />
        </div>

        {/* Host Control Panel — renders as overlay across all phases */}
        <HostControlPanel />
        <ScoreAdjustmentNotification />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-4">
      {/* Header with connection status, share icon, and session standings popover */}
      <header className="mb-4 flex items-center justify-between">
        <h1 className={`text-lg font-bold ${theme.titleText}`}>Games of Chance</h1>
        <div className="flex items-center gap-1.5">
          {showStandingsPopover && (
            <SessionStandingsPopover
              trigger={<StandingsTriggerIcon />}
            />
          )}
          <ShareLink />
          <ConnectionStatus />
        </div>
      </header>

      {/* Standings — collapsible, expanded in lobby, collapsed in game */}
      <PlayerList />

      {/* Tournament End — terminal celebration view replaces all lobby/game UI */}
      {isTournamentEnd && (
        <div className="mt-4 flex flex-1 flex-col">
          <TournamentEndView />
        </div>
      )}

      {/* Lobby content: game tiles + settings + start button — only in LOBBY phase */}
      {isLobby && !isTournamentEnd && (
        <>
          <div className="mt-4">
            <GameTileGrid />
          </div>
          <div className="mt-4">
            <SettingsPanel />
          </div>
          <div className="mt-4">
            <HostControls />
          </div>
        </>
      )}

      {/* Game view — renders when a game is active (phase ≠ LOBBY and not END_TOURNAMENT) */}
      {!isLobby && !isTournamentEnd && (
        <div className="mt-4 flex flex-1 flex-col">
          <GameView />
        </div>
      )}

      {/* Children (additional content) */}
      {children && (
        <div className="mt-4 flex flex-1 flex-col gap-4">{children}</div>
      )}

      {/* Host Control Panel — renders as overlay across all phases */}
      <HostControlPanel />

      {/* Score adjustment notification toasts — visible to all players */}
      <ScoreAdjustmentNotification />
    </div>
  )
}

/**
 * PlaycallerHeader — Compact header for full-viewport playcaller mode.
 * Shows "Games of Chance" title, connection status, share link, and a
 * session standings dropdown using BaseLeaderboard compact variant.
 *
 * Validates: Requirements 4.1, 4.2, 7.4, 7.5
 */
function PlaycallerHeader() {
  const theme = useTheme()

  return (
    <header className="flex items-center justify-between px-2 py-1 shrink-0">
      <h1 className={`text-sm font-bold ${theme.titleText}`}>Games of Chance</h1>
      <div className="flex items-center gap-1.5">
        <ShareLink />
        <ConnectionStatus />

        {/* Session standings dropdown with compact BaseLeaderboard */}
        <PlaycallerLeaderboard
          trigger={<StandingsTriggerIcon />}
        />
      </div>
    </header>
  )
}

/**
 * StandingsTriggerIcon — A trophy/standings icon used as the trigger for
 * the SessionStandingsPopover across all game layouts.
 */
function StandingsTriggerIcon() {
  const theme = useTheme()
  return (
    <span
      className={`inline-flex items-center justify-center p-1.5 rounded hover:bg-white/10 transition-colors ${theme.mutedText}`}
      aria-label="Session standings"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M4 2a1 1 0 0 0-1 1v1H2a1 1 0 0 0-1 1v1.5a2.5 2.5 0 0 0 2.3 2.49A4.004 4.004 0 0 0 6.5 11.91V13H5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H9.5v-1.09A4.004 4.004 0 0 0 12.7 8.99 2.5 2.5 0 0 0 15 6.5V5a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1H4zm0 1h8v4a4 4 0 0 1-8 0V3zM3 5H2v1.5A1.5 1.5 0 0 0 3 7.95V5zm11 0h-1v2.95a1.5 1.5 0 0 0 1-1.45V5z" />
      </svg>
    </span>
  )
}
