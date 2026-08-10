import { motion } from "framer-motion"
import type { GameLeaderboardEntry, Player } from "@games-of-chance/shared"
import { useTheme } from "../../theme"

// ── BigWheelLeaderboard ────────────────────────────────────────────────────

interface BigWheelLeaderboardProps {
  /** Game leaderboard entries (sorted by rank) — gated via useDeferredRevealValue */
  leaderboard: GameLeaderboardEntry[]
  /** Ordered list of player IDs in spin sequence */
  spinOrder: string[]
  /** Index of the currently active spinner in spinOrder */
  currentTurnIndex: number
  /** Spin results per player (gated via useDeferredRevealValue) */
  spinResults: Record<string, number[]>
  /** All players in the room */
  players: Player[]
  /** ID of the currently active spinner */
  activeSpinnerId: string
  /** Current user's player ID */
  currentPlayerId: string | null
}

/**
 * BigWheelLeaderboard — Integrated leaderboard + spin order display.
 *
 * Shows rank, player name, spin result badges (+N +N), score, and
 * active/up-next indicators. Always visible (deferred reveal prevents spoilers).
 *
 * Validates: Requirements 7.5, 10.3
 */
export function BigWheelLeaderboard({
  leaderboard,
  spinOrder,
  currentTurnIndex,
  spinResults,
  players,
  activeSpinnerId,
  currentPlayerId,
}: BigWheelLeaderboardProps) {
  const theme = useTheme()

  if (leaderboard.length === 0 && spinOrder.length === 0) return null

  // Build lookup: playerId → spin order index
  const spinOrderIndex = new Map<string, number>()
  for (let i = 0; i < spinOrder.length; i++) {
    spinOrderIndex.set(spinOrder[i], i)
  }

  // Determine next spinner (if there is one)
  const nextSpinnerId = currentTurnIndex + 1 < spinOrder.length
    ? spinOrder[currentTurnIndex + 1]
    : null

  // Merge leaderboard with spin order data — use leaderboard order (by rank)
  // If leaderboard is empty (first round), fall back to spin order for display
  const entries = leaderboard.length > 0
    ? leaderboard
    : spinOrder.map((pid, i) => ({
        playerId: pid,
        playerName: players.find((p) => p.id === pid)?.name ?? "Unknown",
        rank: i + 1,
        score: 0,
      }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`w-full max-w-sm rounded-lg p-3 ${theme.card}`}
    >
      <h3 className={`mb-2 text-center text-xs font-bold uppercase tracking-wider ${theme.cardHeader}`}>
        Leaderboard
      </h3>

      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const isCurrentPlayer = entry.playerId === currentPlayerId
          const isActive = entry.playerId === activeSpinnerId
          const isUpNext = entry.playerId === nextSpinnerId
          const orderIdx = spinOrderIndex.get(entry.playerId)
          const hasDoneSpinning = orderIdx !== undefined && orderIdx < currentTurnIndex
          const playerSpins = spinResults[entry.playerId] ?? []

          return (
            <li
              key={entry.playerId}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 ${theme.listItem} ${
                isCurrentPlayer ? "border-[#f5c542]" : ""
              } ${isActive ? "ring-1 ring-[#f5c542]" : ""}`}
            >
              {/* Rank badge */}
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                  entry.rank === 1
                    ? "bg-[#f5c542] text-[#111111]"
                    : "bg-[#1b5e2a] text-[#f0f0f0]"
                }`}
              >
                {entry.rank}
              </span>

              {/* Name + status indicator */}
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1">
                  {/* Active/Up-next indicator */}
                  {isActive && (
                    <span className={`text-[10px] font-bold uppercase ${theme.accentText}`}>
                      ▶
                    </span>
                  )}
                  {isUpNext && !isActive && (
                    <span className={`text-[10px] ${theme.mutedText}`}>
                      ◆
                    </span>
                  )}
                  {hasDoneSpinning && !isActive && (
                    <span className={`text-[10px] ${theme.statusSuccess}`}>
                      ✓
                    </span>
                  )}

                  <span className={`text-xs font-bold truncate ${theme.bodyText}`}>
                    {entry.playerName}
                    {isCurrentPlayer && (
                      <span className={`ml-0.5 text-[10px] ${theme.mutedText}`}>(you)</span>
                    )}
                  </span>

                  {/* Spinning / Up Next label */}
                  {isActive && (
                    <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${theme.accentText} bg-[#f5c542]/10`}>
                      Spinning
                    </span>
                  )}
                  {isUpNext && !isActive && (
                    <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${theme.mutedText} bg-[#7dcea0]/10`}>
                      Up Next
                    </span>
                  )}
                </div>

                {/* Spin result badges — compact +N +N format */}
                {playerSpins.length > 0 && (
                  <div className="flex items-center gap-1">
                    {playerSpins.map((val, i) => (
                      <span
                        key={i}
                        className={`text-[10px] font-bold px-1 py-0.5 rounded ${theme.statusSuccess} bg-[#7dcea0]/10`}
                      >
                        +{val}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Score */}
              <span className={`text-xs font-bold tabular-nums shrink-0 ${theme.accentText}`}>
                {entry.score}
              </span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}
