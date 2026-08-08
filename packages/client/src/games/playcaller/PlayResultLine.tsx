import { AnimatePresence, motion } from "framer-motion"
import { useTheme } from "../../theme"

export interface PlayResultLineProps {
  /** Formatted text from formatPlayResult, null if no plays yet */
  resultText: string | null
  /** Callback to toggle the HistoryDrawer open/closed */
  onToggleHistory: () => void
  /** Whether the HistoryDrawer is currently open */
  historyOpen: boolean
}

/**
 * PlayResultLine — A single-line display of the most recent play result
 * with a tappable "History" pill that toggles the HistoryDrawer.
 *
 * Uses AnimatePresence with mode="wait" keyed on resultText so that
 * each new result animates in/out smoothly via Framer Motion.
 *
 * If no play history exists (resultText is null), shows a
 * "Drive starting..." placeholder.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 12.2
 */
export function PlayResultLine({
  resultText,
  onToggleHistory,
  historyOpen,
}: PlayResultLineProps) {
  const theme = useTheme()

  const displayText = resultText ?? "Good luck!"

  return (
    <div className="flex items-center justify-center gap-2">
      {/* History toggle pill */}
      <button
        type="button"
        onClick={onToggleHistory}
        className={`${theme.accentText} text-[9px] font-bold uppercase border rounded px-1.5 py-0.5 transition-colors`}
        style={{ borderColor: `${theme.field.accent}66` }}
        aria-label={historyOpen ? "Close drive history" : "Open drive history"}
        aria-expanded={historyOpen}
      >
        {historyOpen ? "✕" : "History"}
      </button>
      {/* Animated result text — transitions on each new result */}
      <AnimatePresence mode="wait">
        <motion.span
          key={displayText}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className={`${theme.mutedText} text-[12px]`}
        >
          {displayText}
        </motion.span>
      </AnimatePresence>

    </div>
  )
}
