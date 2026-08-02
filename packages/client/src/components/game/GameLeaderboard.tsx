import { useGameStore } from "../../store/useGameStore"

/**
 * Returns the streak indicator emoji for a leaderboard entry.
 * - streak=2 (2 consecutive correct) → 🔥
 * - streak≥3 (3+ consecutive correct) → 🔥🔥
 * - coldStreak=2 (2 consecutive wrong) → 🧊
 * - coldStreak≥3 (3+ consecutive wrong) → 🧊🧊
 * - Otherwise → "" (no indicator)
 */
function getStreakIndicator(streak?: number, coldStreak?: number): string {
  const s = streak ?? 0
  const c = coldStreak ?? 0

  if (s >= 3) return "🔥🔥"
  if (s === 2) return "🔥"
  if (c >= 3) return "🧊🧊"
  if (c === 2) return "🧊"
  return ""
}

export default function GameLeaderboard() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const { gameLeaderboard } = roomState

  // Only connected players appear (server already filters, but guard defensively)
  if (gameLeaderboard.length === 0) return null

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Leaderboard
      </h3>
      <ul className="space-y-1.5">
        {gameLeaderboard.map((entry) => {
          const isCurrentPlayer = entry.playerId === playerId
          const isFirst = entry.rank === 1

          return (
            <li
              key={entry.playerId}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                isCurrentPlayer
                  ? "bg-blue-50 ring-1 ring-blue-200"
                  : isFirst
                    ? "bg-yellow-50"
                    : "bg-gray-50"
              }`}
            >
              {/* Rank + Name */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isFirst
                      ? "bg-yellow-400 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {entry.rank}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {entry.playerName}
                  {isCurrentPlayer && (
                    <span className="ml-1 text-xs text-gray-500">(you)</span>
                  )}
                </span>
                {/* Streak Indicator */}
                {getStreakIndicator(entry.streak, entry.coldStreak) && (
                  <span className="text-sm">
                    {getStreakIndicator(entry.streak, entry.coldStreak)}
                  </span>
                )}
              </div>

              {/* Score */}
              <span
                className={`text-xs font-semibold ${
                  isFirst ? "text-yellow-700" : "text-gray-600"
                }`}
              >
                {entry.score} pts
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
