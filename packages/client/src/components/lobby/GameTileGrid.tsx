const games = [
  { id: "coin-toss", name: "Coin Toss", emoji: "🪙", active: true },
  { id: "dice-roll", name: "Dice Roll", emoji: "🎲", active: false },
  { id: "card-draw", name: "Card Draw", emoji: "🃏", active: false },
] as const

export default function GameTileGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {games.map((game) => (
        <div
          key={game.id}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-4 shadow-md transition ${
            game.active
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

          {/* Tile content */}
          <span className="text-3xl" aria-hidden="true">
            {game.emoji}
          </span>
          <span
            className={`mt-2 text-center text-sm font-bold ${
              game.active ? "text-amber-900" : "text-gray-600"
            }`}
          >
            {game.name}
          </span>
        </div>
      ))}
    </div>
  )
}
