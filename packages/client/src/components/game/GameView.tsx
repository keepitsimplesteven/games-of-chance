import { useGameStore } from "../../store/useGameStore"
import { CoinTossContainer } from "../../games/coin-toss/CoinTossContainer"
import { BattleBotsView } from "../../games/battle-bots/BattleBotsView"
import { BigWheelContainer } from "../../games/big-wheel/BigWheelContainer"
import GameLeaderboard from "./GameLeaderboard"
import PhaseIndicator from "./PhaseIndicator"
import FinalResultsScreen from "./FinalResultsScreen"
import RoundControls from "./RoundControls"

/**
 * GameView — renders inside LobbyShell when a game is active (phase ≠ LOBBY).
 *
 * Contains:
 * - CoinTossContainer (dynamic per gameType — currently only coin-toss)
 * - GameLeaderboard (only shown during RESULT phase after animation completes, or during PICKING)
 * - RoundControls (host: next round / end game)
 *
 * On END_GAME response (phase returns to LOBBY): this component returns null,
 * effectively hiding the game view and allowing the lobby tiles to show again.
 *
 * Validates: Requirements 6.6, 17.3
 */
export default function GameView() {
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)

  // Only render when a game is active (phase ≠ LOBBY)
  if (!phase || phase === "LOBBY") return null

  // END_GAME phase — show the final results screen with podium layout
  if (phase === "END_GAME") {
    return <FinalResultsScreen />
  }

  // Only show leaderboard after animation completes (prevents spoiling the result)
  // During PICKING phase, show leaderboard (previous round's scores are already revealed)
  const showLeaderboard = phase === "PICKING" || roundAnimationDone

  // Dynamic game container based on gameType
  const renderGameContainer = () => {
    switch (gameType) {
      case "coin-toss":
        return <CoinTossContainer />
      case "battle-bots":
        return <BattleBotsView />
      case "big-wheel":
        return <BigWheelContainer />
      default:
        return (
          <div className="py-8 text-center text-gray-500">
            Unknown game type: {gameType}
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Phase indicator — shows current game phase */}
      <PhaseIndicator phase={phase} />

      {/* Game-specific UI (pick widget, animation, result) */}
      {renderGameContainer()}

      {/* Game leaderboard — hidden during RESOLVING to avoid spoiling the result */}
      {showLeaderboard && <GameLeaderboard />}

      {/* Host round controls (Next Round / End Game) */}
      <RoundControls />
    </div>
  )
}
