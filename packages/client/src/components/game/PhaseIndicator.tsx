import type { RoundPhase } from "@games-of-chance/shared"
import { useTheme } from "../../theme"

interface PhaseIndicatorProps {
  phase: RoundPhase
  gameType?: string
}

/**
 * PhaseIndicator — displays the current game phase with game-specific text.
 *
 * - PICKING → game-specific prompt (accent/gold)
 * - RESOLVING → game-specific action text (body/neutral)
 * - RESULT → "Results" (success/green)
 * - LOBBY / END_GAME / unrecognized → renders nothing
 *
 * Styled with retro-casino theme tokens.
 */
export default function PhaseIndicator({ phase, gameType }: PhaseIndicatorProps) {
  const theme = useTheme()
  const pickingText = getPickingText(gameType)
  const resolvingText = getResolvingText(gameType)

  switch (phase) {
    case "PICKING":
      return (
        <div className={`rounded-md border-2 border-[#f5c542]/40 bg-[#f5c542]/10 px-4 py-2 text-center text-sm font-semibold ${theme.accentText} ${theme.font}`}>
          {pickingText}
        </div>
      )
    case "RESOLVING":
      return (
        <div className={`rounded-md border-2 border-[#2a7a3a] bg-[#0f3d18] px-4 py-2 text-center text-sm font-semibold ${theme.bodyText} ${theme.font}`}>
          {resolvingText}
        </div>
      )
    case "RESULT":
      return (
        <div className={`rounded-md border-2 border-[#3a9a4a] bg-[#3a9a4a]/10 px-4 py-2 text-center text-sm font-semibold ${theme.statusSuccess} ${theme.font}`}>
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
