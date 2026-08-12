import { useState, useEffect } from "react"
import { useTheme } from "../../theme"
import type { CoinTossCeremonyMatchupState } from "@games-of-chance/shared"

/**
 * CoinFlipResult — Displays the coin flip animation and result.
 *
 * Animation is synchronized across clients using the `flippedAt` timestamp.
 * Result text (winner, call correctness) is gated behind the "revealed" phase
 * per the animation-gated-results steering rule.
 *
 * The onRevealed callback fires when the animation completes, allowing parent
 * components to gate their own content behind the reveal.
 *
 * Validates: Requirements 3.2, 6.2
 */

/** Duration of the coin flip animation in milliseconds */
const FLIP_ANIMATION_DURATION_MS = 1500
/** Additional delay after landing before showing result text */
const REVEAL_DELAY_MS = 400

interface CoinFlipResultProps {
  matchupState: CoinTossCeremonyMatchupState
  getPlayerName: (id: string | null | undefined) => string
  /** Called when the flip animation is fully complete and result is visible */
  onRevealed?: () => void
}

export function CoinFlipResult({ matchupState, getPlayerName, onRevealed }: CoinFlipResultProps) {
  const theme = useTheme()
  const { flipOutcome, calledSide, callerId, chooserId, flippedAt } = matchupState

  // Determine animation phase based on flippedAt timestamp
  const [phase, setPhase] = useState<"flipping" | "landed" | "revealed">(() => {
    if (!flippedAt) return "revealed"
    const elapsed = Date.now() - flippedAt
    if (elapsed >= FLIP_ANIMATION_DURATION_MS + REVEAL_DELAY_MS) return "revealed"
    if (elapsed >= FLIP_ANIMATION_DURATION_MS) return "landed"
    return "flipping"
  })

  useEffect(() => {
    if (!flippedAt) {
      setPhase("revealed")
      onRevealed?.()
      return
    }

    const elapsed = Date.now() - flippedAt

    if (elapsed >= FLIP_ANIMATION_DURATION_MS + REVEAL_DELAY_MS) {
      setPhase("revealed")
      onRevealed?.()
      return
    }

    if (elapsed >= FLIP_ANIMATION_DURATION_MS) {
      setPhase("landed")
      const remaining = REVEAL_DELAY_MS - (elapsed - FLIP_ANIMATION_DURATION_MS)
      const revealTimer = setTimeout(() => {
        setPhase("revealed")
        onRevealed?.()
      }, remaining)
      return () => clearTimeout(revealTimer)
    }

    // Still flipping — set up timers for the remaining phases
    const timeToLand = FLIP_ANIMATION_DURATION_MS - elapsed
    const landTimer = setTimeout(() => setPhase("landed"), timeToLand)
    const revealTimer = setTimeout(() => {
      setPhase("revealed")
      onRevealed?.()
    }, timeToLand + REVEAL_DELAY_MS)

    return () => {
      clearTimeout(landTimer)
      clearTimeout(revealTimer)
    }
  }, [flippedAt])

  if (!flipOutcome || !calledSide) return null

  const callerWon = flipOutcome === calledSide
  const chooserName = getPlayerName(chooserId)
  const callerName = getPlayerName(callerId)

  return (
    <div className={`flex flex-col items-center gap-3 py-4 ${theme.font}`} role="status" aria-live="polite">
      {/* Coin animation */}
      <div
        className="relative w-16 h-16 flex items-center justify-center"
        style={{ perspective: "600px" }}
      >
        <div
          className={`
            w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold
            border-2 border-[#f5c542]/60 shadow-lg
            ${flipOutcome === "HEADS" ? "bg-[#f5c542] text-[#111111]" : "bg-[#7dcea0] text-[#111111]"}
            ${phase === "flipping" ? "animate-coin-flip" : ""}
            ${phase === "landed" ? "animate-coin-land" : ""}
          `}
          style={{
            transformStyle: "preserve-3d",
            ...(phase === "revealed" ? { transform: "rotateX(0deg)" } : {}),
          }}
          aria-hidden="true"
        >
          {phase !== "flipping" && (
            <span className="select-none font-mono">
              {flipOutcome === "HEADS" ? "H" : "T"}
            </span>
          )}
        </div>
      </div>

      {/* Result text — ONLY shown after animation fully resolves (deferred reveal) */}
      {phase === "revealed" && (
        <div className="flex flex-col items-center gap-2 animate-result-reveal">
          <div className={`text-lg font-bold tracking-wide ${theme.titleText}`}>
            {flipOutcome}
          </div>

          <div className={`text-xs ${theme.mutedText}`}>
            <span className={`font-bold ${theme.accentText}`}>{callerName}</span>
            {" called "}
            <span className={`font-bold ${theme.bodyText}`}>{calledSide}</span>
            {" — "}
            <span className={callerWon ? theme.statusSuccess : theme.statusDanger}>
              {callerWon ? "correct!" : "wrong!"}
            </span>
          </div>

          <div className={`text-sm font-bold ${theme.accentText}`}>
            🏆 {chooserName} won the toss!
          </div>
        </div>
      )}

      {/* Loading indicator during flip */}
      {phase === "flipping" && (
        <div className={`text-sm ${theme.mutedText} animate-pulse`}>
          Flipping...
        </div>
      )}

      {/* Landed but not yet revealed — show the outcome letter only */}
      {phase === "landed" && (
        <div className={`text-lg font-bold ${theme.titleText}`}>
          {flipOutcome}
        </div>
      )}
    </div>
  )
}
