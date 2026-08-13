import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { SplashLayout } from "../../components/game/SplashLayout"

/**
 * PlaycallerSplash — Game-specific splash screen for Playcaller.
 *
 * Built on SplashLayout for viewport containment compatibility.
 * Shows tournament bracket format, drive mechanics, and scoring info.
 * Host sees "Play Game" button; non-hosts see waiting message.
 */
export function PlaycallerSplash() {
  const role = useGameStore((s) => s.role)
  const startRound = useGameStore((s) => s.startRound)
  const players = useGameStore((s) => s.roomState?.players)
  const theme = useTheme()

  const isHost = role === "host"
  const playerCount = players?.length ?? 0

  return (
    <SplashLayout
      emoji="🏈"
      title="Playcaller"
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
            College Overtime rules, mostly. Sudden death. Flip a coin to decide Offense vs Defense, then outsmart your opponent to win!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Plays</h3>
          <ul className={`space-y-0.5 ${theme.mutedText}`}>
            <li>🏃 <span className="text-white font-medium">Safe Run</span> — steady gains, low risk</li>
            <li>💨 <span className="text-white font-medium">Aggressive Run</span> — big gains or losses</li>
            <li>🎯 <span className="text-white font-medium">Safe Pass</span> — moderate gains</li>
            <li>🚀 <span className="text-white font-medium">Aggressive Pass</span> — high risk, high reward</li>
          </ul>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Scoring</h3>
          <p className={`${theme.mutedText}`}>
            Offense must drive <span className="text-white font-medium">25 yards</span> to score a touchdown. Defense just needs one stop. Points awarded by bracket placement — <span className="text-white font-medium">1st gets 250 pts</span>!
          </p>
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          {playerCount} player{playerCount !== 1 ? "s" : ""} · 20s play clock · single elimination
        </p>
      </div>
    </SplashLayout>
  )
}
