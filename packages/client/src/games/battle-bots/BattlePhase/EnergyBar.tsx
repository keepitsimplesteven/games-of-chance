interface EnergyBarProps {
  currentEnergy: number // 0–99
  maxEnergy: number // always 100
  gameSpeed: number // ms — used for transition duration
  isEliminated?: boolean // optional: controls eliminated styling
}

/**
 * EnergyBar — Displays a bot's energy accumulation progress toward the next attack.
 *
 * Renders a horizontal filled bar where the filled width equals
 * (currentEnergy / maxEnergy) * 100% of the container. Uses a blue color (#4fc3f7)
 * to differentiate from the green/gold/red HP bar. Height is h-2.5 (smaller than
 * HP bar's h-4) to establish visual hierarchy.
 *
 * Uses a linear CSS transition because energy accumulates at a constant rate.
 * Applies opacity-50 and grayscale styling when the bot is eliminated.
 * Retains last known energy value if bot is missing from energyStates
 * (handled by the parent passing the last known value).
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export function EnergyBar({ currentEnergy, maxEnergy, gameSpeed, isEliminated }: EnergyBarProps) {
  const percentage = Math.max(0, Math.min(100, (currentEnergy / maxEnergy) * 100))

  return (
    <div className="w-full">
      <div
        className={`w-full bg-[#0f2d3d] rounded-full h-2.5 overflow-hidden border border-[#2a5a7a] ${isEliminated ? "opacity-50 grayscale" : ""}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: "#4fc3f7",
            transition: `width ${gameSpeed}ms linear`,
          }}
        />
      </div>
    </div>
  )
}
