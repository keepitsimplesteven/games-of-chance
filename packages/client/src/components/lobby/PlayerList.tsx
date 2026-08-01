import { useGameStore } from "../../store/useGameStore"

/** Check if a player ID belongs to a bot */
function isBot(playerId: string): boolean {
  return playerId.startsWith("bot:")
}

export default function PlayerList() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const { players, sessionLeaderboard } = roomState

  // Sort players: humans first, then bots (preserve existing order within each group)
  const sortedPlayers = [...players].sort((a, b) => {
    const aIsBot = isBot(a.id)
    const bIsBot = isBot(b.id)
    if (aIsBot === bIsBot) return 0
    return aIsBot ? 1 : -1
  })

  // Build a lookup for session data (points, rank, gamesPlayed)
  const sessionDataMap = new Map(
    sessionLeaderboard.map((entry) => [entry.playerId, entry])
  )

  const hasSessionData = sessionLeaderboard.length > 0

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Players ({players.length})
      </h3>
      <ul className="space-y-2">
        {sortedPlayers.map((player) => {
          const isCurrentPlayer = player.id === playerId
          const isBotPlayer = isBot(player.id)
          const sessionEntry = sessionDataMap.get(player.id)
          const sessionScore = sessionEntry?.sessionPoints ?? 0
          const rank = sessionEntry?.rank
          const gamesPlayed = sessionEntry?.gamesPlayed ?? 0

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
                {/* Rank badge — only show when session data exists */}
                {hasSessionData && rank != null && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                    {rank}
                  </span>
                )}

                {/* Connection status indicator */}
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    player.connected ? "bg-green-500" : "bg-gray-400"
                  }`}
                  aria-label={player.connected ? "Connected" : "Disconnected"}
                />

                {/* Bot icon */}
                {isBotPlayer && (
                  <span className="text-sm" aria-label="Bot" title="Bot">
                    🤖
                  </span>
                )}

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

              <div className="flex items-center gap-2">
                {/* Games played — only show when session data exists */}
                {hasSessionData && gamesPlayed > 0 && (
                  <span className="text-xs text-gray-400">
                    {gamesPlayed}g
                  </span>
                )}

                {/* Session score */}
                <span className="text-xs font-medium text-gray-500">
                  {sessionScore} pts
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
