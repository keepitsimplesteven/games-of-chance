import type { Player } from "@games-of-chance/shared"

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
 * - Completed (index < currentTurnIndex): green with ✓ checkmark, strikethrough
 * - Active (index === currentTurnIndex): blue highlight with → arrow
 * - Pending (index > currentTurnIndex): gray, pending
 *
 * Validates: Requirements 7.5, 10.3
 */
export function SpinOrderQueue({ spinOrder, currentTurnIndex, players }: SpinOrderQueueProps) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
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
                  ? "bg-green-100 text-green-700 line-through"
                  : isCurrent
                    ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                    : "bg-gray-100 text-gray-500"
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
