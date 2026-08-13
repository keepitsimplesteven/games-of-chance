import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"

export interface MiniScoreboardProps {
  down: number
  yardsToGo: number
  yardLine: number
  offensePlayerName: string
  defensePlayerName: string
  /** When the drive is complete, shows outcome and strikes through the loser */
  isComplete?: boolean
  endingType?: string // "touchdown" | "interception" | "fumble" | "turnover_on_downs"
  winnerId?: string // player ID of the winner
  offensePlayerId?: string // to determine which name to strike
  defensePlayerId?: string
}

/**
 * MiniScoreboard — Compact scoreboard displaying down, distance, yard line,
 * and offense/defense player names. When the drive is complete, shows the
 * outcome (TOUCHDOWN, INTERCEPTION, etc.) and strikes through the eliminated player.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function MiniScoreboard({
  down,
  yardsToGo,
  yardLine,
  offensePlayerName,
  defensePlayerName,
  isComplete,
  endingType,
  winnerId,
  offensePlayerId,
  defensePlayerId,
}: MiniScoreboardProps) {
  const theme = useTheme()

  const offenseIsWinner = winnerId === offensePlayerId
  const defenseIsWinner = winnerId === defensePlayerId

  return (
    <div className={`${theme.listItem} rounded px-2 py-1.5`}>
      {/* Player names row */}
      <div className="flex flex-col justify-between items-center">
        <span
          className={`text-[12px] font-bold ${
            isComplete && !offenseIsWinner
              ? "line-through text-gray-500"
              : isComplete && offenseIsWinner
                ? `${theme.statusSuccess}`
                : theme.bodyText
          }`}
        >
          {offensePlayerName}
        </span>
        <span className={`text-[8px] ${theme.mutedText} opacity-60`}>vs</span>
        <span
          className={`text-[12px] font-bold ${
            isComplete && !defenseIsWinner
              ? "line-through text-gray-500"
              : isComplete && defenseIsWinner
                ? `${theme.statusSuccess}`
                : theme.bodyText
          }`}
        >
          {defensePlayerName}
        </span>
      </div>

      {/* Status line: outcome when complete, down/distance when active */}
      <div className="text-center mt-0.5">
        {isComplete && endingType ? (
          <span className={`text-[10px] font-bold ${
            endingType === "touchdown" ? theme.statusSuccess : theme.statusDanger
          }`}>
            {formatEndingType(endingType)}
          </span>
        ) : (
          <>
            <span className={`text-[10px] font-bold ${theme.accentText}`}>
              {formatDownDistance(down, yardsToGo, yardLine)}
            </span>
            <span className={`text-[9px] ${theme.mutedText} ml-1`}>
              • Ball on {yardLine}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function formatEndingType(endingType: string): string {
  switch (endingType) {
    case "touchdown": return "🏈 TOUCHDOWN"
    case "interception": return "🚫 INTERCEPTION"
    case "fumble": return "🚫 FUMBLE"
    case "turnover_on_downs": return "🚫 TURNOVER ON DOWNS"
    default: return "GAME OVER"
  }
}
