import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"

/**
 * PickWidget — Displays Heads/Tails buttons with a countdown timer.
 *
 * Phase guard: this component ONLY renders when phase === "PICKING" AND pickSubmitted === false.
 * The phase guard is enforced by CoinTossContainer; this component trusts it is mounted correctly.
 *
 * On button click: sends SUBMIT_PICK { pick: { side: "HEADS" | "TAILS" } } via store.submitPick,
 * which immediately sets pickSubmitted = true (optimistic) and sends to server.
 *
 * Validates: Requirements 10.1, 11.1, 11.2, 11.4, 22.2
 */
export function PickWidget() {
  const submitPick = useGameStore((s) => s.submitPick)
  const pickDeadlineMs = useGameStore(
    (s) => s.roomState?.round.pickDeadlineMs ?? null
  )

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

    // Initial tick
    tick()

    const intervalId = setInterval(tick, 100)
    return () => clearInterval(intervalId)
  }, [pickDeadlineMs])

  const handlePick = (side: "HEADS" | "TAILS") => {
    submitPick({ side })
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full px-4 py-8">
      {/* Countdown timer */}
      <div className="text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">Time remaining</p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            secondsLeft <= 3 ? "text-red-500" : "text-gray-900"
          }`}
        >
          {secondsLeft}s
        </p>
      </div>

      {/* Pick buttons — full-width on mobile, min height 64px for tap targets */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button
          type="button"
          onClick={() => handlePick("HEADS")}
          className="flex-1 min-h-[64px] rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-lg transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Heads
        </button>
        <button
          type="button"
          onClick={() => handlePick("TAILS")}
          className="flex-1 min-h-[64px] rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-lg transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        >
          Tails
        </button>
      </div>

      {/* Helpful text */}
      <p className="text-xs text-gray-400 text-center">
        Pick before time runs out!
      </p>
    </div>
  )
}
