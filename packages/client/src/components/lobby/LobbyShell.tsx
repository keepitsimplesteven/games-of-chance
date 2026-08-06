import { useState } from "react"
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

  // Full-viewport mode for playcaller — skip page padding, standings, etc.
  if (isPlaycallerActive) {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col">
        {/* Compact header with 3-dot standings menu */}
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
      {/* Header with connection status and share icon */}
      <header className="mb-4 flex items-center justify-between">
        <h1 className={`text-lg font-bold ${theme.titleText}`}>Games of Chance</h1>
        <div className="flex items-center gap-1.5">
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
 * Shows "Games of Chance" title, connection status, share link, and a 3-dot
 * menu that opens a dropdown with session standings.
 */
function PlaycallerHeader() {
  const theme = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  const sessionLeaderboard = roomState?.sessionLeaderboard ?? []
  const players = roomState?.players ?? []

  // Build lookup for player names
  const nameMap = new Map(players.map((p) => [p.id, p.name]))

  return (
    <header className="flex items-center justify-between px-2 py-1 shrink-0">
      <h1 className={`text-sm font-bold ${theme.titleText}`}>Games of Chance</h1>
      <div className="flex items-center gap-1.5">
        <ShareLink />
        <ConnectionStatus />

        {/* 3-dot menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${theme.mutedText}`}
            aria-label="Session menu"
            aria-expanded={menuOpen}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={`absolute right-0 top-full mt-1 z-40 rounded-lg border-2 border-[#2a7a3a] bg-[#0f3d18] shadow-xl p-2 min-w-[180px] max-h-[50dvh] overflow-y-auto`}
              >
                <div className={`text-[9px] font-bold uppercase tracking-wider ${theme.accentText} mb-1.5 px-1`}>
                  Session Standings
                </div>
                {sessionLeaderboard.length === 0 ? (
                  <div className={`text-[10px] ${theme.mutedText} px-1`}>No standings yet</div>
                ) : (
                  <ul className="space-y-0.5">
                    {sessionLeaderboard.map((entry) => {
                      const isYou = entry.playerId === playerId
                      return (
                        <li
                          key={entry.playerId}
                          className={`flex items-center justify-between rounded px-1.5 py-1 text-[10px] ${
                            isYou ? "bg-[#1b5e2a]" : ""
                          }`}
                        >
                          <span className={`font-medium ${theme.bodyText}`}>
                            <span className={`${theme.accentText} mr-1`}>{entry.rank}.</span>
                            {nameMap.get(entry.playerId) ?? "Player"}
                            {isYou && <span className={`ml-0.5 ${theme.mutedText}`}>(you)</span>}
                          </span>
                          <span className={`font-bold ${theme.accentText}`}>
                            {entry.sessionPoints}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
