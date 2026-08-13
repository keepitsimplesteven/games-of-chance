import { useState, useEffect, useRef } from "react"
import { MiniScoreboard } from "./MiniScoreboard"
import { usePlayerName } from "./hooks/usePlayerName"
import { useGameStore } from "../../store/useGameStore"
import { PLAY_TIMELINE } from "./PlayByPlayAnnouncer"
import type { DriveState } from "./field-utils.types"

/** Total delay before outcome reveal in the announcer timeline */
const REVEAL_DELAY =
  PLAY_TIMELINE.preSnapDelay + PLAY_TIMELINE.preSnapHold + PLAY_TIMELINE.activePlayHold

export interface GatedMiniScoreboardProps {
  driveState: DriveState
}

/**
 * GatedMiniScoreboard — Wraps MiniScoreboard with play-timeline gating so
 * other games shown in the sidebar don't spoil outcomes before the announcer
 * would reveal them.
 */
export function GatedMiniScoreboard({ driveState }: GatedMiniScoreboardProps) {
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
    displayIsComplete = false
    displayCompletion = null
  }

  // Format player names with seed prefix
  const offSeed = seeds[driveState.offensePlayerId]
  const defSeed = seeds[driveState.defensePlayerId]
  const offName = getPlayerName(driveState.offensePlayerId)
  const defName = getPlayerName(driveState.defensePlayerId)
  const offenseDisplayName = offSeed ? `(${offSeed}) ${offName}` : offName
  const defenseDisplayName = defSeed ? `(${defSeed}) ${defName}` : defName

  return (
    <MiniScoreboard
      down={displayDown}
      yardsToGo={displayYardsToGo}
      yardLine={displayYardLine}
      offensePlayerName={offenseDisplayName}
      defensePlayerName={defenseDisplayName}
      isComplete={displayIsComplete}
      endingType={displayCompletion?.endingType}
      winnerId={displayCompletion?.winner}
      offensePlayerId={driveState.offensePlayerId}
      defensePlayerId={driveState.defensePlayerId}
    />
  )
}
