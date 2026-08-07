import { AnimatePresence, motion } from "framer-motion"
import { historyDrawerVariants } from "./animations/variants"
import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"
import { getPlayName, classifyCircumstance } from "./play-names"
import type { PlayHistoryEntry } from "./field-utils.types"

export interface HistoryDrawerProps {
  /** Raw play history entries (chronological: first play at index 0) */
  entries: PlayHistoryEntry[]
  /** Whether the drawer is expanded */
  isOpen: boolean
  /** Callback to close/collapse the drawer */
  onClose: () => void
}

/**
 * HistoryDrawer — An expandable/collapsible panel displaying the full
 * chronological list of play results for the current drive.
 *
 * Each row shows:
 * - Left: down & distance + starting yard line
 * - Center: offensive play name / defensive play name (stacked)
 * - Right: outcome text (color-coded)
 *
 * Black internal background lets green/gold text pop without contrast issues.
 * Scrolls internally after max-height is reached.
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

          {/* Drawer panel — black bg with green border */}
          <motion.div
            key="history-drawer"
            variants={historyDrawerVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute top-full left-0 right-0 z-20 mt-1 rounded border-2 border-[#2a7a3a] bg-[#111] p-2 max-h-[250px] overflow-y-auto shadow-lg"
            role="region"
            aria-label="Drive history"
          >
            {/* Header */}
            <div className={`${theme.accentText} text-[9px] font-bold uppercase mb-1.5`}>
              Drive History
            </div>

            {/* Entry list */}
            {entries.length === 0 ? (
              <div className="text-[9px] text-white/40">
                No plays yet.
              </div>
            ) : (
              entries.map((entry, index) => (
                <HistoryRow key={index} entry={entry} />
              ))
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/** A single history row */
function HistoryRow({ entry }: { entry: PlayHistoryEntry }) {
  const circumstance = classifyCircumstance(entry.down, entry.yardsToGo)
  const offenseName = getPlayName(entry.offensivePlay, circumstance, "offense").displayName
  const defenseName = getPlayName(entry.defensivePlay, circumstance, "defense").displayName
  const outcomeText = formatOutcome(entry.result.outcome, entry.result.yardsGained)
  const outcomeColor = getOutcomeColor(entry.result.outcome, entry.result.yardsGained, entry.yardsToGo)

  return (
    <div
      className="grid py-1 border-b border-white/5 last:border-0 text-[9px] items-center"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
      data-testid="history-entry"
    >
      {/* Down & distance + yard line */}
      <span className="text-white/40 whitespace-nowrap pr-2">
        {formatDownDistance(entry.down, entry.yardsToGo)}
        <span className="text-white/25"> · {entry.yardLine} yd</span>
      </span>

      {/* Play names: offense on top, defense below */}
      <span className="text-center leading-tight">
        <span className="text-white/80 font-medium block">{offenseName}</span>
        <span className="text-white/40 block">vs {defenseName}</span>
      </span>

      {/* Outcome — right-aligned, color-coded */}
      <span className={`text-right font-bold whitespace-nowrap pl-2 ${outcomeColor}`}>
        {outcomeText}
      </span>
    </div>
  )
}

/** Formats the outcome into a short display string */
function formatOutcome(outcome: string, yardsGained: number): string {
  switch (outcome) {
    case "interception":
      return "INT!"
    case "fumble":
      return "Fumble!"
    case "incomplete_pass":
      return "Incomplete"
    case "tackle_for_loss":
      return `${yardsGained} yds`
    case "critical_success":
      return yardsGained >= 35 ? "TD!" : `${yardsGained} yds`
    default:
      return `${yardsGained} yd${yardsGained !== 1 ? "s" : ""}`
  }
}

/** Returns a Tailwind color class based on the outcome */
function getOutcomeColor(outcome: string, yardsGained: number, yardsToGo: number): string {
  // Turnovers → red
  if (outcome === "interception" || outcome === "fumble") return "text-[#cc3333]"
  // Touchdown (ball reached end zone) → green
  if (outcome === "critical_success" && yardsGained >= 35) return "text-[#3a9a4a]"
  // Negative plays → red
  if (outcome === "tackle_for_loss") return "text-[#cc3333]"
  // First down gained → yellow
  if (yardsGained >= yardsToGo) return "text-[#f5c542]"
  // Incomplete → white/muted
  if (outcome === "incomplete_pass") return "text-white/60"
  // Normal gain → white
  return "text-white/80"
}
