import { useGameStore } from "../../store/useGameStore"
import { CoinTossContainer } from "../../games/coin-toss/CoinTossContainer"
import { BattleBotsView } from "../../games/battle-bots/BattleBotsView"
import { BattleBotsLeaderboard } from "../../games/battle-bots/BattleBotsLeaderboard"
import { BigWheelContainer } from "../../games/big-wheel/BigWheelContainer"
import { PlaycallerContainer } from "../../games/playcaller/PlaycallerContainer"
import GameLeaderboard from "./GameLeaderboard"
import PhaseIndicator from "./PhaseIndicator"
import GameCompleteScreen from "./GameCompleteScreen"
import CongratulationsScreen from "./CongratulationsScreen"
import RoundControls from "./RoundControls"

/**
 * GameView — renders inside LobbyShell when a game is active (phase ≠ LOBBY).
 *
 * Contains:
 * - CoinTossContainer (dynamic per gameType — currently only coin-toss)
 * - GameLeaderboard (only shown during RESULT phase after animation completes, or during PICKING)
 * - RoundControls (host: next round / end game)
 *
 * Playcaller games render full-viewport — phase indicator, leaderboard, and
 * round controls are omitted so the DriveView can fill the screen without scroll.
 *
 * END_GAME routing:
 * - END_TOURNAMENT phase (finale game completed in tournament mode) → CongratulationsScreen (podium)
 * - END_GAME phase (non-finale or endless mode) → GameCompleteScreen (ranked list with risers/fallers)
 *
 * On RETURN_TO_LOBBY response (phase returns to LOBBY): this component returns null,
 * effectively hiding the game view and allowing the lobby tiles to show again.
 *
 * Validates: Requirements 6.6, 6.7, 17.3
 */
export default function GameView() {
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const gameType = useGameStore((s) => s.roomState?.room.gameType)
  const roundAnimationDone = useGameStore((s) => s.roundAnimationDone)

  // Only render when a game is active (phase ≠ LOBBY)
  if (!phase || phase === "LOBBY") return null

  // END_TOURNAMENT phase — finale game completed in tournament mode → podium
  if (phase === "END_TOURNAMENT") {
    return <CongratulationsScreen />
  }

  // END_GAME phase — show the GameCompleteScreen (ranked list with risers/fallers)
  // In endless mode, this is always the end screen (no finale exists).
  // In tournament mode, non-finale games also land here.
  if (phase === "END_GAME") {
    return <GameCompleteScreen />
  }

  // Playcaller renders full-viewport — omit phase indicator, leaderboard, round controls
  const isPlaycaller = gameType === "playcaller"

  // Only show leaderboard after animation completes (prevents spoiling the result)
  // During PICKING phase, show leaderboard (previous round's scores are already revealed)
  // Coin-toss: leaderboard is integrated into CoinTossContainer, skip generic one
  // Big-wheel: leaderboard is integrated into BigWheelContainer with spin order, skip generic one
  // Battle-bots: uses BattleBotsLeaderboard (BaseLeaderboard wrapper), skip generic one
  const showLeaderboard = !isPlaycaller && gameType !== "coin-toss" && gameType !== "big-wheel" && gameType !== "battle-bots" && (phase === "PICKING" || roundAnimationDone)
  const showBattleBotsLeaderboard = gameType === "battle-bots" && (phase === "PICKING" || roundAnimationDone)

  // Dynamic game container based on gameType
  const renderGameContainer = () => {
    switch (gameType) {
      case "coin-toss":
        return <CoinTossContainer />
      case "battle-bots":
        return <BattleBotsView />
      case "big-wheel":
        return <BigWheelContainer />
      case "playcaller":
        return <PlaycallerContainer />
      default:
        return (
          <div className="py-8 text-center text-gray-500">
            Unknown game type: {gameType}
          </div>
        )
    }
  }

  // Playcaller: render just the game container (takes full viewport)
  if (isPlaycaller) {
    return renderGameContainer()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Phase indicator — shows current game phase */}
      <PhaseIndicator phase={phase} gameType={gameType} />

      {/* Game-specific UI (pick widget, animation, result) */}
      {renderGameContainer()}

      {/* Game leaderboard — hidden during RESOLVING to avoid spoiling the result */}
      {showLeaderboard && <GameLeaderboard />}
      {showBattleBotsLeaderboard && <BattleBotsLeaderboard />}

      {/* Host round controls (Next Round / End Game) */}
      <RoundControls />
    </div>
  )
}
