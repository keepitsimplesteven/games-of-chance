import { useState, useRef } from "react"
import { useTheme } from "../../theme"
import { usePlayerName } from "./hooks/usePlayerName"
import { FieldPanel } from "./FieldPanel"
import { PlayResultLine } from "./PlayResultLine"
import { PlayClock } from "./PlayClock"
import { PlayByPlayAnnouncer } from "./PlayByPlayAnnouncer"
import { HistoryDrawer } from "./HistoryDrawer"
import { formatPlayResult } from "./field-utils"
import { getPlayName, classifyCircumstance } from "./play-names"
import { selectCommentary } from "./play-by-play"
import type { CommentaryLines } from "./play-by-play/selectCommentary"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig } from "./animations/types"
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"

export interface SpectatorDriveViewProps {
  driveState: DriveState
  onBack: () => void
  /** Optional round name displayed in the header */
  roundName?: string
}

/**
 * SpectatorDriveView — Immersive read-only drive observation view for spectators.
 *
 * Layout:
 * - Compact top bar with back button + "Spectating" label
 * - Header row with round name + player matchup (same style as DriveView)
 * - Large field panel (~55-60dvh)
 * - Play-by-play announcer
 * - Play result line with PlayClock
 *
 * Validates: Requirements 9.2, 9.3, 9.4
 */
export function SpectatorDriveView({ driveState, onBack, roundName = "" }: SpectatorDriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)
  const getPlayerName = usePlayerName()

  const { yardLine, down, yardsToGo, playHistory, offensePlayerId, defensePlayerId } =
    driveState

  // Derive player names
  const offensePlayerName = getPlayerName(offensePlayerId)
  const defensePlayerName = getPlayerName(defensePlayerId)

  // Derive latest play result text
  const lastEntry = playHistory.length > 0 ? playHistory[playHistory.length - 1] : null
  const resultText = lastEntry ? formatPlayResult(lastEntry.result) : null

  // Build history entries list (chronological) — pass raw entries to HistoryDrawer
  const historyEntries = playHistory

  // ── Commentary: generate exactly once per new play (stable ref) ──
  const playCount = playHistory.length
  const commentaryRef = useRef<{ playCount: number; lines: CommentaryLines | null }>({
    playCount: 0,
    lines: null,
  })

  if (playCount > 0 && commentaryRef.current.playCount !== playCount) {
    const entry = playHistory[playCount - 1]
    const circ = classifyCircumstance(entry.down, entry.yardsToGo)
    const playName = getPlayName(entry.offensivePlay, circ, "offense").displayName
    commentaryRef.current = {
      playCount,
      lines: selectCommentary(
        playName,
        entry.result.outcome,
        entry.result.yardsGained,
        entry.yardsToGo
      ),
    }
  }
  const commentary = commentaryRef.current.lines

  // Ball animation config — spectator view uses idle so ball stays at initialY
  const ballAnimConfig: BallAnimationConfig = {
    type: "idle",
    duration: 0,
    fromY: 0,
    toY: 0,
  }

  const maxYards = 35

  return (
    <div className="flex flex-col h-full overflow-hidden font-mono p-2">
      {/* ═══ Top bar: Back button + Spectating label ═══ */}
      <div className="flex items-center justify-between py-1">
        <button
          type="button"
          onClick={onBack}
          className={`${theme.accentText} text-[11px] font-bold uppercase flex items-center gap-1`}
          aria-label="Back to matchup grid"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </button>
        <span className={`${theme.mutedText} text-[10px]`}>
          Spectating
        </span>
      </div>

      {/* ═══ Header: Round name + Player matchup ═══ */}
      <header className="flex items-center justify-between py-1">
        <span className={`text-xl font-bold uppercase tracking-widest ${theme.accentText}`}>
          {roundName}
        </span>
        <span className={`text-[12px] ${theme.mutedText}`}>
          {offensePlayerName} vs {defensePlayerName}
        </span>
      </header>

      {/* ═══ Field — takes most vertical space ═══ */}
      <div className="flex-1 flex items-center justify-center min-h-0" style={{ maxHeight: "60dvh" }}>
        <FieldPanel
          yardLine={yardLine}
          maxYards={maxYards}
          down={down}
          yardsToGo={yardsToGo}
          ballAnimConfig={ballAnimConfig}
        />
      </div>

      {/* ═══ Play-by-Play Announcer ═══ */}
      <PlayByPlayAnnouncer
        commentary={commentary}
        playKey={playCount}
      />

      {/* ═══ Play Result Line + PlayClock + History ═══ */}
      <div className="relative px-1 py-1">
        <div className="flex items-center justify-between">
          <PlayResultLine
            resultText={resultText}
            onToggleHistory={() => setHistoryOpen((open) => !open)}
            historyOpen={historyOpen}
          />
          {!driveState.isComplete && <PlayClock />}
        </div>
        <HistoryDrawer
          entries={historyEntries}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      </div>
      {/* ═══ Drive Completion Overlay — shown when drive is finished ═══ */}
      {driveState.isComplete && (
        <div className="px-2 py-2">
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => { }}
          />
        </div>
      )}
    </div>
  )
}
