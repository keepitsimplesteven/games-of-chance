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
 * Reconnection safeguard: if the component mounts (or remounts after a refresh)
 * while the animation hasn't completed, the hook does NOT trust the initial
 * liveValue (which may already contain the resolved outcome from the server
 * STATE_SYNC). Instead it returns the provided `fallback` until the reveal
 * transition fires. Callers that need this protection should pass an appropriate
 * pre-resolution fallback (e.g. the previous leaderboard snapshot, or `[]`).
 *
 * Usage:
 *   const displayedScores = useDeferredRevealValue(roomState.sessionLeaderboard, [])
 */
export function useDeferredRevealValue<T>(liveValue: T, fallback?: T): T {
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  // During PICKING or LOBBY, always show live values (nothing to hide)
  const isRevealed = phase === "PICKING" || phase === "LOBBY" || phase === "END_GAME" || roundAnimationDone

  // Track whether this hook instance has ever witnessed a reveal transition.
  // If it hasn't, the ref may have been initialized with post-resolution data
  // from a reconnect/refresh STATE_SYNC — so we should not trust it.
  const hasSeenRevealRef = useRef(isRevealed)

  // Keep a ref to the last "revealed" value.
  // On first mount during a non-revealed phase, seed with fallback (if provided)
  // to avoid leaking the spoiler value from the server's full state dump.
  const revealedRef = useRef<T>(isRevealed ? liveValue : (fallback ?? liveValue))

  if (isRevealed) {
    hasSeenRevealRef.current = true
    revealedRef.current = liveValue
  }

  // If we've never seen a reveal AND a fallback was provided, return the fallback
  // rather than the ref (which may have been tainted on mount).
  if (!hasSeenRevealRef.current && fallback !== undefined) {
    return fallback
  }

  return revealedRef.current
}
