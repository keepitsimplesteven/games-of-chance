import { useState, useEffect, useRef, useCallback } from "react"
import type { ReactNode } from "react"
import type { GameLeaderboardEntry } from "@games-of-chance/shared"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"
import { BaseLeaderboard } from "../../components/game/BaseLeaderboard"

export interface PlaycallerLeaderboardProps {
  /** Popover trigger button content (icon or label) */
  trigger: ReactNode
}

/**
 * PlaycallerLeaderboard — Session standings dropdown for the PlaycallerHeader.
 * Uses BaseLeaderboard with variant="compact" to render session entries mapped
 * to GameLeaderboardEntry shape.
 *
 * Maintains the same popover behavior (floating panel, outside click close,
 * Escape key close, deferred reveal gating) as SessionStandingsPopover but
 * delegates rendering to the standardized BaseLeaderboard compact variant.
 *
 * Validates: Requirements 7.4, 7.5
 */
export function PlaycallerLeaderboard({ trigger }: PlaycallerLeaderboardProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  const sessionLeaderboard = roomState?.sessionLeaderboard ?? []

  // Gate scores behind deferred reveal
  const deferredLeaderboard = useDeferredRevealValue(sessionLeaderboard, [])

  // Default to closed on each phase transition away from LOBBY
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    if (prevPhaseRef.current === "LOBBY" && phase !== "LOBBY") {
      setOpen(false)
    }
    prevPhaseRef.current = phase
  }, [phase])

  // Close on outside click
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  // Map SessionLeaderboardEntry[] to GameLeaderboardEntry[] for BaseLeaderboard
  // Sort by sessionPoints descending, ties broken by humans-before-bots
  const entries: GameLeaderboardEntry[] = [...deferredLeaderboard]
    .sort((a, b) => {
      if (b.sessionPoints !== a.sessionPoints) return b.sessionPoints - a.sessionPoints
      // Tie-break: humans before bots
      const aIsBot = a.playerId.startsWith("bot:")
      const bIsBot = b.playerId.startsWith("bot:")
      if (aIsBot !== bIsBot) return aIsBot ? 1 : -1
      return 0
    })
    .map((entry, index) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      score: entry.sessionPoints,
      rank: index + 1,
    }))

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center"
      >
        {trigger}
      </button>

      {/* Floating panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Session Standings"
          className={`absolute right-0 top-full mt-1 z-50 min-w-[200px] max-h-[70vh] overflow-y-auto`}
        >
          {entries.length === 0 ? (
            <div className={`rounded-lg p-3 ${theme.card}`}>
              <div className={`text-xs ${theme.mutedText} px-1`}>No standings yet</div>
            </div>
          ) : (
            <BaseLeaderboard
              entries={entries}
              currentPlayerId={playerId}
              variant="compact"
            />
          )}
        </div>
      )}
    </div>
  )
}
