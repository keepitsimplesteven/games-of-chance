import type { RoundPhase } from "@games-of-chance/shared"

interface PhaseIndicatorProps {
  phase: RoundPhase
}

/**
 * PhaseIndicator — plugin-agnostic component that displays the current game phase.
 *
 * Renders distinct text and styling for each active phase:
 * - PICKING → "Pick a Side" (blue)
 * - RESOLVING → "Flipping..." (amber/yellow)
 * - RESULT → "Results" (green)
 * - LOBBY / END_GAME / unrecognized → renders nothing
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
export default function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  switch (phase) {
    case "PICKING":
      return (
        <div className="rounded-md bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
          Pick a Side
        </div>
      )
    case "RESOLVING":
      return (
        <div className="rounded-md bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
          Flipping...
        </div>
      )
    case "RESULT":
      return (
        <div className="rounded-md bg-green-50 px-4 py-2 text-center text-sm font-semibold text-green-700 ring-1 ring-green-200">
          Results
        </div>
      )
    default:
      return null
  }
}
