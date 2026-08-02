import { useState, useEffect, useRef } from "react"
import { useGameStore } from "../../store/useGameStore"
import type { BigWheelGameState, BigWheelSpinResult } from "@games-of-chance/shared"
import { WheelAnimation } from "./WheelAnimation"

// ── BigWheelContainer ──────────────────────────────────────────────────────

/**
 * Main container component for the Big Wheel game.
 * Reads room state from useGameStore, determines if the current user
 * is the active spinner, and routes to sub-components based on phase.
 *
 * Validates: Requirements 9.1, 9.4, 10.1
 */
export function BigWheelContainer() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)
  const submitPick = useGameStore((s) => s.submitPick)

  if (!roomState) return null

  const phase = roomState.round.phase
  const players = roomState.players
  const bigWheelGameState = roomState.bigWheelGameState as BigWheelGameState | null | undefined
  const roundResult = roomState.round.result as BigWheelSpinResult | null

  // Don't render during LOBBY or if no Big Wheel state
  if (phase === "LOBBY") return null
  if (phase === "END_GAME") return null

  // If no Big Wheel game state is available yet, show loading
  if (!bigWheelGameState) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-gray-500">
        Waiting for game state...
      </div>
    )
  }

  const {
    spinOrder,
    currentTurnIndex,
    currentSpinNumber,
    activeSpinnerId,
    spinResults,
    reelStrip,
  } = bigWheelGameState

  // Determine if current user is the active spinner
  const isActiveSpinner = playerId === activeSpinnerId

  // Get active spinner player info
  const activeSpinner = players.find((p) => p.id === activeSpinnerId)
  const activeSpinnerName = activeSpinner?.name ?? "Unknown"

  // Get the active spinner's results so far
  const activeSpinnerResults = spinResults[activeSpinnerId] ?? []
  const spinTotal = activeSpinnerResults.reduce((sum, v) => sum + v, 0)

  // Handle spin button click
  const handleSpin = () => {
    if (isActiveSpinner && !pickSubmitted) {
      submitPick({ type: "spin" })
    }
  }

  // Track wheel animation state — spin starts when we receive a result,
  // and finishes after the animation completes
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelLandingIndex, setWheelLandingIndex] = useState<number | null>(null)
  const lastResultRef = useRef<BigWheelSpinResult | null>(null)

  // Trigger spin animation when a new round result arrives (phase transitions to RESULT)
  useEffect(() => {
    if (phase === "RESULT" && roundResult && roundResult !== lastResultRef.current) {
      lastResultRef.current = roundResult
      setWheelLandingIndex(roundResult.reelIndex)
      setWheelSpinning(true)
    }
  }, [phase, roundResult])

  // Also trigger a visual "fast spin" during RESOLVING before the result comes back
  useEffect(() => {
    if (phase === "RESOLVING" && !wheelSpinning) {
      // Start a visual spin with no target — the real target will arrive shortly
      setWheelSpinning(false)
      setWheelLandingIndex(null)
    }
  }, [phase, wheelSpinning])

  const handleSpinComplete = () => {
    setWheelSpinning(false)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Active Spinner Info */}
      <div className="text-center">
        <div className="text-lg font-bold text-gray-800">
          {activeSpinnerName}
          {isActiveSpinner && (
            <span className="ml-2 text-sm font-normal text-blue-600">(You)</span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Spin {currentSpinNumber} of 2
        </div>
      </div>

      {/* Animated Wheel */}
      <div className="w-64 h-64 sm:w-80 sm:h-80">
        <WheelAnimation
          reelStrip={reelStrip}
          isSpinning={wheelSpinning}
          landingIndex={wheelLandingIndex}
          onSpinComplete={handleSpinComplete}
        />
      </div>

      {/* Spin Button — only shown to active spinner during PICKING phase */}
      {phase === "PICKING" && isActiveSpinner && (
        <button
          type="button"
          onClick={handleSpin}
          disabled={pickSubmitted}
          className="rounded-lg bg-red-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pickSubmitted ? "Spinning..." : "SPIN!"}
        </button>
      )}

      {/* Waiting message for non-active players during PICKING */}
      {phase === "PICKING" && !isActiveSpinner && (
        <div className="text-sm text-gray-500">
          Waiting for {activeSpinnerName} to spin...
        </div>
      )}

      {/* Resolving state indicator */}
      {phase === "RESOLVING" && (
        <div className="text-sm font-medium text-amber-600">
          Spinning...
        </div>
      )}

      {/* Spin Result Display — only shown after wheel animation completes */}
      {phase === "RESULT" && roundResult && !wheelSpinning && (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-green-50 px-6 py-3">
          <div className="text-sm text-gray-600">
            Spin {roundResult.spinNumber} landed on:
          </div>
          <div className="text-3xl font-bold text-green-700">
            {roundResult.value}
          </div>
          {roundResult.spinTotal !== null && (
            <div className="text-sm font-medium text-gray-700">
              Total: {roundResult.spinTotal}
            </div>
          )}
        </div>
      )}

      {/* Spin Results Summary — show accumulated spins for active spinner */}
      {activeSpinnerResults.length > 0 && phase !== "RESULT" && (
        <div className="text-sm text-gray-600">
          {activeSpinnerResults.map((val, i) => (
            <span key={i}>
              Spin {i + 1}: {val}
              {i < activeSpinnerResults.length - 1 && " | "}
            </span>
          ))}
          {activeSpinnerResults.length > 0 && (
            <span className="ml-2 font-medium">
              Total: {spinTotal}
            </span>
          )}
        </div>
      )}

      {/* Spin Order Queue */}
      <div className="mt-4 w-full max-w-sm">
        <div className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
          Spin Order
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {spinOrder.map((pid, index) => {
            const player = players.find((p) => p.id === pid)
            const isDone = index < currentTurnIndex
            const isCurrent = index === currentTurnIndex
            return (
              <div
                key={pid}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  isDone
                    ? "bg-green-100 text-green-700 line-through"
                    : isCurrent
                      ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {isDone && "✓ "}
                {isCurrent && "→ "}
                {player?.name ?? "Unknown"}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
