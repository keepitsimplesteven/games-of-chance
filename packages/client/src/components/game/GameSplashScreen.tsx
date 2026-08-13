import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { SplashLayout } from "./SplashLayout"

/** Game metadata for splash display */
const GAME_INFO: Record<string, { name: string; emoji: string }> = {
  "coin-toss": { name: "Coin Toss Blitz", emoji: "🪙" },
  "battle-bots": { name: "Battle Bots", emoji: "🤖" },
  "big-wheel": { name: "Big Wheel", emoji: "🎡" },
  "playcaller": { name: "Playcaller", emoji: "🏈" },
}

/**
 * GameSplashScreen — Generic fallback splash screen displayed during the
 * SPLASH phase when no game-specific splash component exists.
 *
 * Built on SplashLayout for viewport containment compatibility.
 */
export default function GameSplashScreen() {
  const role = useGameStore((s) => s.role)
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const startRound = useGameStore((s) => s.startRound)
  const theme = useTheme()

  const info = GAME_INFO[gameType ?? ""] ?? { name: gameType ?? "Unknown", emoji: "🎲" }
  const isHost = role === "host"

  return (
    <SplashLayout
      emoji={info.emoji}
      title={info.name}
      action={
        isHost ? (
          <button
            type="button"
            onClick={startRound}
            className={`w-full rounded-lg px-6 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnPrimary}`}
          >
            Play Game
          </button>
        ) : (
          <p className={`text-center text-sm ${theme.mutedText}`}>
            Waiting for host to start game...
          </p>
        )
      }
    />
  )
}
