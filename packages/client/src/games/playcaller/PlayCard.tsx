import { motion } from "framer-motion"
import { playCardVariants } from "./animations/variants"
import { PlayArtSvg } from "./play-art/PlayArtSvg"
import { useTheme } from "../../theme"
import type { PlayArtData } from "./play-art/types"

export interface PlayCardProps {
  playId: string
  displayName: string
  formation: string
  artData: PlayArtData
  state: "idle" | "selected" | "unselected" | "disabled"
  onSelect: (playId: string) => void
}

/**
 * PlayCard — A tappable card showing play art SVG, play name, and formation label.
 *
 * Uses Framer Motion `playCardVariants` for selection feedback (idle, selected,
 * unselected, disabled states). Theme-derived styles for background, border, text.
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 6.1, 6.2, 12.3, 13.3
 */
export function PlayCard({ playId, displayName, formation, artData, state, onSelect }: PlayCardProps) {
  const theme = useTheme()

  const isDisabled = state === "disabled"

  return (
    <motion.button
      type="button"
      variants={playCardVariants}
      initial="idle"
      animate={state}
      onClick={() => {
        if (!isDisabled) {
          onSelect(playId)
        }
      }}
      disabled={isDisabled}
      className={`${theme.card} rounded overflow-hidden grid place-items-center p-1 cursor-pointer border-2 transition-colors`}
      style={{ gridTemplateRows: "1fr auto auto" }}
      aria-label={`Select play: ${displayName}`}
      aria-disabled={isDisabled}
    >
      {/* Play art SVG */}
      <PlayArtSvg data={artData} className="w-full max-h-[5dvh]" />

      {/* Play name */}
      <span className={`${theme.bodyText} text-[16px] font-bold leading-none pb-1`}>
        {displayName}
      </span>

      {/* Formation label */}
      <span className={`${theme.mutedText} text-[9px] leading-none mb-1`}>
        {formation}
      </span>
    </motion.button>
  )
}
