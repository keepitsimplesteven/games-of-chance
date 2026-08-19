import { useState, useRef, useCallback, useEffect } from "react"
import { useTheme } from "../../theme"
import { usePlayerName } from "./hooks/usePlayerName"
import { useGameStore } from "../../store/useGameStore"
import { FieldPanel } from "./FieldPanel"
import { PlayResultLine } from "./PlayResultLine"
import { PlayClock } from "./PlayClock"
import { PlayByPlayAnnouncer } from "./PlayByPlayAnnouncer"
import { HistoryDrawer } from "./HistoryDrawer"
import { formatPlayResult, yardLineToY } from "./field-utils"
import { classifyCircumstance, selectPlay, offensePlayPool } from "./play-names"
import type { PlaySlot } from "./play-names"
import { selectCommentary } from "./play-by-play"
import type { CommentaryLines } from "./play-by-play/selectCommentary"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig, BallAnimationType } from "./animations/types"
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

  // Bracket seeds for display
  const seeds = useGameStore((s) => s.roomState?.playcallerGameState?.bracket?.seeds ?? {})

  // Derive player names with seed prefix
  const offenseRawName = getPlayerName(offensePlayerId)
  const defenseRawName = getPlayerName(defensePlayerId)
  const offSeed = seeds[offensePlayerId]
  const defSeed = seeds[defensePlayerId]
  const offensePlayerName = offSeed ? `(${offSeed}) ${offenseRawName}` : offenseRawName
  const defensePlayerName = defSeed ? `(${defSeed}) ${defenseRawName}` : defenseRawName

  // ── Play timeline gating (mirrors DriveView) ──
  // Track which play index the UI has "revealed". When a new play arrives
  // (playCount > displayedPlayCount), the field/result stays frozen until
  // the announcer fires onOutcomeReveal.
  const playCount = playHistory.length

  // On mount, treat all pre-existing play history as already revealed.
  // Only gate plays that arrive *after* mount (live updates).
  // This prevents refresh/reconnect from getting permanently stuck one play behind.
  const initialDisplayCount = useRef(playCount).current
  const [displayedPlayCount, setDisplayedPlayCount] = useState(initialDisplayCount)

  // Re-sync safeguard: if the spectator toggled away and came back (or multiple
  // plays landed while the announcer was gating a single play), snap to
  // playCount - 1 so only the very latest play is gated. Without this, a
  // spectator who leaves and returns would be stuck multiple plays behind.
  const prevPlayCountRef = useRef(playCount)
  useEffect(() => {
    const delta = playCount - prevPlayCountRef.current
    prevPlayCountRef.current = playCount
    // If more than 1 new play arrived since we last rendered, fast-forward
    // to gate only the newest one.
    if (delta > 1) {
      setDisplayedPlayCount(playCount - 1)
    }
  }, [playCount])

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
  const resultText = lastRevealedEntry ? formatPlayResult(lastRevealedEntry.result, lastRevealedEntry.yardLine) : null

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
    const circ = classifyCircumstance(entry.down, entry.yardsToGo, entry.yardLine)
    const slot = entry.offensivePlay as PlaySlot
    const selectedPlay = selectPlay(offensePlayPool[slot], circ, Math.random)
    const axis = slot.startsWith("run") ? "run" : "pass"
    commentaryRef.current = {
      playCount,
      lines: selectCommentary(
        selectedPlay.displayName,
        entry.result.outcome,
        entry.result.yardsGained,
        entry.yardsToGo,
        entry.yardLine,
        entry.down,
        circ,
        selectedPlay.messages,
        axis,
        entry.offensivePlay,
        entry.defensivePlay
      ),
    }
  }
  const commentary = commentaryRef.current.lines

  // ── Ball animation config ──
  // When a play is revealed (displayedPlayCount increments), fire the appropriate
  // animation type based on the offensive play.
  const FIELD_HEIGHT = 240
  const FIELD_TOP = 35 // END_ZONE_HEIGHT(30) + 5px padding

  const [ballAnimConfig, setBallAnimConfig] = useState<BallAnimationConfig>({
    type: "idle",
    duration: 0,
    fromY: 0,
    toY: 0,
  })

  const prevDisplayedRef = useRef(displayedPlayCount)

  useEffect(() => {
    if (displayedPlayCount > prevDisplayedRef.current && displayedPlayCount <= playHistory.length) {
      const revealedEntry = playHistory[displayedPlayCount - 1]
      if (revealedEntry) {
        // Determine animation type from the offensive play
        let animType: BallAnimationType = "run"
        if (revealedEntry.offensivePlay.startsWith("pass")) {
          animType = "pass"
        }
        // Turnovers override
        if (
          revealedEntry.result.outcome === "interception" ||
          revealedEntry.result.outcome === "fumble"
        ) {
          animType = "turnover"
        }
        // Touchdown: ball ended up at or past the goal line
        if (revealedEntry.resultingYardLine <= 0) {
          animType = "touchdown"
        }

        const fromY = yardLineToY(revealedEntry.yardLine, maxYards, FIELD_HEIGHT, FIELD_TOP)
        const toY = yardLineToY(revealedEntry.resultingYardLine, maxYards, FIELD_HEIGHT, FIELD_TOP)
        const duration = animType === "pass" ? 1.0 : 0.7

        setBallAnimConfig({ type: animType, duration, fromY, toY })

        // Revert to idle after animation completes
        const timer = setTimeout(() => {
          setBallAnimConfig({ type: "idle", duration: 0, fromY: 0, toY: 0 })
        }, duration * 1000 + 100)

        prevDisplayedRef.current = displayedPlayCount
        return () => clearTimeout(timer)
      }
    }
    prevDisplayedRef.current = displayedPlayCount
  }, [displayedPlayCount, playHistory])

  const maxYards = 35

  return (
    <div className="flex flex-col h-full overflow-hidden font-mono p-2">
      {/* ═══ Top bar: Back button + Spectating label ═══ */}
      <div className="flex items-center justify-between py-1">
        <button
          type="button"
          onClick={onBack}
          className={`${theme.accentText} text-[16px] font-bold uppercase flex items-center gap-1`}
          aria-label="Back to matchup grid"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </button>
        <span className={`${theme.mutedText} text-[10px]`}>
          Spectating
        </span>
      </div>

      {/* ═══ Header: Round name ═══ */}
      <header className="flex items-center justify-between gap-2 py-1 overflow-hidden">
        <span className={`text-xl font-bold uppercase tracking-widest shrink-0 ${theme.accentText}`}>
          {roundName}
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

      {/* ═══ Player Matchup Panel (fills bottom space where play cards would be) ═══ */}
      {!(driveState.isComplete && !isWaitingForReveal) && (
        <div className="shrink-0 flex flex-col items-center gap-1 px-3 py-4" style={{ minHeight: "18dvh" }}>
          {/* Offense player */}
          <div className="w-full text-center">
            <div className={`text-[10px] uppercase tracking-widest ${theme.mutedText} mb-0.5`}>
              Offense
            </div>
            <div className={`text-lg font-bold leading-tight truncate ${theme.bodyText}`}>
              {offensePlayerName}
            </div>
          </div>

          {/* VS divider */}
          <div className={`text-[11px] font-bold ${theme.mutedText} opacity-50`}>
            vs
          </div>

          {/* Defense player */}
          <div className="w-full text-center">
            <div className={`text-[10px] uppercase tracking-widest ${theme.mutedText} mb-0.5`}>
              Defense
            </div>
            <div className={`text-lg font-bold leading-tight truncate ${theme.bodyText}`}>
              {defensePlayerName}
            </div>
          </div>
        </div>
      )}

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
