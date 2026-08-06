import { useState, useMemo } from "react"
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
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"
import { formatPlayResult, yardLineToY } from "./field-utils"
import { getDramaLevel, getAnimationDuration, getBallAnimationType } from "./animations/timing"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig } from "./animations/types"

/** Field SVG constants (must match FieldPanel) */
const FIELD_HEIGHT = 240
const FIELD_TOP = 35 // endZoneHeight + top padding
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

  // Format latest play result
  const latestResultText = useMemo(() => {
    if (driveState.playHistory.length === 0) return null
    const lastEntry = driveState.playHistory[driveState.playHistory.length - 1]
    return formatPlayResult(lastEntry.result)
  }, [driveState.playHistory])

  // Format all play history entries for the HistoryDrawer
  const historyEntries = useMemo(() => {
    return driveState.playHistory.map((entry) => formatPlayResult(entry.result))
  }, [driveState.playHistory])

  // Derive ball animation config from the latest play result
  const ballAnimConfig: BallAnimationConfig = useMemo(() => {
    if (driveState.playHistory.length === 0) {
      return { type: "idle", duration: 0, fromY: 0, toY: 0 }
    }
    const lastEntry = driveState.playHistory[driveState.playHistory.length - 1]
    const { result } = lastEntry
    const playAxis = result.offensivePlay.startsWith("pass") ? "pass" : "run"
    const dramaLevel = getDramaLevel(result.outcome)
    const duration = getAnimationDuration(dramaLevel)
    const type = getBallAnimationType(result.outcome, playAxis as "run" | "pass")
    const fromY = yardLineToY(lastEntry.yardLine, MAX_YARDS, FIELD_HEIGHT, FIELD_TOP)
    const toY = yardLineToY(lastEntry.resultingYardLine, MAX_YARDS, FIELD_HEIGHT, FIELD_TOP)
    return { type, duration, fromY, toY }
  }, [driveState.playHistory])

  // Role label for header
  const roleLabel = role === "offense" ? "OFF" : "DEF"

  // Determine player names for scoreboard
  const offensePlayerName = getPlayerName(driveState.offensePlayerId)
  const defensePlayerName = getPlayerName(driveState.defensePlayerId)

  const hasOtherGames = otherDrives.length > 0
  const [otherGamesOpen, setOtherGamesOpen] = useState(true)
  const showSidePanel = otherGamesOpen && hasOtherGames

  return (
    <div
      className="h-[100dvh] overflow-hidden font-mono p-2 flex flex-col"
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
      <div className="shrink-0 flex gap-2" style={{ height: "42dvh" }}>
        {/* Field */}
        <div className="h-full flex-1 min-w-0 overflow-hidden">
          <FieldPanel
            yardLine={driveState.yardLine}
            maxYards={MAX_YARDS}
            down={driveState.down}
            yardsToGo={driveState.yardsToGo}
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

      {/* ═══ Play Result + PlayClock ═══ */}
      <div className="relative shrink-0">
        <div className="flex items-center justify-between">
          <PlayResultLine
            resultText={latestResultText}
            onToggleHistory={() => setHistoryOpen((prev) => !prev)}
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

      {/* ═══ Play Cards or Completion Overlay ═══ */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {driveState.isComplete ? (
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => {}}
          />
        ) : (
          <PlayCardGrid cards={cards} matchupId={matchupId} />
        )}
      </div>
    </div>
  )
}
