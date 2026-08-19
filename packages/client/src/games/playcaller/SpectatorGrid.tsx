import { useState, useEffect, useRef } from "react"
import { useTheme } from "../../theme"
import { usePlayerName } from "./hooks/usePlayerName"
import { useGameStore } from "../../store/useGameStore"
import { formatDownDistance } from "./field-utils"
import { PLAY_TIMELINE } from "./PlayByPlayAnnouncer"
import type { DriveState } from "./field-utils.types"

export interface SpectatorGridProps {
  matchups: Array<{ matchupId: string; driveState: DriveState }>
  onSelectMatchup: (matchupId: string) => void
}

/** Total delay before outcome reveal in the announcer timeline */
const REVEAL_DELAY =
  PLAY_TIMELINE.preSnapDelay + PLAY_TIMELINE.preSnapHold + PLAY_TIMELINE.activePlayHold

/**
 * SpectatorGrid — Renders a card per matchup showing player names
 * and current drive progress. When a drive is complete, shows the outcome
 * and strikes through the eliminated player.
 *
 * UI updates are gated behind the same timeline as the play-by-play announcer
 * so spectators don't see outcomes before players do.
 *
 * Tapping a card triggers onSelectMatchup to navigate to a read-only drive view.
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
      <div className={`text-center text-m uppercase tracking-wide ${theme.mutedText}`}>
        Tap on a matchup to spectate
      </div>
      <div className="flex w-full justify-between">
        <p className={`${theme.mutedText}`}>
        Offense
      </p>
        <p className={`${theme.mutedText}`}>
        Defense
      </p>
      </div>
      <div className="flex flex-col gap-2">
        {matchups.map(({ matchupId, driveState }) => (
          <SpectatorMatchupCard
            key={matchupId}
            matchupId={matchupId}
            driveState={driveState}
            onSelect={onSelectMatchup}
          />
        ))}
      </div>
    </div>
  )
}

interface SpectatorMatchupCardProps {
  matchupId: string
  driveState: DriveState
  onSelect: (matchupId: string) => void
}

/**
 * Individual matchup card with its own play-gating timer.
 * Delays showing new play results until the announcer timeline would have revealed them.
 */
function SpectatorMatchupCard({ matchupId, driveState, onSelect }: SpectatorMatchupCardProps) {
  const theme = useTheme()
  const getPlayerName = usePlayerName()
  const seeds = useGameStore((s) => s.roomState?.playcallerGameState?.bracket?.seeds ?? {})

  const playCount = driveState.playHistory.length

  // On mount, treat all pre-existing play history as already revealed.
  // Only gate plays that arrive *after* mount (live updates).
  // This prevents refresh/reconnect from getting permanently stuck one play behind.
  const initialDisplayCount = useRef(playCount).current
  const [displayedPlayCount, setDisplayedPlayCount] = useState(initialDisplayCount)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync safeguard: if multiple plays landed at once (spectator toggled
  // between games, or was away), snap to playCount - 1 so only the latest
  // play is gated. Prevents getting stuck multiple plays behind.
  const prevPlayCountRef = useRef(playCount)
  useEffect(() => {
    const delta = playCount - prevPlayCountRef.current
    prevPlayCountRef.current = playCount
    if (delta > 1) {
      setDisplayedPlayCount(playCount - 1)
    }
  }, [playCount])

  const isWaitingForReveal = displayedPlayCount < playCount

  // Auto-advance after the announcer reveal delay
  useEffect(() => {
    if (!isWaitingForReveal) return

    timerRef.current = setTimeout(() => {
      setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
    }, REVEAL_DELAY)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isWaitingForReveal, displayedPlayCount, playCount])

  // Compute gated display values
  let displayDown: number
  let displayYardsToGo: number
  let displayYardLine: number
  let displayIsComplete: boolean
  let displayCompletion: DriveState["completion"]

  if (!isWaitingForReveal) {
    displayDown = driveState.down
    displayYardsToGo = driveState.yardsToGo
    displayYardLine = driveState.yardLine
    displayIsComplete = driveState.isComplete
    displayCompletion = driveState.completion
  } else {
    // Show state before the unrevealed play
    const unrevealedEntry = driveState.playHistory[displayedPlayCount]
    if (unrevealedEntry) {
      displayDown = unrevealedEntry.down
      displayYardsToGo = unrevealedEntry.yardsToGo
      displayYardLine = unrevealedEntry.yardLine
    } else {
      displayDown = driveState.down
      displayYardsToGo = driveState.yardsToGo
      displayYardLine = driveState.yardLine
    }
    // Don't show completion until all plays are revealed
    displayIsComplete = false
    displayCompletion = null
  }

  const winnerId = displayCompletion?.winner
  const endingType = displayCompletion?.endingType

  // Build display names with seed prefix
  const offenseDisplay = seeds[driveState.offensePlayerId]
    ? `(${seeds[driveState.offensePlayerId]}) ${getPlayerName(driveState.offensePlayerId)}`
    : getPlayerName(driveState.offensePlayerId)
  const defenseDisplay = seeds[driveState.defensePlayerId]
    ? `(${seeds[driveState.defensePlayerId]}) ${getPlayerName(driveState.defensePlayerId)}`
    : getPlayerName(driveState.defensePlayerId)

  return (
    <button
      data-testid="spectator-matchup-card"
      type="button"
      onClick={() => onSelect(matchupId)}
      className={`${theme.listItem} rounded-lg border border-current/10 px-3 py-2 text-left w-full transition-transform active:scale-[0.97] min-h-32`}
    >
      {/* Player names */}
      <div className="flex justify-between items-center gap-1 overflow-hidden">
        <span
          className={`font-bold truncate min-w-0 flex-1 text-left ${getSpectatorNameSize(offenseDisplay)} ${displayIsComplete && winnerId !== driveState.offensePlayerId
              ? "line-through text-gray-500"
              : displayIsComplete && winnerId === driveState.offensePlayerId
                ? theme.statusSuccess
                : theme.bodyText
            }`}
        >
          {offenseDisplay}
        </span>
        <span className={`text-[12px] ${theme.mutedText} opacity-60 shrink-0`}>
          vs
        </span>
        <span
          className={`font-bold truncate min-w-0 flex-1 text-right ${getSpectatorNameSize(defenseDisplay)} ${displayIsComplete && winnerId !== driveState.defensePlayerId
              ? "line-through text-gray-500"
              : displayIsComplete && winnerId === driveState.defensePlayerId
                ? theme.statusSuccess
                : theme.bodyText
            }`}
        >
          {defenseDisplay}
        </span>
      </div>

      {/* Status: outcome when complete, down/distance when active */}
      <div className="text-center mt-4">
        {displayIsComplete && endingType ? (
          <span className={`text-[18px] font-bold ${endingType === "touchdown" ? theme.statusSuccess : theme.statusDanger
            }`}>
            {formatEndingType(endingType)}
          </span>
        ) : (
          <>
            <span className={`text-[18px] font-bold ${theme.accentText}`}>
              {formatDownDistance(displayDown, displayYardsToGo, displayYardLine)}
            </span>
            <span className={`text-[16px] ${theme.mutedText} ml-1`}>
              • Ball on {displayYardLine}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

/** Returns text size class that shrinks for longer player names in spectator cards. */
function getSpectatorNameSize(name: string): string {
  const len = name.length
  if (len >= 25) return "text-[12px]"
  if (len >= 20) return "text-[14px]"
  if (len >= 15) return "text-[16px]"
  return "text-[18px]"
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
