import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * PlayClock — Displays a countdown timer showing seconds remaining
 * in the current play clock window. Updates every second.
 */
export function PlayClock() {
  const theme = useTheme()
  const pickDeadlineMs = useGameStore((s) => s.roomState?.round.pickDeadlineMs)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!pickDeadlineMs) {
      setSecondsLeft(null)
      return
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((pickDeadlineMs! - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [pickDeadlineMs])

  if (secondsLeft === null) return null

  const isUrgent = secondsLeft <= 5

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-sm font-bold tabular-nums ${
        isUrgent
          ? "text-red-400 animate-pulse"
          : theme.mutedText
      }`}
    >
      <span aria-hidden="true">⏱</span>
      <span aria-label={`${secondsLeft} seconds remaining`}>
        {secondsLeft}s
      </span>
    </div>
  )
}
