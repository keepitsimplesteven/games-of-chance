import type { RoundPhase } from "@games-of-chance/shared"

interface PhaseIndicatorProps {
  phase: RoundPhase
  gameType?: string
}

/**
 * PhaseIndicator — displays the current game phase with game-specific text.
 *
 * - PICKING → game-specific prompt (blue)
 * - RESOLVING → game-specific action text (amber/yellow)
 * - RESULT → "Results" (green)
 * - LOBBY / END_GAME / unrecognized → renders nothing
 */
export default function PhaseIndicator({ phase, gameType }: PhaseIndicatorProps) {
  const pickingText = getPickingText(gameType)
  const resolvingText = getResolvingText(gameType)

  switch (phase) {
    case "PICKING":
      return (
        <div className="rounded-md bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
          {pickingText}
        </div>
      )
    case "RESOLVING":
      return (
        <div className="rounded-md bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
          {resolvingText}
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

function getPickingText(gameType?: string): string {
  switch (gameType) {
    case "big-wheel":
      return "Spin the Wheel!"
    case "battle-bots":
      return "Choose Your Robot"
    case "coin-toss":
    default:
      return "Pick a Side"
  }
}

function getResolvingText(gameType?: string): string {
  switch (gameType) {
    case "big-wheel":
      return "Spinning..."
    case "battle-bots":
      return "Battle!"
    case "coin-toss":
    default:
      return "Flipping..."
  }
}
