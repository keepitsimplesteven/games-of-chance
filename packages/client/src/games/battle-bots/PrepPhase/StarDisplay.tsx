import { useTheme } from "../../../theme"

// ── Props ──

export interface StarDisplayProps {
  damage: number
  accuracy: number
  speed: number
}

/**
 * StarDisplay — Shows aggregate star totals for the three robot stats.
 *
 * Renders a compact row of emoji-labeled stat values that updates
 * immediately when part selections change.
 *
 * Validates: Requirements 9.3
 */
export function StarDisplay({ damage, accuracy, speed }: StarDisplayProps) {
  const theme = useTheme()

  return (
    <div
      className={`flex items-center justify-center gap-4 text-sm ${theme.bodyText}`}
      aria-label={`Stats: ${damage} damage, ${accuracy} accuracy, ${speed} speed`}
    >
      <span className="flex items-center gap-1">
        <span aria-hidden="true">⚔️</span>
        <span className="font-semibold">{damage}</span>
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true">🎯</span>
        <span className="font-semibold">{accuracy}</span>
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true">⚡</span>
        <span className="font-semibold">{speed}</span>
      </span>
    </div>
  )
}
