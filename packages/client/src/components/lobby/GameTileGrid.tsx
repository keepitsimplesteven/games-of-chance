import { useGameStore } from "../../store/useGameStore"
import type { TournamentTileStatus } from "@games-of-chance/shared"

const games = [
  {
    id: "coin-toss",
    name: "Coin Toss",
    emoji: "🪙",
    description: "Heads or tails — simple luck",
    active: true,
    isFinale: false,
  },
  {
    id: "battle-bots",
    name: "Battle Bots",
    emoji: "🤖",
    description: "3-round robot combat: select, battle, and survive",
    active: true,
    isFinale: true,
  },
  {
    id: "big-wheel",
    name: "Big Wheel",
    emoji: "🎡",
    description: "Spin the wheel twice — highest total wins",
    active: true,
    isFinale: false,
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
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-4 shadow-md transition ${
              // Tournament: locked tile
              tileStatus === "locked"
                ? "cursor-default border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200 opacity-75"
                // Tournament: unavailable tile
                : tileStatus === "unavailable"
                  ? "cursor-default border-gray-200 bg-gray-100 opacity-50"
                  // Tournament: finale available — distinct golden glow
                  : isTournament && game.isFinale && tileStatus === "available"
                    ? "cursor-pointer border-yellow-500 bg-gradient-to-br from-yellow-100 to-amber-200 ring-2 ring-yellow-400 hover:shadow-lg hover:ring-yellow-500"
                    // Normal: selected
                    : isSelected
                      ? "border-amber-500 bg-gradient-to-br from-amber-100 to-yellow-100 ring-2 ring-amber-400"
                      // Normal: active/clickable
                      : game.active
                        ? "cursor-pointer border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 hover:shadow-lg hover:ring-2 hover:ring-amber-300"
                        // Normal: inactive (coming soon)
                        : "cursor-default border-gray-200 bg-gray-100"
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
                <span className="text-sm text-amber-600">✓</span>
              </div>
            )}

            {/* Vote count badge */}
            {voteCount > 0 && isClickable && (
              <div className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5">
                <span className="text-[10px] font-bold text-white">{voteCount}</span>
              </div>
            )}

            {/* Player's own vote indicator */}
            {playerVotedForThis && !isHost && (
              <div className="absolute right-2 top-2">
                <span className="text-sm text-indigo-500">🗳️</span>
              </div>
            )}

            {/* Tile content */}
            <span className="text-3xl" aria-hidden="true">
              {game.emoji}
            </span>
            <span
              className={`mt-2 text-center text-sm font-bold ${
                tileStatus === "locked" || tileStatus === "unavailable"
                  ? "text-gray-500"
                  : isSelected
                    ? "text-amber-900"
                    : game.active
                      ? "text-amber-900"
                      : "text-gray-600"
              }`}
            >
              {game.name}
            </span>
            {game.active && tileStatus !== "locked" && tileStatus !== "unavailable" && (
              <span className="mt-1 text-center text-xs text-gray-500">
                {game.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
