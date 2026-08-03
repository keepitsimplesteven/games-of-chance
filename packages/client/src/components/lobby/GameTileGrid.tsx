import { useGameStore } from "../../store/useGameStore"

const games = [
  {
    id: "coin-toss",
    name: "Coin Toss",
    emoji: "🪙",
    description: "Heads or tails — simple luck",
    active: true,
  },
  {
    id: "battle-bots",
    name: "Battle Bots",
    emoji: "🤖",
    description: "3-round robot combat: select, battle, and survive",
    active: true,
  },
  {
    id: "big-wheel",
    name: "Big Wheel",
    emoji: "🎡",
    description: "Spin the wheel twice — highest total wins",
    active: true,
  },
  {
    id: "dice-roll",
    name: "Dice Roll",
    emoji: "🎲",
    description: "Roll the dice",
    active: false,
  },
  {
    id: "card-draw",
    name: "Card Draw",
    emoji: "🃏",
    description: "Draw your fate",
    active: false,
  },
] as const

export default function GameTileGrid() {
  const role = useGameStore((s) => s.role)
  const playerId = useGameStore((s) => s.playerId)
  const currentGameType = useGameStore((s) => s.roomState?.room.gameType)
  const gameVotes = useGameStore((s) => s.roomState?.gameVotes) ?? {}
  const setGameType = useGameStore((s) => s.setGameType)
  const voteGame = useGameStore((s) => s.voteGame)

  const isHost = role === "host"

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
        const isClickable = game.active
        const votes = gameVotes[game.id] ?? []
        const voteCount = votes.length
        const playerVotedForThis = votes.includes(playerId ?? "")

        return (
          <button
            key={game.id}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && handleTileClick(game.id)}
            aria-pressed={isSelected}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-4 shadow-md transition ${
              isSelected
                ? "border-amber-500 bg-gradient-to-br from-amber-100 to-yellow-100 ring-2 ring-amber-400"
                : game.active
                  ? "cursor-pointer border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 hover:shadow-lg hover:ring-2 hover:ring-amber-300"
                  : "cursor-default border-gray-200 bg-gray-100"
            }`}
          >
            {/* Coming Soon overlay for inactive tiles */}
            {!game.active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-900/50">
                <span className="text-lg" aria-hidden="true">
                  🔒
                </span>
                <span className="mt-1 text-xs font-semibold text-white">
                  Coming Soon
                </span>
              </div>
            )}

            {/* Selected checkmark (host's choice) */}
            {isSelected && (
              <div className="absolute right-2 top-2">
                <span className="text-sm text-amber-600">✓</span>
              </div>
            )}

            {/* Vote count badge */}
            {voteCount > 0 && game.active && (
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
                isSelected
                  ? "text-amber-900"
                  : game.active
                    ? "text-amber-900"
                    : "text-gray-600"
              }`}
            >
              {game.name}
            </span>
            {game.active && (
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
