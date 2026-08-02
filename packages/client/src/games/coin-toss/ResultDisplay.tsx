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
 * The current player's result is rendered at the top with larger/bold text,
 * separated from other players by a visual divider. Other players appear
 * below in smaller text preserving their relative order.
 *
 * If the current player is not found in the results list, all results
 * render without any prominence styling.
 *
 * Fades in via framer-motion after CoinFlipAnimation fires onAnimationComplete.
 * Uses a vertically stacked layout on mobile viewports.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */
export function ResultDisplay({ result, players }: ResultDisplayProps) {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  // Extract picks from the store's round state
  const picks = (roomState?.round.picks ?? {}) as Record<string, CoinTossPick>

  // Parse result safely
  const coinResult = result as CoinTossResult | null
  const outcome = coinResult?.outcome ?? "Unknown"

  // Only show connected players
  const connectedPlayers = players.filter((p) => p.connected)

  // Separate current player from other players
  const currentPlayer = playerId
    ? connectedPlayers.find((p) => p.id === playerId)
    : undefined
  const otherPlayers = currentPlayer
    ? connectedPlayers.filter((p) => p.id !== playerId)
    : connectedPlayers

  // Determine if we should apply prominence styling
  const hasCurrentPlayer = !!currentPlayer

  const correctGuessChips =
    Number(roomState?.gameSettings?.tuning?.CORRECT_GUESS_CHIPS) || 10

  function renderPlayerEntry(
    player: Player,
    isProminent: boolean
  ) {
    const pick = picks[player.id]
    const pickedCorrectly = pick?.side === outcome
    const delta = pickedCorrectly ? correctGuessChips : 0

    return (
      <li
        key={player.id}
        className={`flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 ${
          isProminent ? "text-lg font-bold" : "text-sm"
        }`}
      >
        <div className="flex flex-col">
          <span
            className={`text-gray-900 ${
              isProminent ? "font-bold text-lg" : "font-medium text-sm"
            }`}
          >
            {player.name}
          </span>
          <span
            className={`text-gray-500 ${
              isProminent ? "text-sm" : "text-xs"
            }`}
          >
            {pick ? `Picked ${pick.side === "HEADS" ? "Heads" : "Tails"}` : "No pick"}
          </span>
        </div>
        <span
          className={`font-bold ${
            pickedCorrectly ? "text-green-600" : "text-gray-400"
          } ${isProminent ? "text-xl" : "text-lg"}`}
        >
          +{delta}
        </span>
      </li>
    )
  }

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
        {hasCurrentPlayer ? (
          <>
            {/* Current player at index 0 with prominence */}
            {renderPlayerEntry(currentPlayer, true)}

            {/* Visual separator */}
            {otherPlayers.length > 0 && (
              <li className="border-b border-gray-300 my-1" aria-hidden="true" />
            )}

            {/* Other players in smaller text */}
            {otherPlayers.map((player) => renderPlayerEntry(player, false))}
          </>
        ) : (
          /* No current player found — render all without prominence */
          connectedPlayers.map((player) => renderPlayerEntry(player, false))
        )}
      </ul>
    </motion.div>
  )
}
