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
  state: "idle" | "selected" | "unselected" | "disabled" | "highlighted"
  onSelect: (playId: string) => void
  role?: "offense" | "defense"
}

/**
 * PlayCard — A tappable card showing play art SVG, play name, and formation label.
 *
 * Pass plays render with a blue background; run plays render with green.
 * Uses Framer Motion `playCardVariants` for selection feedback (idle, selected,
 * unselected, disabled states).
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 6.1, 6.2, 12.3, 13.3
 */
export function PlayCard({ playId, displayName, formation, artData, state, onSelect, role = "offense" }: PlayCardProps) {
  const theme = useTheme()

  const isDisabled = state === "disabled" || state === "highlighted"
  const isPass = playId.startsWith("pass")
  const isAggressive = playId.includes("aggressive")

  // Play type badge: "Safe Run", "Aggr. Pass", etc. — append "D" for defense
  const riskLabel = isAggressive ? "Aggr." : "Safe"
  const typeLabel = isPass ? "Pass" : "Run"
  const suffix = role === "defense" ? " D" : ""
  const badgeLabel = `${riskLabel} ${typeLabel}${suffix}`
  const badgeBg = isAggressive ? "bg-red-700" : "bg-black"

  // Pass plays = blue, run plays = green (matches comp)
  const cardStyle = isPass
    ? "bg-[#2255aa] border-4 border-[#143d7a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4),0_4px_0_#0f2d5c]"
    : "bg-[#1b5e2a] border-4 border-[#2a7a3a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4),0_4px_0_#0f3d18]"

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
      className={`${cardStyle} rounded overflow-hidden grid place-items-center p-2 pb-4 cursor-pointer transition-colors relative`}
      style={{ gridTemplateRows: "1fr auto auto" }}
      aria-label={`Select play: ${displayName}`}
      aria-disabled={isDisabled}
    >
      {/* Play type badge — bottom-left corner */}
      <span
        className={`absolute bottom-1 left-1 ${badgeBg} text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded leading-none`}
      >
        {badgeLabel}
      </span>

      {/* Play art SVG — larger to fill the card */}
      <PlayArtSvg data={artData} className="w-full max-h-[8dvh]" />

      {/* Play name */}
      <span className={`${theme.bodyText} text-[16px] font-bold leading-none pb-1`}>
        {displayName}
      </span>

      {/* Formation label */}
      <span className="text-[9px] text-white/50 leading-none mb-1">
        {formation}
      </span>
    </motion.button>
  )
}
