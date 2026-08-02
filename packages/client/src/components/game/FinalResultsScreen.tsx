import { useGameStore } from "../../store/useGameStore"
import type { GameLeaderboardEntry } from "@games-of-chance/shared"

/**
 * FinalResultsScreen — plugin-agnostic component shown during END_GAME phase.
 *
 * Displays final standings in a podium layout:
 * - Top 3 players: 2nd (left), 1st (center, elevated), 3rd (right)
 * - Remaining players below in ranked order
 * - "Return to Lobby" button visible only to the host
 *
 * Handles edge cases:
 * - 0 players: renders nothing meaningful
 * - 1 player: shows only 1st place (center)
 * - 2 players: shows 1st (center) and 2nd (left), no 3rd
 *
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6
 */
export default function FinalResultsScreen() {
  const gameLeaderboard = useGameStore((s) => s.roomState?.gameLeaderboard ?? [])
  const role = useGameStore((s) => s.role)

  const handleReturnToLobby = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "RETURN_TO_LOBBY" })
    }
  }

  if (gameLeaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-lg bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">Game Over</h2>
        <p className="text-gray-500">No results to display.</p>
        {role === "host" && (
          <button
            onClick={handleReturnToLobby}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Return to Lobby
          </button>
        )}
      </div>
    )
  }

  // Sort by rank (should already be sorted, but be defensive)
  const sorted = [...gameLeaderboard].sort((a, b) => a.rank - b.rank)

  const first = sorted[0] ?? null
  const second = sorted[1] ?? null
  const third = sorted[2] ?? null
  const remaining = sorted.slice(3)

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-800">🏆 Final Results</h2>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4">
        {/* 2nd place — left */}
        {second && <PodiumSpot entry={second} place={2} />}

        {/* 1st place — center, elevated */}
        {first && <PodiumSpot entry={first} place={1} />}

        {/* 3rd place — right */}
        {third && <PodiumSpot entry={third} place={3} />}
      </div>

      {/* Remaining players */}
      {remaining.length > 0 && (
        <div className="w-full max-w-sm">
          <div className="mb-2 border-t border-gray-200 pt-4">
            <ul className="space-y-2">
              {remaining.map((entry) => (
                <li
                  key={entry.playerId}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                      {entry.rank}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {entry.playerName}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    {entry.score} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Return to Lobby — host only */}
      {role === "host" && (
        <button
          onClick={handleReturnToLobby}
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Return to Lobby
        </button>
      )}
    </div>
  )
}

// ── Podium Spot ────────────────────────────────────────────────────────────

interface PodiumSpotProps {
  entry: GameLeaderboardEntry
  place: 1 | 2 | 3
}

function PodiumSpot({ entry, place }: PodiumSpotProps) {
  const placeConfig = {
    1: {
      height: "h-32",
      bg: "bg-yellow-100",
      ring: "ring-yellow-300",
      text: "text-yellow-800",
      badge: "bg-yellow-400 text-white",
      emoji: "🥇",
    },
    2: {
      height: "h-24",
      bg: "bg-gray-100",
      ring: "ring-gray-300",
      text: "text-gray-700",
      badge: "bg-gray-400 text-white",
      emoji: "🥈",
    },
    3: {
      height: "h-20",
      bg: "bg-orange-100",
      ring: "ring-orange-300",
      text: "text-orange-800",
      badge: "bg-orange-400 text-white",
      emoji: "🥉",
    },
  }

  const config = placeConfig[place]

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Player name + score above the podium block */}
      <span className="text-lg">{config.emoji}</span>
      <span className={`text-sm font-bold ${config.text}`}>
        {entry.playerName}
      </span>
      <span className="text-xs text-gray-500">{entry.score} pts</span>

      {/* Podium block */}
      <div
        className={`flex w-20 items-center justify-center rounded-t-lg ${config.height} ${config.bg} ring-1 ${config.ring}`}
      >
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.badge}`}>
          {place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}
        </span>
      </div>
    </div>
  )
}
