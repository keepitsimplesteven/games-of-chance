import { useRef } from "react"
import { useGameStore } from "../store/useGameStore"

/**
 * useDeferredRevealValue — Returns a stale (previous) value while the round
 * animation is in progress, then snaps to the live value once the animation
 * completes (roundAnimationDone === true).
 *
 * This prevents score UI (leaderboards, point totals) from updating before
 * the gameplay animation has finished, avoiding spoilers.
 *
 * During PICKING phase, always returns the live value (no animation is playing).
 *
 * Usage:
 *   const displayedScores = useDeferredRevealValue(roomState.sessionLeaderboard)
 */
export function useDeferredRevealValue<T>(liveValue: T): T {
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  // During PICKING or LOBBY, always show live values (nothing to hide)
  const isRevealed = phase === "PICKING" || phase === "LOBBY" || phase === "END_GAME" || roundAnimationDone

  // Keep a ref to the last "revealed" value
  const revealedRef = useRef<T>(liveValue)

  if (isRevealed) {
    revealedRef.current = liveValue
  }

  return revealedRef.current
}
