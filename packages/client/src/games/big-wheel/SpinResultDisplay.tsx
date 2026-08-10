import { motion } from "framer-motion"
import { useTheme } from "../../theme"

interface SpinResultDisplayProps {
  /** The value the wheel landed on for the current spin, or null if not yet resolved */
  value: number | null
  /** Which spin just completed (1 or 2) */
  spinNumber: 1 | 2
  /** Running total of all spins so far, or null if no spins completed */
  spinTotal: number | null
  /** Array of previous spin values for this player's turn */
  previousSpins: number[]
}

/**
 * SpinResultDisplay — Shows the landed value prominently when available,
 * the running spin total, and both spin results if available.
 *
 * Validates: Requirements 9.5
 */
export function SpinResultDisplay({
  value,
  spinNumber,
  spinTotal,
  previousSpins,
}: SpinResultDisplayProps) {
  const theme = useTheme()

  // Nothing to display if no value has been resolved
  if (value === null && previousSpins.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex flex-col items-center gap-2 rounded-lg px-6 py-4 ${theme.card}`}
    >
      {/* Current spin result */}
      {value !== null && (
        <>
          <div className={`text-sm ${theme.mutedText}`}>
            Spin {spinNumber} landed on:
          </div>
          <div className={`text-4xl font-extrabold ${theme.accentText}`}>
            {value}
          </div>
        </>
      )}

      {/* Individual spin breakdown */}
      {previousSpins.length > 0 && (
        <div className={`flex items-center gap-3 text-sm ${theme.mutedText}`}>
          {previousSpins.map((val, i) => (
            <span key={i} className={`rounded px-2 py-0.5 font-medium ${theme.listItem}`}>
              Spin {i + 1}: {val}
            </span>
          ))}
        </div>
      )}

      {/* Running total */}
      {spinTotal !== null && (
        <div className={`text-base font-semibold ${theme.bodyText}`}>
          Total: <span className={theme.accentText}>{spinTotal}</span>
        </div>
      )}
    </motion.div>
  )
}
