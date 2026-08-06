import { useState, useMemo } from "react"
import { useTheme } from "../../theme"
import { useCircumstance } from "./hooks/useCircumstance"
import { usePlayCards } from "./hooks/usePlayCards"
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
}: DriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)

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
      return { type: "run", duration: 0, fromY: 0, toY: 0 }
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
  const offensePlayerName = driveState.offensePlayerId
  const defensePlayerName = driveState.defensePlayerId

  return (
    <div
      className="h-[100dvh] overflow-hidden font-mono p-2"
      style={{
        display: "grid",
        gridTemplateColumns: "60fr 40fr",
        gridTemplateRows: "auto 40dvh auto 33dvh",
        gap: "6px",
      }}
    >
      {/* ═══ ROW 1: Header (spans 2 cols) ═══ */}
      <header
        style={{ gridColumn: "1 / -1" }}
        className="flex items-center justify-between"
      >
        <span
          className={`text-xl font-bold uppercase tracking-widest ${theme.accentText}`}
        >
          {roundName}
        </span>
        <span className={`text-[12px] ${theme.mutedText}`}>
          You ({roleLabel}) vs {opponentName}
        </span>
      </header>

      {/* ═══ ROW 2, COL 1: Field Panel ═══ */}
      <div className="overflow-hidden">
        <FieldPanel
          yardLine={driveState.yardLine}
          maxYards={MAX_YARDS}
          down={driveState.down}
          yardsToGo={driveState.yardsToGo}
          ballAnimConfig={ballAnimConfig}
        />
      </div>

      {/* ═══ ROW 2, COL 2: MiniScoreboard ═══ */}
      <div className="overflow-hidden flex flex-col justify-start">
        <MiniScoreboard
          down={driveState.down}
          yardsToGo={driveState.yardsToGo}
          yardLine={driveState.yardLine}
          offensePlayerName={offensePlayerName}
          defensePlayerName={defensePlayerName}
        />
      </div>

      {/* ═══ ROW 3: PlayResultLine + PlayClock + HistoryDrawer (spans 2 cols) ═══ */}
      <div style={{ gridColumn: "1 / -1" }} className="relative">
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

      {/* ═══ ROW 4: PlayCardGrid or DriveCompletionOverlay (spans 2 cols) ═══ */}
      <div style={{ gridColumn: "1 / -1" }} className="overflow-hidden min-h-0">
        {driveState.isComplete ? (
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => {
              // Signal round animation complete — container handles next steps
            }}
          />
        ) : (
          <PlayCardGrid cards={cards} matchupId={matchupId} />
        )}
      </div>
    </div>
  )
}
