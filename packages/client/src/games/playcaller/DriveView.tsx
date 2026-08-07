import { useState, useMemo, useRef, useCallback } from "react"
import { useTheme } from "../../theme"
import { useCircumstance } from "./hooks/useCircumstance"
import { usePlayCards } from "./hooks/usePlayCards"
import { usePlayerName } from "./hooks/usePlayerName"
import { FieldPanel } from "./FieldPanel"
import { MiniScoreboard } from "./MiniScoreboard"
import { PlayResultLine } from "./PlayResultLine"
import { HistoryDrawer } from "./HistoryDrawer"
import { PlayCardGrid } from "./PlayCardGrid"
import { PlayClock } from "./PlayClock"
import { PlayByPlayAnnouncer } from "./PlayByPlayAnnouncer"
import { formatPlayResult } from "./field-utils"
import { getPlayName, classifyCircumstance } from "./play-names"
import { selectCommentary } from "./play-by-play"
import type { CommentaryLines } from "./play-by-play/selectCommentary"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig } from "./animations/types"
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"

const MAX_YARDS = 35

export interface DriveViewProps {
  matchupId: string
  driveState: DriveState
  roundName: string
  opponentName: string
  role: "offense" | "defense"
  /** Other matchup drive states in this round (for the side panel) */
  otherDrives?: Array<{ matchupId: string; driveState: DriveState }>
}

/**
 * DriveView — Main active-competitor layout for the Playcaller drive experience.
 *
 * CSS Grid layout (mirrors FieldCompGrid.tsx visual comp):
 * - Row 1: Header (round name + opponent) — spans 2 cols
 * - Row 2, Col 1: FieldPanel (vertical field SVG with animated ball)
 * - Row 2, Col 2: MiniScoreboard
 * - Row 3: PlayResultLine + HistoryDrawer — spans 2 cols
 * - Row 4: PlayCardGrid (2×2) or DriveCompletionOverlay — spans 2 cols
 *
 * No scroll during gameplay — everything fits within 100dvh.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
export function DriveView({
  matchupId,
  driveState,
  roundName,
  opponentName,
  role,
  otherDrives = [],
}: DriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)
  const getPlayerName = usePlayerName()

  // Derive circumstance from current down/distance
  const circumstance = useCircumstance(driveState)

  // Get play cards for the current role + circumstance
  const cards = usePlayCards(circumstance, role)

  // ── Play timeline gating ──
  // Instead of gating a boolean, we track which play index the UI has "revealed".
  // The field always shows the state AFTER displayedPlayCount plays have completed.
  // When a new play arrives (playCount > displayedPlayCount), the field stays frozen
  // until the announcer fires handleOutcomeReveal, which bumps displayedPlayCount.
  const playCount = driveState.playHistory.length
  const [displayedPlayCount, setDisplayedPlayCount] = useState(playCount)

  // Derive the yard line the field should show:
  // - If displayedPlayCount === playCount, show live state (fully caught up)
  // - If displayedPlayCount < playCount, show the state after the last revealed play
  const isWaitingForReveal = displayedPlayCount < playCount

  // Compute display values based on which plays have been revealed
  let displayYardLine: number
  let displayDown: number
  let displayYardsToGo: number

  // Play history entries for the HistoryDrawer
  const historyEntries = driveState.playHistory

  if (!isWaitingForReveal) {
    // Fully caught up — show current live state
    displayYardLine = driveState.yardLine
    displayDown = driveState.down
    displayYardsToGo = driveState.yardsToGo
  } else {
    // Waiting — show state BEFORE the unrevealed play ran
    // That's the starting state of the unrevealed play (stored in the history entry)
    const unrevealedEntry = driveState.playHistory[displayedPlayCount]
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

  const handleOutcomeReveal = useCallback(() => {
    setDisplayedPlayCount((prev) => prev + 1)
  }, [])


  // Format latest play result (gated — only show after reveal)
  const latestResultText = useMemo(() => {
    if (driveState.playHistory.length === 0) return null
    const lastEntry = driveState.playHistory[driveState.playHistory.length - 1]
    return formatPlayResult(lastEntry.result)
  }, [driveState.playHistory])

  // Ball animation config — always idle; ball moves via yard line prop changes
  const ballAnimConfig: BallAnimationConfig = { type: "idle", duration: 0, fromY: 0, toY: 0 }

  // ── Commentary: generate exactly once per new play (stable ref) ──
  const commentaryRef = useRef<{ playCount: number; lines: CommentaryLines | null }>({
    playCount: 0,
    lines: null,
  })

  if (playCount > 0 && commentaryRef.current.playCount !== playCount) {
    const lastEntry = driveState.playHistory[playCount - 1]
    const circ = classifyCircumstance(lastEntry.down, lastEntry.yardsToGo)
    const playName = getPlayName(lastEntry.offensivePlay, circ, "offense").displayName
    commentaryRef.current = {
      playCount,
      lines: selectCommentary(
        playName,
        lastEntry.result.outcome,
        lastEntry.result.yardsGained,
        lastEntry.yardsToGo
      ),
    }
  }
  const commentary = commentaryRef.current.lines

  // Role label for header
  const roleLabel = role === "offense" ? "OFF" : "DEF"

  // Determine player names for scoreboard
  const offensePlayerName = getPlayerName(driveState.offensePlayerId)
  const defensePlayerName = getPlayerName(driveState.defensePlayerId)

  const hasOtherGames = otherDrives.length > 0
  const [otherGamesOpen, setOtherGamesOpen] = useState(true)
  const showSidePanel = otherGamesOpen && hasOtherGames

console.log("historyEntries", historyEntries)
console.log("playHistory", driveState.playHistory)
      historyEntries.filter(play => play !== driveState.playHistory[displayedPlayCount]);


  return (
    <div
      className="h-full overflow-hidden font-mono p-2 flex flex-col"
      style={{ gap: "4px" }}
    >
      {/* ═══ Header ═══ */}
      <header className="flex items-center justify-between shrink-0">
        <span
          className={`text-xl font-bold uppercase tracking-widest ${theme.accentText}`}
        >
          {roundName}
        </span>
        <span className={`text-[12px] ${theme.mutedText}`}>
          You ({roleLabel}) vs {opponentName}
        </span>
      </header>

      {/* ═══ Show/Hide toggle row (right-aligned, only when other games exist) ═══ */}
      {hasOtherGames && (
        <div className="text-right shrink-0">
          <button
            type="button"
            onClick={() => setOtherGamesOpen((prev) => !prev)}
            className={`text-[10px] ${theme.mutedText} hover:text-white transition-colors`}
          >
            {showSidePanel ? "▼ Hide other games" : `▶ Show other games (${otherDrives.length})`}
          </button>
        </div>
      )}

      {/* ═══ Field + Side panel ═══ */}
      <div className="shrink-0 flex gap-2" style={{ height: "38dvh" }}>
        {/* Field */}
        <div className="h-full flex-1 min-w-0 overflow-hidden">
          <FieldPanel
            yardLine={displayYardLine}
            maxYards={MAX_YARDS}
            down={displayDown}
            yardsToGo={displayYardsToGo}
            ballAnimConfig={ballAnimConfig}
          />
        </div>

        {/* Other Games sidebar */}
        {showSidePanel && (
          <div className="overflow-auto flex flex-col mt-6 gap-1.5 w-[140px] shrink-0">
            {otherDrives.map(({ matchupId: mId, driveState: ds }) => (
              <MiniScoreboard
                key={mId}
                down={ds.down}
                yardsToGo={ds.yardsToGo}
                yardLine={ds.yardLine}
                offensePlayerName={getPlayerName(ds.offensePlayerId)}
                defensePlayerName={getPlayerName(ds.defensePlayerId)}
                isComplete={ds.isComplete}
                endingType={ds.completion?.endingType}
                winnerId={ds.completion?.winner}
                offensePlayerId={ds.offensePlayerId}
                defensePlayerId={ds.defensePlayerId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ Play-by-Play Announcer ═══ */}
      <PlayByPlayAnnouncer
        commentary={commentary}
        playKey={driveState.playHistory.length}
        onOutcomeReveal={handleOutcomeReveal}
      />

      {/* ═══ Play Result + PlayClock ═══ */}
      <div className="relative shrink-0 py-3">
        <div className="flex items-center justify-between">
          <PlayResultLine
            resultText={isWaitingForReveal ? null : latestResultText}
            onToggleHistory={() => setHistoryOpen((prev) => !prev)}
            historyOpen={historyOpen}
          />
          {!driveState.isComplete && !isWaitingForReveal && <PlayClock />}
        </div>
        <HistoryDrawer
          entries={isWaitingForReveal ? historyEntries.slice(0, -1) : historyEntries}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      </div>

      {/* ═══ Play Cards or Completion Overlay ═══ */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {driveState.isComplete && !isWaitingForReveal ? (
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => { }}
          />
        ) : (
          <PlayCardGrid cards={cards} matchupId={matchupId} playInProgress={isWaitingForReveal} />
        )}
      </div>
    </div>
  )
}
