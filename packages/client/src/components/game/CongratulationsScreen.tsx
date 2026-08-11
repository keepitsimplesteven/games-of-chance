import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { GameLeaderboardEntry } from "@games-of-chance/shared"

/**
 * CongratulationsScreen — shown after the final game in a tournament session
 * (END_TOURNAMENT phase / isFinale game).
 *
 * Retains the podium layout from the original FinalResultsScreen:
 * - Top 3 players: 2nd (left), 1st (center, elevated), 3rd (right)
 * - Remaining players below in ranked order
 * - "Return to Lobby" button visible only to the host
 *
 * Validates: Requirements 6.5, 6.6
 */
export default function CongratulationsScreen() {
  const theme = useTheme()
  const sessionLeaderboard = useGameStore(
    (s) => s.roomState?.sessionLeaderboard ?? []
  )
  const role = useGameStore((s) => s.role)

  const handleReturnToLobby = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "RETURN_TO_LOBBY" })
    }
  }

  if (sessionLeaderboard.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-6 rounded-lg p-8 shadow-sm ${theme.card}`}>
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>
          🎉 Congratulations!
        </h2>
        <p className={theme.mutedText}>No results to display.</p>
        {role === "host" && (
          <button
            onClick={handleReturnToLobby}
            className={`rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition ${theme.btnPrimary}`}
          >
            Return to Lobby
          </button>
        )}
      </div>
    )
  }

  // Sort by rank (should already be sorted, but be defensive)
  const sorted = [...sessionLeaderboard].sort((a, b) => a.rank - b.rank)

  const first = sorted[0] ?? null
  const second = sorted[1] ?? null
  const third = sorted[2] ?? null
  const remaining = sorted.slice(3)

  return (
    <div className={`flex flex-col items-center gap-6 rounded-lg p-8 shadow-sm ${theme.card}`}>
      <h2 className={`text-2xl font-bold ${theme.titleText}`}>
        🎉 Congratulations!
      </h2>
      <p className={theme.mutedText}>Tournament complete — final standings</p>

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
          <div className={`mb-2 border-t pt-4 ${theme.mutedText}`}>
            <ul className="space-y-2">
              {remaining.map((entry) => (
                <li
                  key={entry.playerId}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${theme.listItem}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${theme.rankBadgeDefault}`}
                    >
                      {entry.rank}
                    </span>
                    <span className={`text-sm font-medium ${theme.bodyText}`}>
                      {entry.playerName}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold tabular-nums ${theme.accentText}`}
                  >
                    {entry.sessionPoints} pts
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
          className={`rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition ${theme.btnPrimary}`}
        >
          Return to Lobby
        </button>
      )}
    </div>
  )
}

// ── Podium Spot ────────────────────────────────────────────────────────────

interface PodiumSpotProps {
  entry: { playerId: string; playerName: string; sessionPoints: number; rank: number }
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
      <span className="text-xs text-gray-500">{entry.sessionPoints} pts</span>

      {/* Podium block */}
      <div
        className={`flex w-20 items-center justify-center rounded-t-lg ${config.height} ${config.bg} ring-1 ${config.ring}`}
      >
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.badge}`}
        >
          {place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}
        </span>
      </div>
    </div>
  )
}
