import { useState, useRef, useCallback } from "react"
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
 * UI updates are gated behind the play-by-play announcer timeline so spectators
 * don't see outcomes before players do.
 *
 * Validates: Requirements 9.2, 9.3, 9.4
 */
export function SpectatorDriveView({ driveState, onBack, roundName = "" }: SpectatorDriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)
  const getPlayerName = usePlayerName()

  const { playHistory, offensePlayerId, defensePlayerId } = driveState

  // Derive player names
  const offensePlayerName = getPlayerName(offensePlayerId)
  const defensePlayerName = getPlayerName(defensePlayerId)

  // ── Play timeline gating (mirrors DriveView) ──
  // Track which play index the UI has "revealed". When a new play arrives
  // (playCount > displayedPlayCount), the field/result stays frozen until
  // the announcer fires onOutcomeReveal.
  const playCount = playHistory.length
  const [displayedPlayCount, setDisplayedPlayCount] = useState(playCount)

  const isWaitingForReveal = displayedPlayCount < playCount

  const handleOutcomeReveal = useCallback(() => {
    setDisplayedPlayCount((prev) => prev + 1)
  }, [])

  // Compute display values based on which plays have been revealed
  let displayYardLine: number
  let displayDown: number
  let displayYardsToGo: number

  if (!isWaitingForReveal) {
    // Fully caught up — show current live state
    displayYardLine = driveState.yardLine
    displayDown = driveState.down
    displayYardsToGo = driveState.yardsToGo
  } else {
    // Waiting — show state BEFORE the unrevealed play ran
    const unrevealedEntry = playHistory[displayedPlayCount]
    if (unrevealedEntry) {
      displayYardLine = unrevealedEntry.yardLine
      displayDown = unrevealedEntry.down
      displayYardsToGo = unrevealedEntry.yardsToGo
    } else {
      displayYardLine = driveState.yardLine
      displayDown = driveState.down
      displayYardsToGo = driveState.yardsToGo
    }
  }

  // Gate result text — only show after reveal
  const lastRevealedEntry = !isWaitingForReveal && playHistory.length > 0
    ? playHistory[playHistory.length - 1]
    : displayedPlayCount > 0
      ? playHistory[displayedPlayCount - 1]
      : null
  const resultText = lastRevealedEntry ? formatPlayResult(lastRevealedEntry.result) : null

  // Gate history entries — exclude unrevealed plays
  const historyEntries = isWaitingForReveal
    ? playHistory.slice(0, displayedPlayCount)
    : playHistory

  // ── Commentary: generate exactly once per new play (stable ref) ──
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
          yardLine={displayYardLine}
          maxYards={maxYards}
          down={displayDown}
          yardsToGo={displayYardsToGo}
          ballAnimConfig={ballAnimConfig}
        />
      </div>

      {/* ═══ Play-by-Play Announcer ═══ */}
      <PlayByPlayAnnouncer
        commentary={commentary}
        playKey={playCount}
        onOutcomeReveal={handleOutcomeReveal}
      />

      {/* ═══ Play Result Line + PlayClock + History ═══ */}
      <div className="relative px-1 py-1">
        <div className="flex items-center justify-between">
          <PlayResultLine
            resultText={isWaitingForReveal ? null : resultText}
            onToggleHistory={() => setHistoryOpen((open) => !open)}
            historyOpen={historyOpen}
          />
          {!driveState.isComplete && !isWaitingForReveal && <PlayClock />}
        </div>
        <HistoryDrawer
          entries={historyEntries}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      </div>

      {/* ═══ Drive Completion Overlay — shown when drive is finished and revealed ═══ */}
      {driveState.isComplete && !isWaitingForReveal && (
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
