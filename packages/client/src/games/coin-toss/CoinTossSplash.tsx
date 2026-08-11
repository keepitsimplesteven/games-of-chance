import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * CoinTossSplash — Game-specific splash screen for Coin Toss.
 *
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
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className={`flex flex-col items-center gap-5 rounded-2xl px-6 py-8 shadow-lg max-w-sm w-full ${theme.listItem}`}>
        {/* Title */}
        <span className="text-5xl" aria-hidden="true">🪙</span>
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>Coin Toss</h2>

        {/* How to play */}
        <div className="w-full space-y-3 text-sm">
          <div className={`rounded-lg px-4 py-3 ${theme.cardBg ?? "bg-gray-800/60"}`}>
            <h3 className={`font-semibold mb-1 ${theme.accentText}`}>How to Play</h3>
            <p className={`${theme.mutedText}`}>
              Pick heads or tails each round. If the coin lands on your pick, you score!
            </p>
          </div>

          {/* Scoring */}
          <div className={`rounded-lg px-4 py-3 ${theme.cardBg ?? "bg-gray-800/60"}`}>
            <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Scoring</h3>
            <ul className={`space-y-1 ${theme.mutedText}`}>
              <li>✓ Correct guess: <span className="text-white font-medium">+{basePoints} pts</span></li>
              <li>✗ Wrong guess: <span className="text-white font-medium">0 pts</span></li>
            </ul>
          </div>

          {/* Streak bonus */}
          <div className={`rounded-lg px-4 py-3 ${theme.cardBg ?? "bg-gray-800/60"}`}>
            <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Streak Bonus</h3>
            <p className={`${theme.mutedText}`}>
              Get <span className="text-white font-medium">{streakThreshold}</span> correct in a row to activate a <span className="text-white font-medium">×{streakMultiplier}</span> multiplier. Keep the streak alive to earn even more!
            </p>
          </div>

          {/* Game info */}
          <p className={`text-center text-xs ${theme.mutedText}`}>
            {roundCount} rounds · 10s pick window
          </p>
        </div>

        {/* CTA */}
        {isHost ? (
          <button
            type="button"
            onClick={startRound}
            className={`mt-2 w-full rounded-lg px-6 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnPrimary}`}
          >
            Play Game
          </button>
        ) : (
          <p className={`mt-2 text-sm ${theme.mutedText}`}>
            Waiting for host to start game...
          </p>
        )}
      </div>
    </div>
  )
}
