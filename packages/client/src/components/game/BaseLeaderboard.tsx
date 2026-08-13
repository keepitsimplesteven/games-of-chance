import { motion } from "framer-motion"
import type { GameLeaderboardEntry } from "@games-of-chance/shared"
import type { ReactNode } from "react"
import { useTheme } from "../../theme"

export interface BaseLeaderboardProps {
  /** Ordered array of player entries (sorted by rank) */
  entries: GameLeaderboardEntry[]
  /** Current user's player ID for highlight */
  currentPlayerId: string | null
  /** Layout variant */
  variant?: "default" | "compact"
  /** Enable framer-motion animations (entrance + layout). Defaults to false. */
  animate?: boolean
  /** Row-level slot: renders custom content on a second line below name */
  renderRow?: (entry: GameLeaderboardEntry) => ReactNode
  /** Score slot: renders content next to (before) the score value (e.g., +delta) */
  renderScore?: (entry: GameLeaderboardEntry) => ReactNode
  /** Header slot: renders custom content above the player list */
  renderHeader?: (entries: GameLeaderboardEntry[]) => ReactNode
}

/**
 * BaseLeaderboard — shared presentational component for all game leaderboards.
 *
 * Renders player standings with consistent rank badges, names, scores,
 * and theming. Supports slot-based extension via renderRow and renderHeader props.
 *
 * Row layout (3-column):
 *   [RankBadge]  [flex-col: Name/streak, then slot below]  [score-group: renderScore + score]
 *
 * The rank badge and score group are vertically centered against the full
 * height of the stacked content column. This matches the reference layout
 * where pick tokens go below the name but +delta sits next to the score.
 */
export function BaseLeaderboard({
  entries,
  currentPlayerId,
  variant = "default",
  animate = false,
  renderRow,
  renderScore,
  renderHeader,
}: BaseLeaderboardProps) {
  const theme = useTheme()

  if (entries.length === 0) return null

  const isCompact = variant === "compact"

  // Determine whether to use motion elements
  const useMotion = animate && !isCompact

  const containerContent = (
    <>
      {/* Header slot */}
      {renderHeader && renderHeader(entries)}

      {/* Player list */}
      <ul className={`space-y-1.5 flex-1 min-h-0 overflow-y-auto ${renderHeader ? "mt-2" : ""}`}>
        {entries.map((entry) => {
          const rowClasses = `flex items-center gap-2 rounded-md ${
            isCompact ? "px-2 py-1" : "px-2.5 py-2"
          } ${theme.listItem} ${
            entry.playerId === currentPlayerId ? theme.currentPlayerRing : ""
          }`

          const rowContent = (
            <>
              {/* Rank badge — vertically centered */}
              <RankBadge rank={entry.rank} isCompact={isCompact} />

              {/* Content column: name stacked above row slot */}
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                {/* Name + streak */}
                <div className="flex items-center gap-1 min-w-0 shrink-0">
                  <span
                    className={`font-bold truncate ${
                      isCompact ? "text-[11px]" : "text-xs"
                    } ${theme.bodyText}`}
                  >
                    {entry.playerName}
                    {entry.playerId === currentPlayerId && (
                      <span className={`ml-0.5 text-[10px] ${theme.mutedText}`}>
                        (you)
                      </span>
                    )}
                  </span>
                  {getStreakIndicator(entry.streak, entry.coldStreak) && (
                    <span className={`shrink-0 ${isCompact ? "text-[11px]" : "text-xs"}`}>
                      {getStreakIndicator(entry.streak, entry.coldStreak)}
                    </span>
                  )}
                </div>

                {/* Row slot (line 2) — suppressed in compact mode */}
                {!isCompact && renderRow && renderRow(entry)}
              </div>

              {/* Score group — vertically centered, right-aligned */}
              <div className="flex items-center gap-1 shrink-0">
                {!isCompact && renderScore && renderScore(entry)}
                <span
                  className={`font-bold tabular-nums ${
                    isCompact ? "text-[11px]" : "text-xs"
                  } ${theme.accentText}`}
                >
                  {entry.score}
                </span>
              </div>
            </>
          )

          if (useMotion) {
            return (
              <motion.li
                key={entry.playerId}
                layoutId={entry.playerId}
                layout
                transition={{ duration: 0.4 }}
                className={rowClasses}
              >
                {rowContent}
              </motion.li>
            )
          }

          return (
            <li key={entry.playerId} className={rowClasses}>
              {rowContent}
            </li>
          )
        })}
      </ul>
    </>
  )

  // Determine container classes — always full-width
  const containerClasses = `w-full h-full flex flex-col rounded-lg p-3 ${theme.card}`

  // With animations enabled (non-compact): entrance animation on mount
  if (useMotion) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={containerClasses}
      >
        {containerContent}
      </motion.div>
    )
  }

  // No animations (default) or compact mode
  return (
    <div className={containerClasses}>
      {containerContent}
    </div>
  )
}

// ── Rank Badge ─────────────────────────────────────────────────────────────

function RankBadge({ rank, isCompact }: { rank: number; isCompact: boolean }) {
  const theme = useTheme()

  const badgeStyle =
    rank === 1
      ? theme.rankBadge1
      : rank === 2
        ? theme.rankBadge2
        : rank === 3
          ? theme.rankBadge3
          : theme.rankBadgeDefault

  const sizeClass = isCompact
    ? "h-4 w-4 text-[9px]"
    : "h-5 w-5 text-[10px]"

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${sizeClass} ${badgeStyle}`}
    >
      {rank}
    </span>
  )
}

// ── Streak Indicator Helper ────────────────────────────────────────────────

function getStreakIndicator(streak?: number, coldStreak?: number): string {
  const s = streak ?? 0
  const c = coldStreak ?? 0

  if (s >= 3) return "🔥🔥"
  if (s === 2) return "🔥"
  if (c >= 3) return "🧊🧊"
  if (c === 2) return "🧊"
  return ""
}
