import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PlayCard } from "./PlayCard"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { PlayCardData } from "./hooks/usePlayCards"

export interface PlayCardGridProps {
  cards: PlayCardData[]
  matchupId: string
  /** When true, cards are disabled with a "Play in progress" overlay */
  playInProgress?: boolean
}

/**
 * PlayCardGrid — Renders 4 PlayCards in a 2×2 CSS grid with selection state
 * and lock-in logic.
 *
 * On tap: immediately submits the play selection via useGameStore.submitPick,
 * then disables further interaction. Selected card shows "selected" state,
 * unselected cards show "disabled" state. A waiting indicator appears once
 * locked in.
 *
 * When playInProgress is true, cards are disabled and the overlay shows
 * "Play in progress" instead of "Waiting for opponent."
 *
 * Validates: Requirements 4.1, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 14.3
 */
export function PlayCardGrid({ cards, matchupId, playInProgress = false }: PlayCardGridProps) {
  const theme = useTheme()
  const submitPick = useGameStore((s) => s.submitPick)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)

  const isLocked = pickSubmitted || playInProgress

  function handleSelect(playId: string) {
    if (isLocked) return

    setSelectedPlayId(playId)
    submitPick({ type: "play_selection", matchupId, play: playId })
  }

  function getCardState(playId: string): "idle" | "selected" | "unselected" | "disabled" {
    if (playInProgress) return "disabled"
    if (!pickSubmitted) return "idle"
    if (playId === selectedPlayId) return "selected"
    return "disabled"
  }

  // Determine overlay message
  const showOverlay = pickSubmitted || playInProgress
  const overlayText = playInProgress ? "Play in progress…" : "Waiting for opponent…"

  return (
    <div className="relative">
      {/* 2×2 Play Card Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "4px",
        }}
        className="overflow-hidden min-h-0"
      >
        {cards.map((card) =>
            <PlayCard
              key={card.playId}
              playId={card.playId}
              displayName={card.displayName}
              formation={card.formation}
              artData={card.artData}
              state={getCardState(card.playId)}
              onSelect={handleSelect}
            />
        )}
      </div>

      {/* Waiting/progress indicator */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
          >
            <span
              className={`${theme.mutedText} text-xs font-bold uppercase tracking-wider bg-black/70 px-3 py-1.5 rounded`}
            >
              {overlayText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
