import { useState, useEffect } from "react"
import { useTheme } from "../../theme"

interface CoinTossCountdownProps {
  /** Deadline timestamp in epoch ms (coinCallDeadlineMs or sideChoiceDeadlineMs) */
  deadlineMs: number | null
}

/**
 * CoinTossCountdown — Displays a countdown timer showing seconds remaining
 * until the coin call or side choice deadline expires.
 *
 * Follows the PlayClock pattern: calculates remaining time from deadline,
 * updates every second, shows urgency cues when time is running low.
 *
 * Validates: Requirements 7.1, 7.3
 */
export function CoinTossCountdown({ deadlineMs }: CoinTossCountdownProps) {
  const theme = useTheme()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!deadlineMs) {
      setSecondsLeft(null)
      return
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((deadlineMs! - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadlineMs])

  if (secondsLeft === null) return null

  const isUrgent = secondsLeft <= 5

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-sm font-bold tabular-nums ${
        isUrgent ? "text-[#cc3333] animate-pulse" : theme.mutedText
      }`}
    >
      <span aria-hidden="true">⏱</span>
      <span aria-label={`${secondsLeft} seconds remaining`}>{secondsLeft}s</span>
    </div>
  )
}
