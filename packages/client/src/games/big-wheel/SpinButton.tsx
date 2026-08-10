import { motion } from "framer-motion"
import { useTheme } from "../../theme"

interface SpinButtonProps {
  /** Whether the current user is the active spinner */
  isActiveSpinner: boolean
  /** Current game phase */
  phase: string
  /** Whether the button should be disabled (e.g., pick already submitted) */
  disabled: boolean
  /** Callback when the spin button is clicked */
  onSpin: () => void
}

/**
 * SpinButton — Large "SPIN!" button visible only to the active spinner during the PICKING phase.
 * Disabled during RESOLVING or after a pick has been submitted.
 * Uses theme btnPrimary styling with a scale effect on press.
 *
 * Validates: Requirements 9.4, 9.5
 */
export function SpinButton({ isActiveSpinner, phase, disabled, onSpin }: SpinButtonProps) {
  const theme = useTheme()

  // Only render when the current user is the active spinner and phase is PICKING
  if (!isActiveSpinner || phase !== "PICKING") {
    return null
  }

  return (
    <motion.button
      type="button"
      onClick={onSpin}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      className={`
        rounded-xl px-10 py-4 text-2xl font-extrabold uppercase tracking-wide
        shadow-lg transition-colors
        focus:outline-none focus:ring-2 focus:ring-[#f5c542] focus:ring-offset-2 focus:ring-offset-[#111111]
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
        ${theme.btnPrimary}
      `}
    >
      {disabled ? "Spinning..." : "SPIN!"}
    </motion.button>
  )
}
