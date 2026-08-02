import { useGameStore } from "../../store/useGameStore"

/**
 * RoundControls — host-only controls for round/game flow.
 *
 * Phase guards prevent buttons from appearing during PICKING or RESOLVING:
 * - "Start Round": ONLY when phase ∈ {LOBBY, RESULT} AND role === "host"
 * - "Next Round": ONLY when phase === "RESULT" AND role === "host" (sends START_ROUND)
 * - "End Game": ONLY when phase === "RESULT" AND role === "host" (sends END_GAME)
 *
 * Validates: Requirements 9.1, 16.1, 16.4, 17.1, 17.2
 */
export default function RoundControls() {
  const role = useGameStore((s) => s.role)
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const roundNumber = useGameStore((s) => s.roomState?.round.roundNumber ?? 0)
  const totalRounds = useGameStore((s) => s.roomState?.gameSettings?.roundCount ?? 0)
  const startRound = useGameStore((s) => s.startRound)
  const endGame = useGameStore((s) => s.endGame)

  // Only host sees these controls
  if (role !== "host") return null

  // No buttons during PICKING or RESOLVING
  if (phase === "PICKING" || phase === "RESOLVING") return null

  // LOBBY phase: show "Start Round" only
  if (phase === "LOBBY") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={startRound}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Start Round
        </button>
      </div>
    )
  }

  // RESULT phase: show "Next Round" and "End Game" (disabled until animation done)
  // On the last round, show "View Final Results" instead of "Next Round"
  if (phase === "RESULT") {
    const isLastRound = totalRounds > 0 && roundNumber >= totalRounds

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={startRound}
          disabled={!roundAnimationDone}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastRound ? "View Final Results" : "Next Round"}
        </button>
        {!isLastRound && (
          <button
            type="button"
            onClick={endGame}
            disabled={!roundAnimationDone}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            End Game
          </button>
        )}
      </div>
    )
  }

  return null
}
