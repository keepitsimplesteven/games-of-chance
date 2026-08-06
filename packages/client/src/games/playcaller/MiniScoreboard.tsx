import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"

export interface MiniScoreboardProps {
  down: number
  yardsToGo: number
  yardLine: number
  offensePlayerName: string
  defensePlayerName: string
}

/**
 * MiniScoreboard — Compact scoreboard displaying down, distance, yard line,
 * and offense/defense player names. Sits next to the FieldPanel in the
 * gameplay layout.
 *
 * Styled as a bordered card matching the visual comp in FieldCompGrid.tsx
 * (Row 2, Col 2 — "Other Games" mini scoreboard cards).
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function MiniScoreboard({
  down,
  yardsToGo,
  yardLine,
  offensePlayerName,
  defensePlayerName,
}: MiniScoreboardProps) {
  const theme = useTheme()

  return (
    <div className={`${theme.listItem} rounded px-2 py-1.5`}>
      {/* Player names row */}
      <div className="flex justify-between items-center">
        <span className={`text-[12px] font-bold ${theme.bodyText}`}>
          {offensePlayerName}
        </span>
        <span className={`text-[8px] ${theme.mutedText} opacity-60`}>vs</span>
        <span className={`text-[12px] font-bold ${theme.bodyText}`}>
          {defensePlayerName}
        </span>
      </div>

      {/* Down, distance, and yard line */}
      <div className="text-center mt-0.5">
        <span className={`text-[10px] font-bold ${theme.accentText}`}>
          {formatDownDistance(down, yardsToGo)}
        </span>
        <span className={`text-[9px] ${theme.mutedText} ml-1`}>
          • Ball on {yardLine}
        </span>
      </div>
    </div>
  )
}
