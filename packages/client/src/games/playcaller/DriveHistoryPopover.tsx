import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"
import { classifyCircumstance, selectPlay, offensePlayPool, defensePlayPool } from "./play-names"
import type { PlaySlot } from "./play-names"
import type { PlayHistoryEntry } from "./field-utils.types"

export interface DriveHistoryPopoverProps {
  /** Play history entries for the completed matchup */
  entries: PlayHistoryEntry[]
  /** Whether the popover is open */
  open: boolean
  /** Callback to close the popover */
  onClose: () => void
  /** Ref to the anchor element (MatchupCard) for positioning */
  anchorRef: { current: HTMLDivElement | null }
}

const MAX_HEIGHT = 300
const VIEWPORT_PADDING = 8

/**
 * DriveHistoryPopover — A fixed-position popover that displays the drive history
 * for a completed matchup in the bracket view.
 *
 * Uses fixed positioning via a portal to ensure it always fits within the viewport.
 * Automatically adjusts placement (top/bottom, left/right) based on available space.
 * Closes on outside click or Escape key.
 */
export function DriveHistoryPopover({ entries, open, onClose, anchorRef }: DriveHistoryPopoverProps) {
  const theme = useTheme()
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  // Calculate position relative to the anchor element, fitting within viewport
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    const anchor = anchorRef.current.getBoundingClientRect()
    const popoverWidth = 280 // approximate width
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    // Prefer opening below the card
    let top: number
    const spaceBelow = viewportH - anchor.bottom - VIEWPORT_PADDING
    const spaceAbove = anchor.top - VIEWPORT_PADDING

    if (spaceBelow >= Math.min(MAX_HEIGHT, 150)) {
      // Enough room below
      top = anchor.bottom + 4
    } else if (spaceAbove >= Math.min(MAX_HEIGHT, 150)) {
      // Open above — estimate the panel height as min(MAX_HEIGHT, content)
      const estimatedHeight = Math.min(MAX_HEIGHT, entries.length * 28 + 40)
      top = anchor.top - estimatedHeight - 4
    } else {
      // Neither fits well — place below and let it scroll
      top = anchor.bottom + 4
    }

    // Horizontal: center on the card, but clamp to viewport
    let left = anchor.left + anchor.width / 2 - popoverWidth / 2
    left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportW - popoverWidth - VIEWPORT_PADDING))

    // Clamp top to viewport
    top = Math.max(VIEWPORT_PADDING, Math.min(top, viewportH - MAX_HEIGHT - VIEWPORT_PADDING))

    setPosition({ top, left })
  }, [open, anchorRef, entries.length])

  // Close on outside click
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }

    // Use setTimeout so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, onClose, anchorRef])

  // Close on Escape key
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Drive History"
      className="fixed z-[9999] rounded-lg border-2 border-[#2a7a3a] shadow-xl bg-[#111]"
      style={{
        top: position.top,
        left: position.left,
        width: 280,
        maxHeight: MAX_HEIGHT,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`${theme.accentText} text-[9px] font-bold uppercase mb-1.5 px-2 pt-2 shrink-0`}>
        Drive History
      </div>

      {/* Scrollable entry list — padding on content keeps scrollbar at outer edge */}
      <div className="overflow-y-auto flex-1 min-h-0 px-2 pb-2">
        {entries.length === 0 ? (
          <div className="text-[9px] text-white/40">No plays recorded.</div>
        ) : (
          entries.map((entry, index) => (
            <PopoverHistoryRow key={index} entry={entry} />
          ))
        )}
      </div>
    </div>,
    document.body
  )
}

// ── PopoverHistoryRow ──────────────────────────────────────────────────────

/** A single history row (same rendering as HistoryDrawer) */
function PopoverHistoryRow({ entry }: { entry: PlayHistoryEntry }) {
  const circumstance = classifyCircumstance(entry.down, entry.yardsToGo, entry.yardLine)
  const offenseSlot = entry.offensivePlay as PlaySlot
  const defenseSlot = entry.defensivePlay as PlaySlot

  const offenseRng = createDeterministicRng(entry.down, entry.yardsToGo, entry.yardLine, 1)
  const defenseRng = createDeterministicRng(entry.down, entry.yardsToGo, entry.yardLine, 2)
  const offenseName = selectPlay(offensePlayPool[offenseSlot], circumstance, offenseRng).displayName
  const defenseName = selectPlay(defensePlayPool[defenseSlot], circumstance, defenseRng).displayName
  const outcomeText = formatOutcome(entry.result.outcome, entry.result.yardsGained, entry.yardLine, entry.resultingYardLine)
  const outcomeColor = getOutcomeColor(entry.result.outcome, entry.result.yardsGained, entry.yardsToGo, entry.resultingYardLine)

  return (
    <div
      className="grid py-1 border-b border-white/5 last:border-0 text-[9px] items-center"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
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

// ── Utility functions (same as HistoryDrawer) ──────────────────────────────

/** Formats the outcome into a short display string */
function formatOutcome(outcome: string, yardsGained: number, yardLine: number, resultingYardLine?: number): string {
  switch (outcome) {
    case "interception":
      return "INT!"
    case "fumble":
      return "Fumble!"
    case "incomplete_pass":
      return "Incomplete"
    case "tackle_for_loss":
      return `${yardsGained} yds`
    default: {
      // Touchdown: resulting yard line reached the goal (0)
      if (resultingYardLine !== undefined && resultingYardLine <= 0) return "TD!"
      // Clamp yards gained to distance-to-goal (can't gain more than the remaining yardage)
      const clamped = yardsGained > 0 ? Math.min(yardsGained, yardLine) : yardsGained
      return `${clamped} yd${clamped !== 1 ? "s" : ""}`
    }
  }
}

/** Returns a Tailwind color class based on the outcome */
function getOutcomeColor(outcome: string, yardsGained: number, yardsToGo: number, resultingYardLine?: number): string {
  if (outcome === "interception" || outcome === "fumble") return "text-[#cc3333]"
  if (resultingYardLine !== undefined && resultingYardLine <= 0) return "text-[#66d97a]"
  if (outcome === "tackle_for_loss") return "text-[#cc3333]"
  if (yardsGained >= yardsToGo) return "text-[#f5c542]"
  if (outcome === "incomplete_pass") return "text-white/60"
  return "text-white/80"
}

/** Deterministic pseudo-RNG for stable play name rendering */
function createDeterministicRng(down: number, yardsToGo: number, yardLine: number, salt: number): () => number {
  let seed = (down * 7919 + yardsToGo * 104729 + yardLine * 15485863 + salt * 32452843) | 0
  return () => {
    seed = (seed * 1664525 + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}
