import { useState } from "react"
import { useTheme } from "../../theme"
import { usePlayerName } from "./hooks/usePlayerName"
import { FieldPanel } from "./FieldPanel"
import { MiniScoreboard } from "./MiniScoreboard"
import { PlayResultLine } from "./PlayResultLine"
import { HistoryDrawer } from "./HistoryDrawer"
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"
import { formatPlayResult } from "./field-utils"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig } from "./animations/types" // idle | run | pass | turnover | touchdown

export interface SpectatorDriveViewProps {
  driveState: DriveState
  onBack: () => void
}

/**
 * SpectatorDriveView — Read-only drive observation view for spectators.
 *
 * Renders the same field visualization and play-by-play information as the
 * active competitor's DriveView, but WITHOUT the PlayCardGrid. Spectators
 * can watch the drive unfold and browse history, but cannot select plays.
 *
 * Includes a back button at the top to return to the spectator matchup grid.
 *
 * Validates: Requirements 9.2, 9.3, 9.4
 */
export function SpectatorDriveView({ driveState, onBack }: SpectatorDriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)
  const getPlayerName = usePlayerName()

  const { yardLine, down, yardsToGo, playHistory, offensePlayerId, defensePlayerId } =
    driveState

  // Derive latest play result text
  const lastEntry = playHistory.length > 0 ? playHistory[playHistory.length - 1] : null
  const resultText = lastEntry ? formatPlayResult(lastEntry.result) : null

  // Build history entries list (chronological)
  const historyEntries = playHistory.map((entry) => formatPlayResult(entry.result))

  // Ball animation config — spectator view uses idle so ball stays at initialY (computed by FieldPanel)
  const ballAnimConfig: BallAnimationConfig = {
    type: "idle",
    duration: 0,
    fromY: 0,
    toY: 0,
  }

  const maxYards = 35

  return (
    <div className="flex flex-col h-full max-h-[470px]">
      {/* Back button */}
      <div className="flex items-center px-2 py-1">
        <button
          type="button"
          onClick={onBack}
          className={`${theme.accentText} text-[11px] font-bold uppercase flex items-center gap-1`}
          aria-label="Back to matchup grid"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </button>
        <span className={`${theme.mutedText} text-[10px] ml-auto`}>
          Spectating
        </span>
      </div>

      {/* Field + Scoreboard row */}
      <div className="flex-1 flex gap-2 px-2 min-h-0">
        {/* Field Panel */}
        <FieldPanel
          yardLine={yardLine}
          maxYards={maxYards}
          down={down}
          yardsToGo={yardsToGo}
          ballAnimConfig={ballAnimConfig}
        />

        {/* Scoreboard side */}
        <div className="flex-1 flex flex-col justify-start gap-2 pt-1">
          <MiniScoreboard
            down={down}
            yardsToGo={yardsToGo}
            yardLine={yardLine}
            offensePlayerName={getPlayerName(offensePlayerId)}
            defensePlayerName={getPlayerName(defensePlayerId)}
          />
        </div>
      </div>

      {/* Play Result Line + History */}
      <div className="relative px-2 py-1">
        <PlayResultLine
          resultText={resultText}
          onToggleHistory={() => setHistoryOpen((open) => !open)}
          historyOpen={historyOpen}
        />
        <HistoryDrawer
          entries={historyEntries}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      </div>

      {/* Drive Completion Overlay — shown when drive is finished */}
      {driveState.isComplete && (
        <div className="px-2 py-2">
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => {}}
          />
        </div>
      )}
    </div>
  )
}
