import { AnimatePresence, motion } from "framer-motion"
import { historyDrawerVariants } from "./animations/variants"
import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"
import { classifyCircumstance, selectPlay, offensePlayPool, defensePlayPool } from "./play-names"
import type { PlaySlot } from "./play-names"
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
            className="absolute top-full left-0 right-0 z-20 mt-1 rounded border-2 border-[#2a7a3a] bg-[#111] p-2 overflow-y-auto shadow-lg"
            style={{ maxHeight: 'min(250px, 60svh)' }}
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
  const circumstance = classifyCircumstance(entry.down, entry.yardsToGo, entry.yardLine)
  const offenseSlot = entry.offensivePlay as PlaySlot
  const defenseSlot = entry.defensivePlay as PlaySlot

  // Use a deterministic pseudo-random derived from entry data so names stay stable across renders
  const offenseRng = createDeterministicRng(entry.down, entry.yardsToGo, entry.yardLine, 1)
  const defenseRng = createDeterministicRng(entry.down, entry.yardsToGo, entry.yardLine, 2)
  const offenseName = selectPlay(offensePlayPool[offenseSlot], circumstance, offenseRng).displayName
  const defenseName = selectPlay(defensePlayPool[defenseSlot], circumstance, defenseRng).displayName
  const outcomeText = formatOutcome(entry.result.outcome, entry.result.yardsGained, entry.yardLine)
  const outcomeColor = getOutcomeColor(entry.result.outcome, entry.result.yardsGained, entry.yardsToGo)

  return (
    <div
      className="grid py-1 border-b border-white/5 last:border-0 text-[9px] items-center"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
      data-testid="history-entry"
    >
      {/* Down & distance + yard line */}
      <span className="text-white/40 whitespace-nowrap pr-2">
        {formatDownDistance(entry.down, entry.yardsToGo, entry.yardLine)}
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

/** Formats the outcome into a short display string, clamping yards to yardLine */
function formatOutcome(outcome: string, yardsGained: number, yardLine: number): string {
  switch (outcome) {
    case "interception":
      return "INT!"
    case "fumble":
      return "Fumble!"
    case "incomplete_pass":
      return "Incomplete"
    case "tackle_for_loss":
      return `${yardsGained} yds`
    case "critical_success": {
      const clamped = Math.min(yardsGained, yardLine)
      return clamped >= yardLine ? "TD!" : `${clamped} yds`
    }
    default: {
      const displayYards = yardsGained > 0 ? Math.min(yardsGained, yardLine) : yardsGained
      return `${displayYards} yd${displayYards !== 1 ? "s" : ""}`
    }
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

/**
 * Creates a deterministic pseudo-RNG from entry-specific data.
 * Returns a function that always produces the same sequence for
 * the same inputs, ensuring history play names don't shuffle on re-render.
 */
function createDeterministicRng(down: number, yardsToGo: number, yardLine: number, salt: number): () => number {
  let seed = (down * 7919 + yardsToGo * 104729 + yardLine * 15485863 + salt * 32452843) | 0
  return () => {
    seed = (seed * 1664525 + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}
