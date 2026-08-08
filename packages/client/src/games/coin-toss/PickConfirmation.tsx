import { useTheme } from "../../theme"

/**
 * PickConfirmation — Shows the player's submitted pick during PICKING and RESOLVING phases.
 * Styled with retro-casino theme.
 *
 * Visible during:
 * - PICKING (after pick submitted) — replaces PickWidget
 * - RESOLVING — alongside coin flip animation
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

interface PickConfirmationProps {
  side: "HEADS" | "TAILS"
}

export function PickConfirmation({ side }: PickConfirmationProps) {
  const theme = useTheme()
  const label = side === "HEADS" ? "Heads" : "Tails"

  return (
    <div className={`flex items-center justify-center gap-2 py-6 text-lg font-bold ${theme.statusSuccess}`}>
      <span>You chose {label}</span>
      <span aria-hidden="true">✓</span>
    </div>
  )
}
