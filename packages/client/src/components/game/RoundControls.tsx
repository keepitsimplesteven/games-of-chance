import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

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
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const roundNumber = useGameStore((s) => s.roomState?.round.roundNumber ?? 0)
  const totalRounds = useGameStore((s) => s.roomState?.gameSettings?.roundCount ?? 0)
  const roundResult = useGameStore((s) => s.roomState?.round.result)
  const startRound = useGameStore((s) => s.startRound)
  const endGame = useGameStore((s) => s.endGame)
  const theme = useTheme()

  // Only host sees these controls
  if (role !== "host") return null

  // Big Wheel has its own advance controls in BigWheelContainer
  if (gameType === "big-wheel" && phase === "RESULT") return null

  // No buttons during PICKING or RESOLVING
  if (phase === "PICKING" || phase === "RESOLVING") return null

  // LOBBY phase: show "Start Round" only
  if (phase === "LOBBY") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={startRound}
          className={`w-full px-4 py-3 text-base font-bold uppercase tracking-wider active:scale-[0.98] ${theme.btnPrimary}`}
        >
          Start Round
        </button>
      </div>
    )
  }

  // RESULT phase: show "Next Round" and "End Game" (disabled until animation done)
  // On the last round, show "View Final Results" instead of "Next Round"
  if (phase === "RESULT") {
    // For playcaller, check if the bracket is fully complete (from the round result)
    const isLastRound = gameType === "playcaller"
      ? (roundResult as { isComplete?: boolean } | null)?.isComplete === true
      : totalRounds > 0 && roundNumber >= totalRounds

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={startRound}
          disabled={!roundAnimationDone}
          className={`w-full px-4 py-3 text-base font-bold uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${theme.btnPrimary}`}
        >
          {isLastRound ? "View Final Results" : "Next Round"}
        </button>
        {!isLastRound && (
          <button
            type="button"
            onClick={endGame}
            disabled={!roundAnimationDone}
            className={`w-full px-4 py-3 text-base font-bold uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${theme.btnGhost}`}
          >
            End Game
          </button>
        )}
      </div>
    )
  }

  return null
}
