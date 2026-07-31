import { useGameStore } from "../../store/useGameStore"

/**
 * SessionLeaderboard — displays cumulative session rankings between games.
 * Shown in the lobby when at least one game has been completed (sessionLeaderboard is non-empty).
 * Shows each player's rank, name, session points, and games played.
 */
export default function SessionLeaderboard() {
  const sessionLeaderboard = useGameStore((s) => s.roomState?.sessionLeaderboard)
  const playerId = useGameStore((s) => s.playerId)

  // Only render when there's session data (at least one game played)
  if (!sessionLeaderboard || sessionLeaderboard.length === 0) return null

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Session Standings
      </h3>
      <div className="space-y-1">
        {sessionLeaderboard.map((entry) => {
          const isCurrentPlayer = entry.playerId === playerId
          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                isCurrentPlayer
                  ? "bg-indigo-50 ring-1 ring-indigo-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Rank badge */}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700">
                  {entry.rank}
                </span>

                {/* Player name */}
                <span className="text-sm font-medium text-gray-800">
                  {entry.playerName}
                  {isCurrentPlayer && (
                    <span className="ml-1 text-xs text-gray-500">(you)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Games played */}
                <span className="text-xs text-gray-400">
                  {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "game" : "games"}
                </span>

                {/* Session points */}
                <span className="text-sm font-semibold text-indigo-600">
                  {entry.sessionPoints} pts
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
