import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * SessionLeaderboard — displays cumulative session rankings between games.
 * Shown in the lobby when at least one game has been completed (sessionLeaderboard is non-empty).
 * Shows each player's rank, name, session points, and games played.
 */
export default function SessionLeaderboard() {
  const sessionLeaderboard = useGameStore((s) => s.roomState?.sessionLeaderboard)
  const playerId = useGameStore((s) => s.playerId)
  const theme = useTheme()

  // Only render when there's session data (at least one game played)
  if (!sessionLeaderboard || sessionLeaderboard.length === 0) return null

  return (
    <div className={`rounded-lg p-4 shadow-sm ${theme.card}`}>
      <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${theme.mutedText}`}>
        Session Standings
      </h3>
      <div className="space-y-1">
        {sessionLeaderboard.map((entry) => {
          const isCurrentPlayer = entry.playerId === playerId
          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${theme.listItem}`}
            >
              <div className="flex items-center gap-2">
                {/* Rank badge */}
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${theme.bodyText} ${theme.listItem}`}>
                  {entry.rank}
                </span>

                {/* Player name */}
                <span className={`text-sm font-medium ${theme.bodyText}`}>
                  {entry.playerName}
                  {isCurrentPlayer && (
                    <span className={`ml-1 text-xs ${theme.mutedText}`}>(you)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Games played */}
                <span className={`text-xs ${theme.mutedText}`}>
                  {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "game" : "games"}
                </span>

                {/* Session points */}
                <span className={`text-sm font-semibold ${theme.accentText}`}>
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
