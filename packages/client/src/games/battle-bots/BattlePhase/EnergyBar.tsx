import { useRef } from "react"

interface EnergyBarProps {
  currentEnergy: number // 0–99
  maxEnergy: number // always 100
  gameSpeed: number // ms — used for transition duration
  isEliminated?: boolean // optional: controls eliminated styling
}

/**
 * EnergyBar — Always visually fills from 0% → 100%, then snaps back to 0%.
 *
 * Uses a CSS @keyframes animation (width: 0% → 100%) with fill-mode: none
 * so it snaps back to 0% after each cycle.
 *
 * Fixes:
 * - First attack: the initial cycle has no overflow so duration = ticksToFirstAttack × gameSpeed.
 *   We calculate this on the very first energy value received.
 * - After elimination: if isEliminated is true, the animation is paused and
 *   the bar freezes/hides, preventing the extra fill after combat ends.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export function EnergyBar({ currentEnergy, maxEnergy, gameSpeed, isEliminated }: EnergyBarProps) {
  const prevEnergyRef = useRef(-1) // -1 = uninitialized
  const resetCountRef = useRef(0)
  const cycleDurationRef = useRef(0)
  const initializedRef = useRef(false)

  const isReset = prevEnergyRef.current >= 0 && currentEnergy < prevEnergyRef.current

  if (!initializedRef.current && currentEnergy > 0) {
    // First tick with energy data — calculate the first cycle duration.
    // On the first tick, currentEnergy = EPT (started from 0).
    // First attack fires when energy >= 100, so ticks = ceil(100 / EPT).
    const ept = currentEnergy
    const ticksInCycle = Math.max(1, Math.ceil(100 / ept))
    cycleDurationRef.current = ticksInCycle * gameSpeed
    initializedRef.current = true
  } else if (isReset) {
    resetCountRef.current += 1

    // Calculate next cycle duration from overflow
    const inferredEpt = currentEnergy - prevEnergyRef.current + 100
    const overflow = currentEnergy
    const ticksInCycle = Math.max(1, Math.ceil((100 - overflow) / inferredEpt))
    cycleDurationRef.current = ticksInCycle * gameSpeed
  }

  prevEnergyRef.current = currentEnergy

  // Don't animate if not yet initialized or if eliminated
  if (!initializedRef.current || isEliminated) {
    return (
      <div className="w-full">
        <div
          className={`w-full bg-[#0f2d3d] rounded-full h-2.5 overflow-hidden border border-[#2a5a7a] ${isEliminated ? "opacity-50 grayscale" : ""}`}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: "#4fc3f7",
              width: "0%",
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <style>{`
        @keyframes energyFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div
        className={`w-full bg-[#0f2d3d] rounded-full h-2.5 overflow-hidden border border-[#2a5a7a]`}
      >
        <div
          key={resetCountRef.current}
          className="h-full rounded-full"
          style={{
            backgroundColor: "#4fc3f7",
            width: "0%",
            animationName: "energyFill",
            animationDuration: `${cycleDurationRef.current}ms`,
            animationTimingFunction: "linear",
            animationIterationCount: 1,
            animationFillMode: "none",
          }}
        />
      </div>
    </div>
  )
}
