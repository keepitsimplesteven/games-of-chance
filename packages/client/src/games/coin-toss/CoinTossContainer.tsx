import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { PickWidget } from "./PickWidget"
import { CoinFlipAnimation } from "./CoinFlipAnimation"
import { ResultDisplay } from "./ResultDisplay"

// ── PickLockIndicator ──────────────────────────────────────────────────────

function PickLockIndicator() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-green-600 text-lg font-medium">
      <span>Pick locked in</span>
      <span aria-hidden="true">✓</span>
    </div>
  )
}

// ── CoinTossContainer ──────────────────────────────────────────────────────

/**
 * Container component for the Coin Toss game.
 * Manages phase-based rendering with strict phase guards to prevent
 * wrong-phase UI from appearing (e.g., "Start Round" during active rounds).
 *
 * Validates: Requirements 16.2, 16.3
 */
export function CoinTossContainer() {
  const roomState = useGameStore((s) => s.roomState)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)
  const [animationDone, setAnimationDone] = useState(false)
  const [animationStarted, setAnimationStarted] = useState(false)

  const phase = roomState?.round.phase
  const roundNumber = roomState?.round.roundNumber

  // Reset animation state when a new round begins (roundNumber changes)
  useEffect(() => {
    setAnimationDone(false)
    setAnimationStarted(false)
  }, [roundNumber])

  // Mark animation as started when we first enter RESOLVING
  useEffect(() => {
    if (phase === "RESOLVING" && !animationStarted) {
      setAnimationStarted(true)
    }
  }, [phase, animationStarted])

  const handleAnimationComplete = () => {
    setAnimationDone(true)
    useGameStore.setState({ roundAnimationDone: true })
  }

  if (!roomState) return null

  // ── Phase: PICKING ─────────────────────────────────────────────────────

  if (phase === "PICKING" && !pickSubmitted) {
    return <PickWidget />
  }

  if (phase === "PICKING" && pickSubmitted) {
    return <PickLockIndicator />
  }

  // ── Phase: RESOLVING / RESULT — show animation (only once) ─────────────

  if (phase === "RESOLVING" || phase === "RESULT") {
    return (
      <div className="flex flex-col items-center gap-4">
        {!animationDone && (
          <CoinFlipAnimation
            result={roomState.round.result}
            onAnimationComplete={handleAnimationComplete}
          />
        )}
        {animationDone && (
          <ResultDisplay
            result={roomState.round.result}
            players={roomState.players}
          />
        )}
      </div>
    )
  }

  // ── Phase: LOBBY — nothing to render in the game container ─────────────
  return null
}
