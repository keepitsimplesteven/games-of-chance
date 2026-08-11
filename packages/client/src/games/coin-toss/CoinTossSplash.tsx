import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { SplashLayout } from "../../components/game/SplashLayout"

/**
 * CoinTossSplash — Game-specific splash screen for Coin Toss.
 *
 * Built on SplashLayout for viewport containment compatibility.
 * Shows game rules, scoring mechanics, and streak system.
 * Host sees "Play Game" button; non-hosts see waiting message.
 */
export function CoinTossSplash() {
  const role = useGameStore((s) => s.role)
  const startRound = useGameStore((s) => s.startRound)
  const settings = useGameStore((s) => s.roomState?.gameSettings)
  const theme = useTheme()

  const isHost = role === "host"
  const basePoints = Number(settings?.tuning?.CORRECT_GUESS_CHIPS) || 10
  const streakThreshold = Number(settings?.tuning?.STREAK_THRESHOLD) || 3
  const streakMultiplier = Number(settings?.tuning?.STREAK_MULTIPLIER) || 2
  const roundCount = settings?.roundCount ?? 10

  return (
    <SplashLayout
      emoji="🪙"
      title="Coin Toss"
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
            Pick heads or tails each round. If the coin lands on your pick, you score!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Scoring</h3>
          <ul className={`space-y-0.5 ${theme.mutedText}`}>
            <li>✓ Correct guess: <span className="text-white font-medium">+{basePoints} pts</span></li>
            <li>✗ Wrong guess: <span className="text-white font-medium">0 pts</span></li>
          </ul>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Streak Bonus</h3>
          <p className={`${theme.mutedText}`}>
            Get <span className="text-white font-medium">{streakThreshold}</span> correct in a row for a <span className="text-white font-medium">×{streakMultiplier}</span> multiplier!
          </p>
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          {roundCount} rounds · 10s pick window
        </p>
      </div>
    </SplashLayout>
  )
}
