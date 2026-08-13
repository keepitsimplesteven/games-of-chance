import { useState, useEffect, useCallback } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { PickWidget } from "./PickWidget"
import { PickConfirmation } from "./PickConfirmation"
import { CoinFlipAnimation } from "./CoinFlipAnimation"
import { CoinIdleSpin } from "./CoinIdleSpin"
import { CoinTossLeaderboard } from "./CoinTossLeaderboard"
import { RoundCounter } from "./RoundCounter"

// ── CoinTossContainer ──────────────────────────────────────────────────────

/**
 * Container component for the Coin Toss game.
 * Manages phase-based rendering with strict phase guards.
 * Uses retro-casino theme and the combined CoinTossLeaderboard.
 *
 * The CoinTossLeaderboard replaces both the old ResultDisplay and the generic
 * GameLeaderboard — it shows the toss sequence, per-player accuracy, streaks,
 * and correct score deltas (accounting for multiplier).
 *
 * Validates: Requirements 16.2, 16.3
 */
export function CoinTossContainer() {
  const roomState = useGameStore((s) => s.roomState)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)
  const currentPick = useGameStore((s) => s.currentPick)
  const role = useGameStore((s) => s.role)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const theme = useTheme()
  const [animationStarted, setAnimationStarted] = useState(false)

  const phase = roomState?.round.phase
  const roundNumber = roomState?.round.roundNumber
  const totalRounds = roomState?.gameSettings.roundCount ?? 1

  // Reset animation state when a new round begins (roundNumber changes)
  useEffect(() => {
    setAnimationStarted(false)
  }, [roundNumber])

  // Mark animation as started when we first enter RESOLVING
  useEffect(() => {
    if (phase === "RESOLVING" && !animationStarted) {
      setAnimationStarted(true)
    }
  }, [phase, animationStarted])

  const handleAnimationComplete = useCallback(() => {
    useGameStore.setState({ roundAnimationDone: true })
  }, [])

  const handleSkipAnimation = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "SKIP_ANIMATION" })
    }
  }

  if (!roomState) return null

  // ── Phase: LOBBY — nothing to render in the game container
  if (phase === "LOBBY" || phase === "END_GAME") return null

  // Show the leaderboard during PICKING (previous round data, already revealed)
  // and after animation completes in RESULT phase
  const showLeaderboard = phase === "PICKING" || roundAnimationDone

  return (
    <div className="flex flex-col items-center gap-3 h-full overflow-hidden">
      <RoundCounter currentRound={roundNumber ?? 1} totalRounds={totalRounds} />

      {/* ── Phase: PICKING ──────────────────────────────────────────────── */}
      {phase === "PICKING" && <CoinIdleSpin />}
      {phase === "PICKING" && !pickSubmitted && <PickWidget />}
      {phase === "PICKING" && pickSubmitted && currentPick != null && (
        <PickConfirmation side={(currentPick as { side: "HEADS" | "TAILS" }).side} />
      )}

      {/* ── Phase: RESOLVING / RESULT — show animation (only once) ──────── */}
      {(phase === "RESOLVING" || phase === "RESULT") && (
        <>
          {phase === "RESOLVING" && currentPick != null && (
            <PickConfirmation side={(currentPick as { side: "HEADS" | "TAILS" }).side} />
          )}
          <CoinFlipAnimation
            result={roomState.round.result}
            onAnimationComplete={handleAnimationComplete}
          />
          {!roundAnimationDone && role === "host" && (
            <button
              type="button"
              onClick={handleSkipAnimation}
              className={`rounded-md px-4 py-2 text-sm font-bold ${theme.btnGhost}`}
            >
              Skip
            </button>
          )}
          {/* Show outcome label after animation */}
          {roundAnimationDone && (
            <OutcomeLabel result={roomState.round.result} />
          )}
        </>
      )}

      {/* Combined leaderboard — visible during PICKING and after animation in RESULT */}
      {showLeaderboard && (
        <div className="w-full px-2 flex-1 min-h-0 overflow-hidden">
          <CoinTossLeaderboard />
        </div>
      )}
    </div>
  )
}

// ── Outcome Label ──────────────────────────────────────────────────────────

function OutcomeLabel({ result }: { result: unknown }) {
  const theme = useTheme()
  const coinResult = result as { outcome?: string } | null
  const outcome = coinResult?.outcome ?? "Unknown"
  const label = outcome === "HEADS" ? "🪙 Heads" : outcome === "TAILS" ? "🪙 Tails" : outcome

  return (
    <h2 className={`text-xl font-bold text-center ${theme.titleText}`}>
      {label}
    </h2>
  )
}
