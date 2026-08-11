import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { computeRankChanges } from "../../utils/rankChange"

/**
 * GameCompleteScreen — shown during END_GAME phase for non-finale games.
 *
 * Displays:
 * - "Game complete!" heading with "Updated standings" subtext
 * - Session leaderboard as ranked list with rank, player name, session points
 * - Riser/faller indicators computed from preGameRanks snapshot
 * - "Return to Lobby" button (host only)
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 5.3, 5.4, 5.5, 5.6
 */
export default function GameCompleteScreen() {
  const sessionLeaderboard = useGameStore(
    (s) => s.roomState?.sessionLeaderboard ?? []
  )
  const preGameRanks = useGameStore(
    (s) => s.roomState?.preGameRanks ?? {}
  )
  const role = useGameStore((s) => s.role)
  const theme = useTheme()

  const rankChanges = computeRankChanges(preGameRanks, sessionLeaderboard)

  const handleReturnToLobby = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "RETURN_TO_LOBBY" })
    }
  }

  // Sort by rank (should already be sorted, but be defensive)
  const sorted = [...sessionLeaderboard].sort((a, b) => a.rank - b.rank)

  return (
    <div
      className={`flex flex-col items-center gap-6 rounded-lg p-8 shadow-sm ${theme.card}`}
    >
      {/* Heading */}
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>
          Game complete!
        </h2>
        <p className={`mt-1 text-sm ${theme.mutedText}`}>Updated standings</p>
      </div>

      {/* Session leaderboard ranked list */}
      {sorted.length > 0 && (
        <ul className="w-full max-w-sm space-y-2">
          {sorted.map((entry) => {
            const delta = rankChanges[entry.playerId] ?? 0

            return (
              <li
                key={entry.playerId}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${theme.listItem}`}
              >
                <div className="flex items-center gap-2">
                  {/* Rank badge */}
                  <RankBadge rank={entry.rank} theme={theme} />
                  {/* Player name */}
                  <span
                    className={`truncate text-sm font-medium ${theme.bodyText}`}
                  >
                    {entry.playerName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Riser/Faller indicator */}
                  <RankChangeIndicator delta={delta} />
                  {/* Session points */}
                  <span
                    className={`text-xs font-semibold tabular-nums ${theme.accentText}`}
                  >
                    {entry.sessionPoints} pts
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
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

// ── Rank Badge ─────────────────────────────────────────────────────────────

interface RankBadgeProps {
  rank: number
  theme: ReturnType<typeof useTheme>
}

function RankBadge({ rank, theme }: RankBadgeProps) {
  const badgeClass =
    rank === 1
      ? theme.rankBadge1
      : rank === 2
        ? theme.rankBadge2
        : rank === 3
          ? theme.rankBadge3
          : theme.rankBadgeDefault

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${badgeClass}`}
    >
      {rank}
    </span>
  )
}

// ── Rank Change Indicator ──────────────────────────────────────────────────

interface RankChangeIndicatorProps {
  delta: number
}

function RankChangeIndicator({ delta }: RankChangeIndicatorProps) {
  if (delta === 0) return null

  if (delta > 0) {
    // Riser — green up arrow
    return (
      <span className="text-xs font-semibold text-green-500">
        ↑{delta}
      </span>
    )
  }

  // Faller — red down arrow (delta is negative, display absolute)
  return (
    <span className="text-xs font-semibold text-red-500">
      ↓{Math.abs(delta)}
    </span>
  )
}
