import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { TournamentTileStatus } from "@games-of-chance/shared"

const games = [
  {
    id: "coin-toss",
    name: "Coin Toss Blitz",
    emoji: "🪙",
    description: "Maximize your streak",
    active: true,
    isFinale: false,
    // Poker chip color: green
    tileColor: "border-4 border-[#2a7a3a] bg-[#1b5e2a] shadow-[inset_0_0_12px_rgba(0,0,0,0.3),0_3px_0_#0f3d18]",
  },
  {
    id: "battle-bots",
    name: "Battle Bots",
    emoji: "🤖",
    description: "Build, Battle, Survive",
    active: true,
    isFinale: false,
    // Poker chip color: blue
    tileColor: "border-4 border-[#143d7a] bg-[#2255aa] shadow-[inset_0_0_12px_rgba(0,0,0,0.3),0_3px_0_#0f2d5c]",
  },
  {
    id: "big-wheel",
    name: "Big Wheel",
    emoji: "🎡",
    description: "It's literally the big wheel on The Price is Right",
    active: true,
    isFinale: false,
    // Poker chip color: red
    tileColor: "border-4 border-[#8b1a1a] bg-[#cc3333] shadow-[inset_0_0_12px_rgba(0,0,0,0.3),0_3px_0_#661a1a]",
  },
  {
    id: "playcaller",
    name: "Playcaller",
    emoji: "🏈",
    description: "Single-elimination bracket tournament. May the best play caller win!",
    active: true,
    isFinale: true,
    // Poker chip color: black
    tileColor: "border-4 border-[#333333] bg-[#1a1a1a] shadow-[inset_0_0_12px_rgba(0,0,0,0.4),0_3px_0_#0a0a0a]",
  },
] as const

export default function GameTileGrid() {
  const role = useGameStore((s) => s.role)
  const playerId = useGameStore((s) => s.playerId)
  const currentGameType = useGameStore((s) => s.roomState?.room.gameType)
  const gameVotes = useGameStore((s) => s.roomState?.gameVotes) ?? {}
  const setGameType = useGameStore((s) => s.setGameType)
  const voteGame = useGameStore((s) => s.voteGame)
  const progressionMode = useGameStore((s) => s.roomState?.room.progressionMode)
  const tournamentProgress = useGameStore((s) => s.roomState?.tournamentProgress)
  const state = useGameStore((s) => s.roomState)
  const theme = useTheme()

  const isHost = role === "host"
  const isTournament = progressionMode === "tournament"
  /** Determine tile status in tournament mode */
  const getTileStatus = (gameId: string): TournamentTileStatus | null => {
    if (!isTournament || !tournamentProgress) return null
    return tournamentProgress.availability[gameId] ?? "available"
  }

  const handleTileClick = (gameId: string) => {

    if (isHost) {
      // Host selects the game directly
      setGameType(gameId)
    } else {
      // Non-host players vote
      voteGame(gameId)
    }
  }

  return (
    <div>
      <h1 className="text-md mb-2 justify-self-center font-bold text-[#f5c542] [text-shadow:2px_2px_0_#8b6914,0_0_8px_rgba(245,197,66,0.3)]">Vote on the next game!</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {games.map((game) => {
          const isSelected = game.id === currentGameType
          const tileStatus = getTileStatus(game.id)
          const votes = gameVotes[game.id] ?? []
          const voteCount = votes.length
          const playerVotedForThis = votes.includes(playerId ?? "")

          // In tournament mode, determine clickability from tile status
          // In endless mode (or no tournament progress), use the original `active` flag
          const isClickable = isTournament && tileStatus
            ? tileStatus === "available"
            : game.active

          return (
            <button
              key={game.id}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && handleTileClick(game.id)}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center justify-center rounded-xl p-4 shadow-md transition ${
                // Tournament: locked tile
                tileStatus === "locked"
                  ? `cursor-default opacity-75 ${theme.listItem}`
                  // Tournament: unavailable tile
                  : tileStatus === "unavailable"
                    ? `cursor-default opacity-50 ${theme.listItem}`
                    // Tournament: finale available — distinct golden glow
                    : isTournament && game.isFinale && tileStatus === "available"
                      ? `cursor-pointer ${game.tileColor} ring-2 ring-[#f5c542] hover:shadow-lg`
                      // Normal: selected
                      : isSelected
                        ? `${game.tileColor} ring-2 ring-[#f5c542]`
                        // Normal: active/clickable
                        : game.active
                          ? `cursor-pointer ${game.tileColor} hover:shadow-lg hover:ring-2 hover:ring-[#f5c542]/50`
                          // Normal: inactive (coming soon)
                          : `cursor-default ${theme.listItem}`
                }`}
            >
              {/* Tournament: Locked overlay */}
              {tileStatus === "locked" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-900/40">
                  <span className="text-lg" aria-hidden="true">
                    🔒
                  </span>
                  <span className="mt-1 text-xs font-semibold text-white">
                    Played
                  </span>
                </div>
              )}

              {/* Tournament: Unavailable overlay */}
              {tileStatus === "unavailable" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-900/30">
                  {game.isFinale ? (
                    <>
                      <span className="text-lg" aria-hidden="true">🔒</span>
                      <span className="mt-1 text-center text-xs font-semibold text-white px-2">
                        {(() => {
                          const remaining = games.filter(g => !g.isFinale && tournamentProgress && tournamentProgress.availability[g.id] !== "locked").length
                          return `Play ${remaining} more game${remaining !== 1 ? "s" : ""} to unlock`
                        })()}
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 text-xs font-semibold text-white">
                      Not Yet
                    </span>
                  )}
                </div>
              )}

              {/* Tournament: Finale available indicator (crown) */}
              {isTournament && game.isFinale && tileStatus === "available" && (
                <div className="absolute right-2 bottom-2">
                  <span className="text-sm" aria-label="Finale game">👑</span>
                </div>
              )}

              {/* Selected checkmark (host's choice) */}
              {isSelected && (
                <div className="absolute right-2 top-2">
                  <span className={`text-sm ${theme.accentText}`}>✓</span>
                </div>
              )}

              {/* Vote count badge */}
              {voteCount > 0 && isClickable && (
                <div className={`absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 ${theme.btnSecondary}`}>
                  <span className="text-[10px] font-bold">{voteCount}</span>
                </div>
              )}

              {/* Player's own vote indicator */}
              {playerVotedForThis && !isHost && (
                <div className="absolute right-2 top-2">
                  <span className={`text-sm ${theme.accentText}`}>🗳️</span>
                </div>
              )}

              {/* Tile content */}
              <span className="text-3xl" aria-hidden="true">
                {game.emoji}
              </span>
              <span
                className={`mt-2 text-center text-sm font-bold ${tileStatus === "locked" || tileStatus === "unavailable"
                    ? theme.mutedText
                    : "text-white"
                  }`}
              >
                {game.name}
              </span>
              {game.active && tileStatus !== "locked" && tileStatus !== "unavailable" && (
                <span className="mt-1 text-center text-xs text-white/70">
                  {game.description}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>

  )
}
