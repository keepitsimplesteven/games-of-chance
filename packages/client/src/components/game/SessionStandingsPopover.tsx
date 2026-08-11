import { useState, useEffect, useRef, useCallback } from "react"
import type { ReactNode } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"

/** Check if a player ID belongs to a bot */
function isBot(playerId: string): boolean {
  return playerId.startsWith("bot:")
}

/** Check if a player name indicates bot-controlled (vacated human slot) */
function isBotControlled(playerName: string): boolean {
  return playerName.startsWith("[BOT] ")
}

export interface SessionStandingsPopoverProps {
  /** Popover trigger button content (icon or label) */
  trigger: ReactNode
}

/**
 * SessionStandingsPopover — Floating popover that displays session standings
 * without occupying space in the normal document flow.
 *
 * Shows session entries sorted by sessionPoints descending with ties broken
 * by humans-before-bots. Each entry displays rank, connection dot, bot icon,
 * player name, host badge, and session score.
 *
 * Scores are gated behind useDeferredRevealValue to avoid spoiling outcomes
 * before animations complete.
 */
export function SessionStandingsPopover({ trigger }: SessionStandingsPopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  const players = roomState?.players ?? []
  const sessionLeaderboard = roomState?.sessionLeaderboard ?? []

  // Gate scores behind deferred reveal — show stale values until animation done
  // or phase is PICKING/LOBBY/END_GAME
  const deferredLeaderboard = useDeferredRevealValue(sessionLeaderboard)

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

  // Build lookup for session data (using deferred values)
  const sessionDataMap = new Map(
    deferredLeaderboard.map((entry) => [entry.playerId, entry])
  )

  // Sort entries: by sessionPoints descending, ties broken by humans-before-bots
  const sortedPlayers = [...players]
    .filter((p) => sessionDataMap.has(p.id) || players.some((pl) => pl.id === p.id))
    .sort((a, b) => {
      const aScore = sessionDataMap.get(a.id)?.sessionPoints ?? 0
      const bScore = sessionDataMap.get(b.id)?.sessionPoints ?? 0
      if (bScore !== aScore) return bScore - aScore
      // Tie-break: humans before bots
      const aIsBot = isBot(a.id)
      const bIsBot = isBot(b.id)
      if (aIsBot !== bIsBot) return aIsBot ? 1 : -1
      return 0
    })

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

      {/* Floating panel — does not occupy document flow */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Session Standings"
          className={`absolute right-0 top-full mt-1 z-50 rounded-lg border-2 border-[#2a7a3a] shadow-xl p-3 min-w-[220px] max-h-[70vh] overflow-y-auto ${theme.card}`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accentText} mb-2 px-1`}>
            Session Standings
          </div>

          {sortedPlayers.length === 0 ? (
            <div className={`text-xs ${theme.mutedText} px-1`}>No standings yet</div>
          ) : (
            <ul className="space-y-1">
              {sortedPlayers.map((player, index) => {
                const isCurrentPlayer = player.id === playerId
                const isBotPlayer = isBot(player.id)
                const sessionEntry = sessionDataMap.get(player.id)
                const sessionScore = sessionEntry?.sessionPoints ?? 0
                const rank = sessionEntry?.rank ?? index + 1

                return (
                  <li
                    key={player.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${theme.listItem} ${
                      isCurrentPlayer ? theme.currentPlayerRing : ""
                    }`}
                  >
                    {/* Rank */}
                    <span className={`text-[10px] font-bold shrink-0 w-4 text-center ${theme.accentText}`}>
                      {rank}
                    </span>

                    {/* Connection dot */}
                    <span
                      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                        player.connected ? "bg-green-500" : "bg-gray-400"
                      }`}
                      aria-label={player.connected ? "Connected" : "Disconnected"}
                    />

                    {/* Bot icon */}
                    {(isBotPlayer || isBotControlled(player.name)) && (
                      <span className="text-xs shrink-0" aria-label="Bot">🤖</span>
                    )}

                    {/* Player name */}
                    <span className={`text-xs font-medium truncate flex-1 min-w-0 ${theme.bodyText}`}>
                      {player.name}
                      {isCurrentPlayer && (
                        <span className={`ml-0.5 text-[10px] ${theme.mutedText}`}>(you)</span>
                      )}
                    </span>

                    {/* Host badge */}
                    {player.role === "host" && (
                      <span className="text-xs shrink-0" aria-label="Host" title="Host">👑</span>
                    )}

                    {/* Session score */}
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${theme.accentText}`}>
                      {sessionScore}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
