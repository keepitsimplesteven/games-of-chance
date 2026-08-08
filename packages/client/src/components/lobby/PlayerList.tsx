import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"

/** Check if a player ID belongs to a bot */
function isBot(playerId: string): boolean {
  return playerId.startsWith("bot:")
}

export default function PlayerList() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const theme = useTheme()

  const isLobby = !phase || phase === "LOBBY"

  // Expanded in lobby, collapsed during game
  const [open, setOpen] = useState(isLobby)

  // Auto-expand/collapse when transitioning between lobby and game
  useEffect(() => {
    setOpen(isLobby)
  }, [isLobby])

  if (!roomState) return null

  const { players, sessionLeaderboard } = roomState

  // Gate session leaderboard behind animation reveal to prevent spoiling outcomes
  const deferredLeaderboard = useDeferredRevealValue(sessionLeaderboard)

  // Build a lookup for session data (using deferred values during animation)
  const sessionDataMap = new Map(
    deferredLeaderboard.map((entry) => [entry.playerId, entry])
  )

  // Sort: by session score descending, then humans before bots
  const sortedPlayers = [...players].sort((a, b) => {
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
    <div className={`rounded-lg shadow-sm ${theme.card}`}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`text-sm font-semibold uppercase tracking-wide ${theme.mutedText}`}>
          {open ? "Hide Standings" : "Show Standings"}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${theme.mutedText} ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Player list content */}
      {open && (
        <ul className="space-y-1 px-4 pb-4">
          {sortedPlayers.map((player, index) => {
            const isCurrentPlayer = player.id === playerId
            const isBotPlayer = isBot(player.id)
            const sessionEntry = sessionDataMap.get(player.id)
            const sessionScore = sessionEntry?.sessionPoints ?? 0
            const rank = sessionEntry?.rank ?? index + 1

            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${theme.listItem}`}
              >
                <div className="flex items-center gap-2">
                  {/* Rank badge */}
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${theme.listItem}`}>
                    {rank}
                  </span>

                  {/* Connection status indicator */}
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      player.connected ? "bg-green-500" : "bg-gray-400"
                    }`}
                    aria-label={player.connected ? "Connected" : "Disconnected"}
                  />

                  {/* Bot icon */}
                  {isBotPlayer && (
                    <span className="text-sm" aria-label="Bot" title="Bot">
                      🤖
                    </span>
                  )}

                  {/* Player name */}
                  <span className={`text-sm font-medium ${theme.bodyText}`}>
                    {player.name}
                    {isCurrentPlayer && (
                      <span className={`ml-1 text-xs ${theme.mutedText}`}>(you)</span>
                    )}
                  </span>

                  {/* Host badge */}
                  {player.role === "host" && (
                    <span className="text-sm" aria-label="Host" title="Host">
                      👑
                    </span>
                  )}
                </div>

                {/* Score */}
                <span className={`text-sm font-semibold ${theme.accentText}`}>
                  {sessionScore} pts
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
