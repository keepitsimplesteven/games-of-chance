import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { SplashLayout } from "../../components/game/SplashLayout"

/**
 * BattleBotsSplash — Game-specific splash screen for Battle Bots.
 *
 * Built on SplashLayout for viewport containment compatibility.
 * Shows game rules, build mechanics, combat format, and scoring info.
 * Host sees "Play Game" button; non-hosts see waiting message.
 */
export function BattleBotsSplash() {
  const role = useGameStore((s) => s.role)
  const startRound = useGameStore((s) => s.startRound)
  const players = useGameStore((s) => s.roomState?.players)
  const theme = useTheme()

  const isHost = role === "host"
  const playerCount = players?.length ?? 0

  return (
    <SplashLayout
      emoji="🤖"
      title="Battle Bots"
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
            Build a robot by choosing a <span className="text-white font-medium">weapon</span>, <span className="text-white font-medium">head</span>, <span className="text-white font-medium">body</span>, and <span className="text-white font-medium">color</span>. Then battle!
          </p>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Stats</h3>
          <ul className={`space-y-0.5 ${theme.mutedText}`}>
            <li>⚔️ <span className="text-white font-medium">Damage</span> — how hard you hit</li>
            <li>🎯 <span className="text-white font-medium">Accuracy</span> — chance to land hits</li>
            <li>⚡ <span className="text-white font-medium">Speed</span> — how fast you attack</li>
          </ul>
        </div>

        <div className={`rounded-lg px-3 py-2 ${theme.card}`}>
          <h3 className={`font-semibold mb-1 ${theme.accentText}`}>Combat</h3>
          <p className={`${theme.mutedText}`}>
            After building, robots fight in <span className="text-white font-medium">1v1 battles</span>. Winners advance to the <span className="text-white font-medium">Winners Bracket FFA</span>, losers fight in the <span className="text-white font-medium">Losers Bracket FFA</span>. Gain more points the longer your bot survives!
          </p>
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          {playerCount} player{playerCount !== 1 ? "s" : ""} · Build → 1v1 → FFA
        </p>
      </div>
    </SplashLayout>
  )
}
