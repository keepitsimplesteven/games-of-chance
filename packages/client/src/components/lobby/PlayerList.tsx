import { useGameStore } from "../../store/useGameStore"

export default function PlayerList() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const { players, sessionLeaderboard } = roomState

  // Build a lookup for session scores
  const sessionScoreMap = new Map(
    sessionLeaderboard.map((entry) => [entry.playerId, entry.sessionPoints])
  )

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Players ({players.length})
      </h3>
      <ul className="space-y-2">
        {players.map((player) => {
          const isCurrentPlayer = player.id === playerId
          const sessionScore = sessionScoreMap.get(player.id) ?? 0

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                isCurrentPlayer
                  ? "bg-blue-50 ring-1 ring-blue-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Connection status indicator */}
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    player.connected ? "bg-green-500" : "bg-gray-400"
                  }`}
                  aria-label={player.connected ? "Connected" : "Disconnected"}
                />

                {/* Player name */}
                <span className="text-sm font-medium text-gray-800">
                  {player.name}
                  {isCurrentPlayer && (
                    <span className="ml-1 text-xs text-gray-500">(you)</span>
                  )}
                </span>

                {/* Host badge */}
                {player.role === "host" && (
                  <span className="text-sm" aria-label="Host" title="Host">
                    👑
                  </span>
                )}
              </div>

              {/* Session score */}
              <span className="text-xs font-medium text-gray-500">
                {sessionScore} pts
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
