import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * PickWidget — Displays Heads/Tails buttons with a countdown timer.
 * Styled with retro-casino theme.
 *
 * Phase guard: this component ONLY renders when phase === "PICKING" AND pickSubmitted === false.
 * The phase guard is enforced by CoinTossContainer; this component trusts it is mounted correctly.
 *
 * Validates: Requirements 10.1, 11.1, 11.2, 11.4, 22.2
 */
export function PickWidget() {
  const submitPick = useGameStore((s) => s.submitPick)
  const pickDeadlineMs = useGameStore(
    (s) => s.roomState?.round.pickDeadlineMs ?? null
  )
  const theme = useTheme()

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    pickDeadlineMs ? Math.max(0, Math.ceil((pickDeadlineMs - Date.now()) / 1000)) : 0
  )

  // Countdown timer — updates every 100ms for smooth display
  useEffect(() => {
    if (pickDeadlineMs === null) return

    const tick = () => {
      const remaining = Math.max(0, (pickDeadlineMs - Date.now()) / 1000)
      setSecondsLeft(Math.ceil(remaining))
    }

    tick()

    const intervalId = setInterval(tick, 100)
    return () => clearInterval(intervalId)
  }, [pickDeadlineMs])

  const handlePick = (side: "HEADS" | "TAILS") => {
    submitPick({ side })
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full px-4 py-6">
      {/* Countdown timer */}
      <div className="text-center">
        <p className={`text-xs uppercase tracking-wider ${theme.mutedText}`}>Time remaining</p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            secondsLeft <= 3 ? theme.statusDanger : theme.accentText
          }`}
        >
          {secondsLeft}s
        </p>
      </div>

      {/* Pick buttons — full-width on mobile, min height 64px for tap targets */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={() => handlePick("HEADS")}
          className={`flex-1 min-h-[64px] rounded-lg text-lg font-bold uppercase tracking-wide ${theme.btnPrimary}`}
        >
          Heads
        </button>
        <button
          type="button"
          onClick={() => handlePick("TAILS")}
          className={`flex-1 min-h-[64px] rounded-lg text-lg font-bold uppercase tracking-wide ${theme.btnSecondary}`}
        >
          Tails
        </button>
      </div>

      {/* Helpful text */}
      <p className={`text-xs text-center ${theme.mutedText}`}>
        Pick before time runs out!
      </p>
    </div>
  )
}
