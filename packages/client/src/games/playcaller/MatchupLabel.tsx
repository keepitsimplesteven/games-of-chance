import { useTheme } from "../../theme"

interface MatchupLabelProps {
  leftName: string
  rightName: string
  /** Tailwind class for the muted "vs" text */
  mutedClass?: string
}

/**
 * MatchupLabel — Adaptive matchup header that switches between inline and
 * stacked layout depending on combined name length.
 *
 * - Short names (combined < 30 chars): single line "Player A vs Player B"
 * - Long names: stacked vertically with smaller text and "vs" divider
 *
 * Both modes truncate with ellipsis as a last resort.
 */
export function MatchupLabel({ leftName, rightName, mutedClass }: MatchupLabelProps) {
  const theme = useTheme()
  const combinedLength = leftName.length + rightName.length

  // For short enough names, render inline
  if (combinedLength < 30) {
    return (
      <span className={`text-[12px] ${mutedClass ?? theme.mutedText} truncate min-w-0`}>
        {leftName} vs {rightName}
      </span>
    )
  }

  // For longer names, stack vertically with adaptive sizing
  const textSize = combinedLength >= 50 ? "text-[10px]" : "text-[11px]"

  return (
    <div className={`flex flex-col items-end min-w-0 overflow-hidden leading-tight`}>
      <span className={`${textSize} ${mutedClass ?? theme.mutedText} truncate max-w-full`}>
        {leftName}
      </span>
      <span className={`text-[9px] ${mutedClass ?? theme.mutedText} opacity-50`}>
        vs
      </span>
      <span className={`${textSize} ${mutedClass ?? theme.mutedText} truncate max-w-full`}>
        {rightName}
      </span>
    </div>
  )
}
