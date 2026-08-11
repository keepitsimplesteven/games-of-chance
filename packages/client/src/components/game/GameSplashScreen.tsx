import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/** Game metadata for splash display */
const GAME_INFO: Record<string, { name: string; emoji: string }> = {
  "coin-toss": { name: "Coin Toss", emoji: "🪙" },
  "battle-bots": { name: "Battle Bots", emoji: "🤖" },
  "big-wheel": { name: "Big Wheel", emoji: "🎡" },
  "playcaller": { name: "Playcaller", emoji: "🏈" },
}

/**
 * GameSplashScreen — displayed during the SPLASH phase after the host launches a game.
 *
 * Shows:
 * - Game name and emoji
 * - Host: "Play Game" button (sends START_ROUND to transition to PICKING)
 * - Non-hosts: "Waiting for host to start game..." message
 */
export default function GameSplashScreen() {
  const role = useGameStore((s) => s.role)
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const startRound = useGameStore((s) => s.startRound)
  const theme = useTheme()

  const info = GAME_INFO[gameType ?? ""] ?? { name: gameType ?? "Unknown", emoji: "🎲" }
  const isHost = role === "host"

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className={`flex flex-col items-center gap-6 rounded-2xl px-8 py-10 shadow-lg ${theme.listItem}`}>
        <span className="text-6xl" aria-hidden="true">
          {info.emoji}
        </span>
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>
          {info.name}
        </h2>

        {isHost ? (
          <button
            type="button"
            onClick={startRound}
            className={`mt-4 w-full max-w-xs rounded-lg px-6 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnPrimary}`}
          >
            Play Game
          </button>
        ) : (
          <p className={`mt-4 text-sm ${theme.mutedText}`}>
            Waiting for host to start game...
          </p>
        )}
      </div>
    </div>
  )
}
