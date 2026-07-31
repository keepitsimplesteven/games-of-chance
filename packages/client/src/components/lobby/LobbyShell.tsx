import type { ReactNode } from "react"
import PlayerList from "./PlayerList"
import ShareLink from "./ShareLink"
import GameTileGrid from "./GameTileGrid"
import HostControls from "./HostControls"
import ConnectionStatus from "../shared/ConnectionStatus"

interface LobbyShellProps {
  children?: ReactNode
}

export default function LobbyShell({ children }: LobbyShellProps) {
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

      {/* Game tile selection grid */}
      <div className="mt-4">
        <GameTileGrid />
      </div>

      {/* Host controls (Start Game button with phase guard) */}
      <div className="mt-4">
        <HostControls />
      </div>

      {/* Children (game view, etc.) */}
      {children && (
        <div className="mt-4 flex flex-1 flex-col gap-4">{children}</div>
      )}
    </div>
  )
}
