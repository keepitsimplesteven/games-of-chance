import { useState, useEffect, useRef } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"
import type { BigWheelGameState, BigWheelSpinResult } from "@games-of-chance/shared"
import { WheelAnimation } from "./WheelAnimation"
import { BigWheelLeaderboard } from "./BigWheelLeaderboard"

// ── BigWheelContainer ──────────────────────────────────────────────────────

/**
 * Main container component for the Big Wheel game.
 * Reads room state from useGameStore, determines if the current user
 * is the active spinner, and routes to sub-components based on phase.
 *
 * Validates: Requirements 9.1, 9.4, 10.1
 */
export function BigWheelContainer() {
  const theme = useTheme()
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)
  const submitPick = useGameStore((s) => s.submitPick)

  if (!roomState) return null

  const phase = roomState.round.phase
  const players = roomState.players
  const bigWheelGameState = roomState.bigWheelGameState as BigWheelGameState | null | undefined
  const roundResult = roomState.round.result as BigWheelSpinResult | null

  // Gate the leaderboard behind deferred reveal to prevent spoiling spin results
  const gameLeaderboard = useDeferredRevealValue(roomState.gameLeaderboard)

  // Don't render during LOBBY or END_GAME
  if (phase === "LOBBY") return null
  if (phase === "END_GAME") return null

  // If no Big Wheel game state is available yet, show loading
  if (!bigWheelGameState) {
    return (
      <div className={`flex flex-col items-center gap-4 py-8 ${theme.mutedText}`}>
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

  // Gate spin results behind deferred reveal so leaderboard doesn't spoil
  const deferredSpinResults = useDeferredRevealValue(spinResults)

  // Determine if current user is the active spinner
  const isActiveSpinner = playerId === activeSpinnerId

  // Get active spinner player info
  const activeSpinner = players.find((p) => p.id === activeSpinnerId)
  const activeSpinnerName = activeSpinner?.name ?? "Unknown"

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
  // Track confirmed spin results — only updated after animation completes
  const [confirmedSpins, setConfirmedSpins] = useState<number[]>([])

  // Trigger spin animation when a new round result arrives (phase transitions to RESULT)
  const lastResultIdRef = useRef<string>("")

  useEffect(() => {
    if (phase === "RESULT" && roundResult) {
      const resultId = `${roundResult.spinnerPlayerId}-${roundResult.spinNumber}-${roundResult.reelIndex}`
      if (resultId !== lastResultIdRef.current) {
        if (roundResult.spinnerPlayerId === activeSpinnerId) {
          lastResultIdRef.current = resultId
          lastResultRef.current = roundResult
          setWheelLandingIndex(roundResult.reelIndex)
          setWheelSpinning(true)
        }
      }
    }
  }, [phase, roundResult, activeSpinnerId])

  // Visual spin indicator during RESOLVING
  useEffect(() => {
    if (phase === "RESOLVING" && !wheelSpinning) {
      setWheelSpinning(false)
      setWheelLandingIndex(null)
    }
  }, [phase, wheelSpinning])

  const handleSpinComplete = () => {
    setWheelSpinning(false)
    // Signal that animation is done — unlocks deferred value display
    useGameStore.setState({ roundAnimationDone: true })
    if (lastResultRef.current && lastResultRef.current.spinnerPlayerId === activeSpinnerId) {
      setConfirmedSpins((prev) => {
        const spinNum = lastResultRef.current!.spinNumber
        if (prev.length < spinNum) {
          return [...prev, lastResultRef.current!.value]
        }
        return prev
      })

      // Auto-advance to spin 2 after spin 1 animation completes — no button needed.
      // Only the active spinner (or host) triggers this to avoid race conditions.
      // For bots, the server handles auto-advance via BOT_SPIN_DELAY_MS — skip client-side.
      if (lastResultRef.current.spinNumber === 1) {
        const { role, playerId: myId } = useGameStore.getState()
        const isMeActiveSpinner = myId === activeSpinnerId
        // Check if active spinner is a bot (connectionId === null)
        const spinnerPlayer = useGameStore.getState().roomState?.players.find(
          (p) => p.id === activeSpinnerId
        )
        const isBot = spinnerPlayer?.connectionId === null
        if (!isBot && (isMeActiveSpinner || role === "host")) {
          // Linger on spin 1 result for 2s so player can register the value
          setTimeout(() => {
            useGameStore.getState().startRound()
          }, 2000)
        }
      }
    }
  }

  // Reset confirmed spins when the active spinner changes
  const prevSpinnerRef = useRef(activeSpinnerId)
  useEffect(() => {
    if (activeSpinnerId !== prevSpinnerRef.current) {
      prevSpinnerRef.current = activeSpinnerId
      setConfirmedSpins([])
      lastResultRef.current = null
      lastResultIdRef.current = ""
    }
  }, [activeSpinnerId])

  const confirmedTotal = confirmedSpins.reduce((sum, v) => sum + v, 0)

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Active Spinner Info */}
      <div className="text-center">
        <div className={`text-lg font-bold ${theme.bodyText}`}>
          {activeSpinnerName}
          {isActiveSpinner && (
            <span className={`ml-2 text-sm font-normal ${theme.accentText}`}>(You)</span>
          )}
        </div>
        <div className={`text-sm ${theme.mutedText}`}>
          Spin {phase === "RESULT" && roundResult ? roundResult.spinNumber : currentSpinNumber} of 2
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

      {/* Spin Button — shown to active spinner during PICKING phase */}
      {phase === "PICKING" && isActiveSpinner && (
        <button
          type="button"
          onClick={handleSpin}
          disabled={pickSubmitted}
          className={`rounded-lg px-8 py-3 text-lg font-bold shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${theme.btnPrimary}`}
        >
          {pickSubmitted ? "Spinning..." : "SPIN!"}
        </button>
      )}

      {/* 
        After spin 1: auto-advances to spin 2 PICKING (see handleSpinComplete).
        After spin 2 result lands: show "Next Player" / "View Results" for host and active spinner.
      */}

      {/* After spin 2 completes — "Next Player" or "View Results" button for host (always) and active spinner */}
      {phase === "RESULT" && !wheelSpinning && roundResult?.spinNumber === 2 && (isActiveSpinner || useGameStore.getState().role === "host") && (
        <button
          type="button"
          onClick={() => useGameStore.getState().startRound()}
          className={`rounded-lg px-6 py-2 text-sm font-semibold shadow-sm transition active:scale-95 ${theme.btnSecondary}`}
        >
          {currentTurnIndex >= spinOrder.length - 1 ? "View Results" : "Next Player"}
        </button>
      )}

      {/* Host override: subtle advance button during any RESULT phase the host isn't the active spinner */}
      {phase === "RESULT" && !wheelSpinning && !isActiveSpinner && useGameStore.getState().role === "host" && roundResult?.spinNumber === 1 && (
        <button
          type="button"
          onClick={() => useGameStore.getState().startRound()}
          className={`rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${theme.btnGhost}`}
        >
          Advance
        </button>
      )}

      {/* Waiting message for non-active players during PICKING */}
      {phase === "PICKING" && !isActiveSpinner && (
        <div className={`text-sm ${theme.mutedText}`}>
          Waiting for {activeSpinnerName} to spin...
        </div>
      )}

      {/* Resolving state indicator */}
      {phase === "RESOLVING" && (
        <div className={`text-sm font-medium ${theme.accentText}`}>
          Spinning...
        </div>
      )}

      {/* Spin Result Display — only shown after wheel animation completes */}
      {phase === "RESULT" && roundResult && !wheelSpinning && (
        <div className={`flex flex-col items-center gap-1 rounded-lg px-6 py-3 ${theme.card}`}>
          <div className={`text-sm ${theme.mutedText}`}>
            Spin {roundResult.spinNumber} landed on:
          </div>
          <div className={`text-3xl font-bold ${theme.accentText}`}>
            {roundResult.value}
          </div>
          {roundResult.spinTotal !== null && (
            <div className={`text-sm font-medium ${theme.bodyText}`}>
              Total: {roundResult.spinTotal}
            </div>
          )}
        </div>
      )}

      {/* Spin Results Summary — show after wheel animation completes */}
      {confirmedSpins.length > 0 && (
        <div className={`text-sm ${theme.mutedText}`}>
          {confirmedSpins.map((val, i) => (
            <span key={i}>
              Spin {i + 1}: {val}
              {i < confirmedSpins.length - 1 && " | "}
            </span>
          ))}
          <span className={`ml-2 font-medium ${theme.bodyText}`}>
            Total: {confirmedTotal}
          </span>
        </div>
      )}

      {/* Integrated Leaderboard + Spin Order */}
      <BigWheelLeaderboard
        leaderboard={gameLeaderboard}
        spinOrder={spinOrder}
        currentTurnIndex={currentTurnIndex}
        spinResults={deferredSpinResults}
        players={players}
        activeSpinnerId={activeSpinnerId}
        currentPlayerId={playerId}
      />
    </div>
  )
}
