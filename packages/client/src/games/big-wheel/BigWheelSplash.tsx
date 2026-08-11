import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { SplashLayout } from "../../components/game/SplashLayout"

/**
 * BigWheelSplash — Game-specific splash screen for Big Wheel.
 *
 * Built on SplashLayout for viewport containment compatibility.
 * Shows game rules, spin mechanics, and scoring info.
 * Host sees "Play Game" button; non-hosts see waiting message.
 */
export function BigWheelSplash() {
  const role = useGameStore((s) => s.role)
  const startRound = useGameStore((s) => s.startRound)
  const players = useGameStore((s) => s.roomState?.players)
  const theme = useTheme()

  const isHost = role === "host"
  const playerCount = players?.length ?? 0

  return (
    <SplashLayout
      emoji="🎡"
      title="Big Wheel"
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
    >
      {/* Game rules content */}
      <div className="w-full space-y-2 text-sm">
        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>How to Play</h3>
          <p className={`${theme.mutedText}`}>
            Each player takes a turn spinning the wheel. You get <span className="text-white font-medium">2 spins</span> — your total is the sum of both!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Scoring</h3>
          <ul className={`space-y-0.5 ${theme.mutedText}`}>
            <li>🎯 Wheel values range from <span className="text-white font-medium">5 to 100</span></li>
            <li>➕ Both spins are added together</li>
            <li>🏆 Highest total wins!</li>
          </ul>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Turn Order</h3>
          <p className={`${theme.mutedText}`}>
            Players spin one at a time. Watch others spin and see where you stack up on the leaderboard!
          </p>
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          {playerCount} player{playerCount !== 1 ? "s" : ""} · 2 spins each
        </p>
      </div>
    </SplashLayout>
  )
}
