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
  const role = useGameStore((s) => s.role)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const [animationStarted, setAnimationStarted] = useState(false)

  const phase = roomState?.round.phase
  const roundNumber = roomState?.round.roundNumber

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

  const handleAnimationComplete = () => {
    useGameStore.setState({ roundAnimationDone: true })
  }

  const handleSkipAnimation = () => {
    // Host sends SKIP_ANIMATION to server, which broadcasts to all clients
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "SKIP_ANIMATION" })
    }
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
        {!roundAnimationDone && (
          <>
            <CoinFlipAnimation
              result={roomState.round.result}
              onAnimationComplete={handleAnimationComplete}
            />
            {/* Skip button — host can skip the animation for all players */}
            {role === "host" && (
              <button
                type="button"
                onClick={handleSkipAnimation}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 active:scale-95"
              >
                Skip
              </button>
            )}
          </>
        )}
        {roundAnimationDone && (
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
