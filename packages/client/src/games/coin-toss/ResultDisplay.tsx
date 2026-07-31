import { motion } from "framer-motion"
import type { Player, CoinTossResult, CoinTossPick } from "@games-of-chance/shared"
import { useGameStore } from "../../store/useGameStore"

interface ResultDisplayProps {
  result: unknown // CoinTossResult: { outcome: "HEADS" | "TAILS", flippedAt: number }
  players: Player[]
}

/**
 * Displays the round result after the coin flip animation completes.
 * Shows the outcome prominently, lists each player's pick, and indicates
 * whether they guessed correctly with the corresponding score delta.
 *
 * Fades in via framer-motion after CoinFlipAnimation fires onAnimationComplete.
 * Uses a vertically stacked layout on mobile viewports.
 *
 * Validates: Requirements 13.3, 13.4, 22.4
 */
export function ResultDisplay({ result, players }: ResultDisplayProps) {
  const roomState = useGameStore((s) => s.roomState)

  // Extract picks from the store's round state
  const picks = (roomState?.round.picks ?? {}) as Record<string, CoinTossPick>

  // Parse result safely
  const coinResult = result as CoinTossResult | null
  const outcome = coinResult?.outcome ?? "Unknown"

  // Only show connected players
  const connectedPlayers = players.filter((p) => p.connected)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-4 w-full px-4 py-4"
    >
      {/* Outcome label */}
      <h2 className="text-2xl sm:text-3xl font-bold text-center">
        {outcome === "HEADS" ? "🪙 Heads" : outcome === "TAILS" ? "🪙 Tails" : outcome}
      </h2>

      {/* Player results list */}
      <ul className="flex flex-col gap-2 w-full max-w-sm">
        {connectedPlayers.map((player) => {
          const pick = picks[player.id]
          const pickedCorrectly = pick?.side === outcome
          const delta = pickedCorrectly ? 10 : 0

          return (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{player.name}</span>
                <span className="text-xs text-gray-500">
                  {pick ? `Picked ${pick.side === "HEADS" ? "Heads" : "Tails"}` : "No pick"}
                </span>
              </div>
              <span
                className={`text-lg font-bold ${
                  pickedCorrectly ? "text-green-600" : "text-gray-400"
                }`}
              >
                +{delta}
              </span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}
