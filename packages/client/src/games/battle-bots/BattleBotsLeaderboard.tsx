import { useGameStore } from "../../store/useGameStore"
import { BaseLeaderboard } from "../../components/game/BaseLeaderboard"

/**
 * BattleBotsLeaderboard — Thin wrapper around BaseLeaderboard with no custom slot content.
 *
 * BattleBots uses base rendering only (rank badges, player names, scores).
 * No renderRow or renderHeader needed since the game's complexity lives in the
 * BattleArena/FFAArena components rather than the leaderboard.
 *
 * Validates: Requirements 7.3, 7.5
 */
export function BattleBotsLeaderboard() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const { gameLeaderboard } = roomState

  if (gameLeaderboard.length === 0) return null

  return (
    <BaseLeaderboard
      entries={gameLeaderboard}
      currentPlayerId={playerId}
      // No renderRow or renderHeader — base rendering only
    />
  )
}
