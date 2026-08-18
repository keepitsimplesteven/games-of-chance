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
  const isLottery = useGameStore((s) => !!s.roomState?.lotteryState)
  const theme = useTheme()

  const isHost = role === "host"
  const playerCount = players?.length ?? 0

  const getScoringMessage = () => {
    return isLottery ? <p className={`${theme.mutedText}`}>
      Offense must drive <span className="text-white font-medium">25 yards</span> to score a touchdown. Defense just needs <span className="text-white font-medium">one stop</span>. Points awarded by bracket placement — <span className="text-white font-medium">1st gets 250 pts</span>!
    </p> : <p className={`${theme.mutedText}`}>
      Offense must drive <span className="text-white font-medium">25 yards</span> to score a touchdown. Defense just needs <span className="text-white font-medium">one stop</span>. Tournament winner gets <span className="text-white font-medium">1st pick</span>!
      <br />
      <br />
      Didn't get first? <span className="text-white font-medium">Win your consolation</span> game for a better shot at a higher pick!
    </p>
  }

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
      <h3 className={`text-center mb-4 ${theme.mutedText}`}>AKA the Ja'Marr Chase sweepstakes</h3>
      {/* Game rules content */}
      <div className="w-full space-y-2 text-sm">
        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>How to Play</h3>
          <p className={`${theme.mutedText}`}>
            College Overtime rules, mostly. Sudden death: <span className="text-white font-medium">one drive only</span>. Flip a coin to decide <span className="text-white font-medium">Offense vs Defense</span>, then outsmart your opponent to win!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Play types</h3>
          <ul className={`space-y-0.5 ${theme.mutedText}`}>
            <li>🏃 <span className="text-white font-medium">Safe Run</span>: steady gains, low risk</li>
            <li>💨 <span className="text-white font-medium">Aggressive Run</span>: big gains or losses</li>
            <li>🎯 <span className="text-white font-medium">Safe Pass</span>: moderate gains</li>
            <li>🚀 <span className="text-white font-medium">Aggressive Pass</span>: high risk, high reward</li>
          </ul>
          <br />
          <p className={`${theme.mutedText}`}>
            The offensive play call is <span className="text-white font-medium">less effective</span> if the defense<span className="text-white font-medium"> guards the matching play</span>. Offense is more likely to <span className="text-white font-medium">pop off</span> if the defense guesses <span className="text-white font-medium">completely wrong</span>!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Scoring</h3>
          {getScoringMessage()}
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          {playerCount} player{playerCount !== 1 ? "s" : ""} · 20s play clock · single elimination
        </p>
      </div>
    </SplashLayout>
  )
}
