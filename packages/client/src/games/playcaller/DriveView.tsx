import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { useTheme } from "../../theme"
import { useCircumstance } from "./hooks/useCircumstance"
import { usePlayCards } from "./hooks/usePlayCards"
import { usePlayerName } from "./hooks/usePlayerName"
import { useGameStore } from "../../store/useGameStore"
import { FieldPanel } from "./FieldPanel"
import { GatedMiniScoreboard } from "./GatedMiniScoreboard"
import { PlayResultLine } from "./PlayResultLine"
import { HistoryDrawer } from "./HistoryDrawer"
import { PlayCardGrid } from "./PlayCardGrid"
import { PlayClock } from "./PlayClock"
import { PlayByPlayAnnouncer } from "./PlayByPlayAnnouncer"
import { formatPlayResult, yardLineToY } from "./field-utils"
import { classifyCircumstance, selectPlay, offensePlayPool } from "./play-names"
import type { PlaySlot } from "./play-names"
import { selectCommentary } from "./play-by-play"
import type { CommentaryLines } from "./play-by-play/selectCommentary"
import type { DriveState } from "./field-utils.types"
import type { BallAnimationConfig, BallAnimationType } from "./animations/types"
import { DriveCompletionOverlay } from "./DriveCompletionOverlay"
import { MatchupLabel } from "./MatchupLabel"

const MAX_YARDS = 35

export interface DriveViewProps {
  matchupId: string
  driveState: DriveState
  roundName: string
  opponentName: string
  role: "offense" | "defense"
  /** Other matchup drive states in this round (for the side panel) */
  otherDrives?: Array<{ matchupId: string; driveState: DriveState }>
  /** Called when player taps a mini-scoreboard card to spectate that game */
  onSpectate?: (matchupId: string) => void
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
  onSpectate,
}: DriveViewProps) {
  const theme = useTheme()
  const [historyOpen, setHistoryOpen] = useState(false)
  const getPlayerName = usePlayerName()

  // Derive circumstance from current down/distance
  const circumstance = useCircumstance(driveState)

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

  // While waiting for reveal, freeze the circumstance to what it was when the player
  // made their selection (the unrevealed play's starting state). This prevents
  // the play card names/art from updating and spoiling the outcome.
  const displayCircumstance = useMemo(() => {
    if (!isWaitingForReveal) return circumstance
    const unrevealedEntry = driveState.playHistory[displayedPlayCount]
    if (unrevealedEntry) {
      return classifyCircumstance(unrevealedEntry.down, unrevealedEntry.yardsToGo, unrevealedEntry.yardLine)
    }
    return circumstance
  }, [isWaitingForReveal, circumstance, driveState.playHistory, displayedPlayCount])

  // Get play cards for the current role + frozen circumstance
  const cards = usePlayCards(displayCircumstance, role)

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
    setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
  }, [playCount])


  // Format latest play result (gated — only show after reveal)
  const latestResultText = useMemo(() => {
    if (driveState.playHistory.length === 0) return null
    const lastEntry = driveState.playHistory[driveState.playHistory.length - 1]
    return formatPlayResult(lastEntry.result, lastEntry.yardLine)
  }, [driveState.playHistory])

  // ── Ball animation config ──
  // When a play is revealed (displayedPlayCount increments), fire the appropriate
  // animation type. After the animation duration elapses, revert to idle.
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
    if (displayedPlayCount > prevDisplayedRef.current && displayedPlayCount <= driveState.playHistory.length) {
      const revealedEntry = driveState.playHistory[displayedPlayCount - 1]
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

        const fromY = yardLineToY(revealedEntry.yardLine, MAX_YARDS, FIELD_HEIGHT, FIELD_TOP)
        const toY = yardLineToY(revealedEntry.resultingYardLine, MAX_YARDS, FIELD_HEIGHT, FIELD_TOP)
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
  }, [displayedPlayCount, driveState.playHistory])

  // ── Commentary: generate exactly once per new play (stable ref) ──
  const commentaryRef = useRef<{ playCount: number; lines: CommentaryLines | null }>({
    playCount: 0,
    lines: null,
  })

  if (playCount > 0 && commentaryRef.current.playCount !== playCount) {
    const lastEntry = driveState.playHistory[playCount - 1]
    const circ = classifyCircumstance(lastEntry.down, lastEntry.yardsToGo, lastEntry.yardLine)
    const slot = lastEntry.offensivePlay as PlaySlot
    const selectedPlay = selectPlay(offensePlayPool[slot], circ, Math.random)
    const axis = slot.startsWith("run") ? "run" : "pass"
    commentaryRef.current = {
      playCount,
      lines: selectCommentary(
        selectedPlay.displayName,
        lastEntry.result.outcome,
        lastEntry.result.yardsGained,
        lastEntry.yardsToGo,
        lastEntry.yardLine,
        lastEntry.down,
        circ,
        selectedPlay.messages,
        axis,
        lastEntry.offensivePlay,
        lastEntry.defensivePlay
      ),
    }
  }
  const commentary = commentaryRef.current.lines

  // Role label for header
  const roleLabel = role === "offense" ? "OFF" : "DEF"

  // Bracket seeds for display
  const seeds = useGameStore((s) => s.roomState?.playcallerGameState?.bracket?.seeds ?? {})
  const playerId = useGameStore((s) => s.playerId)

  // Determine player names for scoreboard
  const offensePlayerName = getPlayerName(driveState.offensePlayerId)
  const defensePlayerName = getPlayerName(driveState.defensePlayerId)

  // Format player name with seed prefix like "(1) [BOT] Delta"
  const myId = role === "offense" ? driveState.offensePlayerId : driveState.defensePlayerId
  const opponentId = role === "offense" ? driveState.defensePlayerId : driveState.offensePlayerId
  const mySeed = seeds[myId]
  const opponentSeed = seeds[opponentId]
  const myNameWithSeed = mySeed ? `(${mySeed}) ${getPlayerName(myId)}` : getPlayerName(myId)
  const opponentNameWithSeed = opponentSeed ? `(${opponentSeed}) ${opponentName}` : opponentName

  const hasOtherGames = otherDrives.length > 0

  // Determine if cards should be tappable (only after player's drive is complete and revealed)
  const canSpectate = driveState.isComplete && !isWaitingForReveal && !!onSpectate

  historyEntries.filter(play => play !== driveState.playHistory[displayedPlayCount]);


  return (
    <div
      className="h-full overflow-hidden font-mono p-2 flex flex-col"
      style={{ gap: "4px" }}
    >
      {/* ═══ Header ═══ */}
      <header className="flex items-center justify-between gap-2 shrink-0 overflow-hidden">
        <span
          className={`text-xl font-bold uppercase tracking-widest shrink-0 ${theme.accentText}`}
        >
          {roundName}
        </span>
        <MatchupLabel
          leftName={`You (${roleLabel})`}
          rightName={opponentNameWithSeed}
          mutedClass={theme.mutedText}
        />
      </header>

      {/* ═══ Field + Side panel ═══ */}
      <div className="flex-1 min-h-0 flex gap-2">
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
        {hasOtherGames && (
          <div className="overflow-auto flex flex-col gap-1.5 w-[140px] shrink-0">
            <span className={`text-[9px] text-center font-medium ${canSpectate ? "text-amber-300" : theme.mutedText}`}>
              {canSpectate ? "Tap a game to spectate" : "Other games"}
            </span>
            {otherDrives.map(({ matchupId: mId, driveState: ds }) => (
              <GatedMiniScoreboard
                key={mId}
                driveState={ds}
                onTap={canSpectate ? () => onSpectate!(mId) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ Play-by-Play Announcer ═══ */}
      <PlayByPlayAnnouncer
        commentary={commentary}
        playKey={driveState.playHistory.length}
        role={role}
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
      <div className="shrink-0 overflow-hidden" style={{ minHeight: "28dvh", height: "28dvh" }}>
        {driveState.isComplete && !isWaitingForReveal ? (
          <DriveCompletionOverlay
            driveState={driveState}
            onAnimationDone={() => { }}
          />
        ) : (
          <PlayCardGrid cards={cards} matchupId={matchupId} playInProgress={isWaitingForReveal} role={role} />
        )}
      </div>
    </div>
  )
}
