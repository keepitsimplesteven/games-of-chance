import type { GameLeaderboardEntry, Player } from "@games-of-chance/shared"
import { useTheme } from "../../theme"
import { BaseLeaderboard } from "../../components/game/BaseLeaderboard"

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
 * BigWheelLeaderboard — Wraps BaseLeaderboard with Big Wheel–specific row slot.
 *
 * Row slot shows: spin result badges (+N), turn-order indicator (▶/◆/✓),
 * and status labels ("Spinning", "Up Next").
 * Deferred-reveal gating is applied at the container level.
 *
 * Validates: Requirements 7.2, 7.5, 7.6
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
  // Determine next spinner (if there is one)
  const nextSpinnerId =
    currentTurnIndex + 1 < spinOrder.length
      ? spinOrder[currentTurnIndex + 1]
      : null

  // If leaderboard is empty (first round before any scores), fall back to
  // spin order for display so players can see the turn order
  const entries: GameLeaderboardEntry[] =
    leaderboard.length > 0
      ? leaderboard
      : spinOrder.map((pid, i) => ({
          playerId: pid,
          playerName: players.find((p) => p.id === pid)?.name ?? "Unknown",
          rank: i + 1,
          score: 0,
        }))

  return (
    <BaseLeaderboard
      entries={entries}
      currentPlayerId={currentPlayerId}
      renderRow={(entry) => (
        <BigWheelRowSlot
          entry={entry}
          spinResults={spinResults}
          activeSpinnerId={activeSpinnerId}
          nextSpinnerId={nextSpinnerId}
          currentTurnIndex={currentTurnIndex}
          spinOrder={spinOrder}
        />
      )}
    />
  )
}

// ── BigWheelRowSlot ────────────────────────────────────────────────────────

interface BigWheelRowSlotProps {
  entry: GameLeaderboardEntry
  spinResults: Record<string, number[]>
  activeSpinnerId: string
  nextSpinnerId: string | null
  currentTurnIndex: number
  spinOrder: string[]
}

/**
 * Row slot content for Big Wheel leaderboard rows.
 * Shows turn-order indicators, status labels, and spin result badges.
 */
function BigWheelRowSlot({
  entry,
  spinResults,
  activeSpinnerId,
  nextSpinnerId,
  currentTurnIndex,
  spinOrder,
}: BigWheelRowSlotProps) {
  const theme = useTheme()

  const isActive = entry.playerId === activeSpinnerId
  const isUpNext = entry.playerId === nextSpinnerId

  // Determine if player has completed their turn
  const orderIdx = spinOrder.indexOf(entry.playerId)
  const hasDoneSpinning = orderIdx !== -1 && orderIdx < currentTurnIndex

  const playerSpins = spinResults[entry.playerId] ?? []

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Turn-order indicator */}
      {isActive && (
        <span className={`text-[10px] font-bold ${theme.accentText}`}>▶</span>
      )}
      {isUpNext && !isActive && (
        <span className={`text-[10px] ${theme.mutedText}`}>◆</span>
      )}
      {hasDoneSpinning && !isActive && !isUpNext && (
        <span className={`text-[10px] ${theme.statusSuccess}`}>✓</span>
      )}

      {/* Status label */}
      {isActive && (
        <span
          className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${theme.accentText} bg-[#f5c542]/10`}
        >
          Spinning
        </span>
      )}
      {isUpNext && !isActive && (
        <span
          className={`text-[9px] uppercase px-1 py-0.5 rounded ${theme.mutedText} bg-[#7dcea0]/10`}
        >
          Up Next
        </span>
      )}

      {/* Spin result badges (+N) */}
      {playerSpins.map((val, i) => (
        <span
          key={i}
          className={`text-[10px] font-bold px-1 py-0.5 rounded ${theme.statusSuccess} bg-[#7dcea0]/10`}
        >
          +{val}
        </span>
      ))}
    </div>
  )
}
