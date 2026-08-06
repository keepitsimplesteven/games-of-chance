import { useTheme } from "../../theme"
import { formatDownDistance } from "./field-utils"
import type { DriveState } from "./field-utils.types"

export interface SpectatorGridProps {
  matchups: Array<{ matchupId: string; driveState: DriveState }>
  onSelectMatchup: (matchupId: string) => void
}

/**
 * SpectatorGrid — Renders a card per active matchup showing player names
 * and current drive progress. Tapping a card triggers onSelectMatchup to
 * navigate to a read-only drive view for that matchup.
 *
 * Layout: flex column of bordered cards matching the visual comp
 * (Row 2, Col 2: stacked mini scoreboards).
 *
 * Validates: Requirements 9.1, 9.5
 */
export function SpectatorGrid({ matchups, onSelectMatchup }: SpectatorGridProps) {
  const theme = useTheme()

  if (matchups.length === 0) {
    return (
      <div className={`text-center py-4 ${theme.mutedText}`}>
        No active matchups.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md mx-auto px-3 py-2">
      <div className={`text-center text-xs uppercase tracking-wide ${theme.mutedText}`}>
        Other Games
      </div>
      <div className="flex flex-col gap-2">
        {matchups.map(({ matchupId, driveState }) => (
          <button
            key={matchupId}
            data-testid="spectator-matchup-card"
            type="button"
            onClick={() => onSelectMatchup(matchupId)}
            className={`${theme.listItem} rounded-lg border border-current/10 px-3 py-2 text-left w-full transition-transform active:scale-[0.97]`}
          >
            {/* Player names */}
            <div className="flex justify-between items-center">
              <span className={`text-[12px] font-bold ${theme.bodyText} truncate`}>
                {driveState.offensePlayerId}
              </span>
              <span className={`text-[8px] ${theme.mutedText} opacity-60 mx-1`}>
                vs
              </span>
              <span className={`text-[12px] font-bold ${theme.bodyText} truncate`}>
                {driveState.defensePlayerId}
              </span>
            </div>

            {/* Down, distance, and ball position */}
            <div className="text-center mt-1">
              <span className={`text-[10px] font-bold ${theme.accentText}`}>
                {formatDownDistance(driveState.down, driveState.yardsToGo)}
              </span>
              <span className={`text-[9px] ${theme.mutedText} ml-1`}>
                • Ball on {driveState.yardLine}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
