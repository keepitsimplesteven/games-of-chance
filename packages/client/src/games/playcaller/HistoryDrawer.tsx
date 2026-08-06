import { AnimatePresence, motion } from "framer-motion"
import { historyDrawerVariants } from "./animations/variants"
import { useTheme } from "../../theme"

export interface HistoryDrawerProps {
  /** Formatted play result lines (chronological: first play at index 0) */
  entries: string[]
  /** Whether the drawer is expanded */
  isOpen: boolean
  /** Callback to close/collapse the drawer */
  onClose: () => void
}

/**
 * HistoryDrawer — An expandable/collapsible panel displaying the full
 * chronological list of play results for the current drive.
 *
 * Renders as an animated overlay with a full-screen backdrop that closes
 * on any tap. Uses `historyDrawerVariants` (collapsed/expanded) for
 * mount/unmount animations via AnimatePresence.
 *
 * Each entry row uses a CSS Grid with `60px | 1fr | 70px` columns
 * matching the visual comp from FieldCompGrid.tsx.
 *
 * Validates: Requirements 7.4, 7.5, 7.6
 */
export function HistoryDrawer({ entries, isOpen, onClose }: HistoryDrawerProps) {
  const theme = useTheme()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-screen backdrop — closes drawer on any tap */}
          <motion.div
            key="history-backdrop"
            className="fixed inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            key="history-drawer"
            variants={historyDrawerVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`absolute top-full left-0 right-0 z-20 mt-1 ${theme.card} rounded p-2 max-h-[33dvh] overflow-y-auto shadow-lg`}
            role="region"
            aria-label="Drive history"
          >
            {/* Header */}
            <div className={`${theme.accentText} text-[9px] font-bold uppercase mb-1`}>
              Drive History
            </div>

            {/* Entry list */}
            {entries.length === 0 ? (
              <div className={`${theme.mutedText} text-[9px]`}>
                No plays yet.
              </div>
            ) : (
              entries.map((entry, index) => (
                <div
                  key={index}
                  className="grid py-0.5 border-b border-white/5 last:border-0 text-[9px]"
                  style={{ gridTemplateColumns: "60px 1fr 70px" }}
                  data-testid="history-entry"
                >
                  {/* Play number */}
                  <span className={`${theme.mutedText}`}>
                    Play {index + 1}
                  </span>

                  {/* Play result text (centered) */}
                  <span className={`${theme.bodyText} font-medium text-center`}>
                    {entry}
                  </span>

                  {/* Spacer column for layout alignment */}
                  <span />
                </div>
              ))
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
