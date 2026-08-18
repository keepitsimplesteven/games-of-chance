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
      <div className={`text-center text-xs uppercase tracking-wide ${theme.mutedText}`}>
        Tap on a matchup to spectate
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
  const [displayedPlayCount, setDisplayedPlayCount] = useState(playCount)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWaitingForReveal = displayedPlayCount < playCount

  // Auto-advance after the announcer reveal delay
  useEffect(() => {
    if (!isWaitingForReveal) return

    timerRef.current = setTimeout(() => {
      setDisplayedPlayCount((prev) => prev + 1)
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

  return (
    <button
      data-testid="spectator-matchup-card"
      type="button"
      onClick={() => onSelect(matchupId)}
      className={`${theme.listItem} rounded-lg border border-current/10 px-3 py-2 text-left w-full transition-transform active:scale-[0.97] min-h-32`}
    >
      {/* Player names */}
      <div className="flex justify-between items-center">
        <span
          className={`text-[18px] font-bold ${
            displayIsComplete && winnerId !== driveState.offensePlayerId
              ? "line-through text-gray-500"
              : displayIsComplete && winnerId === driveState.offensePlayerId
                ? theme.statusSuccess
                : theme.bodyText
          }`}
        >
          {seeds[driveState.offensePlayerId] ? `(${seeds[driveState.offensePlayerId]}) ` : ""}{getPlayerName(driveState.offensePlayerId)}
        </span>
        <span className={`text-[14px] ${theme.mutedText} opacity-60 mx-1`}>
          vs
        </span>
        <span
          className={`text-[18px] font-bold  ${
            displayIsComplete && winnerId !== driveState.defensePlayerId
              ? "line-through text-gray-500"
              : displayIsComplete && winnerId === driveState.defensePlayerId
                ? theme.statusSuccess
                : theme.bodyText
          }`}
        >
          {seeds[driveState.defensePlayerId] ? `(${seeds[driveState.defensePlayerId]}) ` : ""}{getPlayerName(driveState.defensePlayerId)}
        </span>
      </div>

      {/* Status: outcome when complete, down/distance when active */}
      <div className="text-center mt-4">
        {displayIsComplete && endingType ? (
          <span className={`text-[18px] font-bold ${
            endingType === "touchdown" ? theme.statusSuccess : theme.statusDanger
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

function formatEndingType(endingType: string): string {
  switch (endingType) {
    case "touchdown": return "🏈 TOUCHDOWN"
    case "interception": return "🚫 INTERCEPTION"
    case "fumble": return "🚫 FUMBLE"
    case "turnover_on_downs": return "🚫 TURNOVER ON DOWNS"
    default: return "GAME OVER"
  }
}
