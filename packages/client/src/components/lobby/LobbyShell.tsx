import type { ReactNode } from "react"
import { useGameStore } from "../../store/useGameStore"
import PlayerList from "./PlayerList"
import SessionLeaderboard from "./SessionLeaderboard"
import ShareLink from "./ShareLink"
import GameTileGrid from "./GameTileGrid"
import HostControls from "./HostControls"
import SettingsPanel from "./SettingsPanel"
import ConnectionStatus from "../shared/ConnectionStatus"
import GameView from "../game/GameView"
import HostControlPanel from "../../host-panel/HostControlPanel"
import ScoreAdjustmentNotification from "../../host-panel/ScoreAdjustmentNotification"

interface LobbyShellProps {
  children?: ReactNode
}

export default function LobbyShell({ children }: LobbyShellProps) {
  const phase = useGameStore((s) => s.roomState?.round.phase)

  // Show lobby content (game tiles + host controls) when in LOBBY phase
  const isLobby = !phase || phase === "LOBBY"

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-4">
      {/* Header with connection status and share icon */}
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Games of Chance</h1>
        <div className="flex items-center gap-1.5">
          <ShareLink />
          <ConnectionStatus />
        </div>
      </header>

      {/* Player list — always visible */}
      <PlayerList />

      {/* Session leaderboard — shown in lobby when games have been played */}
      {isLobby && <SessionLeaderboard />}

      {/* Lobby content: game tiles + settings + start button — only in LOBBY phase */}
      {isLobby && (
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

      {/* Game view — renders when a game is active (phase ≠ LOBBY) */}
      {!isLobby && (
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
