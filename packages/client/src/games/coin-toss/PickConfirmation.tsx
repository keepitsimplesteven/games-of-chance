/**
 * PickConfirmation — Shows the player's submitted pick during PICKING and RESOLVING phases.
 *
 * Visible during:
 * - PICKING (after pick submitted) — replaces PickWidget
 * - RESOLVING — alongside coin flip animation
 *
 * Hidden during:
 * - RESULT — replaced by ResultDisplay
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

interface PickConfirmationProps {
  side: "HEADS" | "TAILS"
}

export function PickConfirmation({ side }: PickConfirmationProps) {
  const label = side === "HEADS" ? "Heads" : "Tails"

  return (
    <div className="flex items-center justify-center gap-2 py-8 text-green-600 text-lg font-medium">
      <span>You chose {label}</span>
      <span aria-hidden="true">✓</span>
    </div>
  )
}
