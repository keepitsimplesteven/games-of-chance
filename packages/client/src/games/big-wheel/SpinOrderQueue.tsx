import type { Player } from "@games-of-chance/shared"
import { useTheme } from "../../theme"

// ── SpinOrderQueue ─────────────────────────────────────────────────────────

interface SpinOrderQueueProps {
  /** Ordered list of player IDs in spin sequence */
  spinOrder: string[]
  /** Index of the currently active spinner in spinOrder */
  currentTurnIndex: number
  /** All players in the room */
  players: Player[]
}

/**
 * SpinOrderQueue — shows upcoming spinner order with visual indicators
 * for completed, active, and pending players.
 *
 * - Completed (index < currentTurnIndex): success color with ✓ checkmark
 * - Active (index === currentTurnIndex): accent highlight with → arrow
 * - Pending (index > currentTurnIndex): muted, pending
 *
 * Validates: Requirements 7.5, 10.3
 */
export function SpinOrderQueue({ spinOrder, currentTurnIndex, players }: SpinOrderQueueProps) {
  const theme = useTheme()

  return (
    <div className="w-full max-w-sm">
      <div className={`mb-1 text-center text-xs font-medium uppercase tracking-wide ${theme.mutedText}`}>
        Spin Order
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {spinOrder.map((pid, index) => {
          const player = players.find((p) => p.id === pid)
          const playerName = player?.name ?? "Unknown"
          const isDone = index < currentTurnIndex
          const isCurrent = index === currentTurnIndex

          return (
            <div
              key={pid}
              className={`rounded px-2 py-1 text-xs font-medium ${
                isDone
                  ? `${theme.statusSuccess} bg-[#7dcea0]/10 line-through`
                  : isCurrent
                    ? `${theme.accentText} bg-[#f5c542]/10 ring-1 ring-[#f5c542]`
                    : `${theme.mutedText} bg-[#0f3d18]`
              }`}
            >
              {isDone && "✓ "}
              {isCurrent && "→ "}
              {playerName}
            </div>
          )
        })}
      </div>
    </div>
  )
}
