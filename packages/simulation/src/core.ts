import type { GameLeaderboardEntry, GameSettings, Player, RoundScoreResult } from "@games-of-chance/shared"
import type { GamePlugin } from "@games-of-chance/server/src/games/GamePlugin"
import type { Rng } from "./rng"
import type { PickGenerator } from "./pick-generator"
import type { BotDecisionMaker } from "./bot"
import { resetCoinTossStreakState } from "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"

export interface RoundRecord {
  roundNumber: number
  picks: Record<string, unknown>
  result: unknown
  deltas: Record<string, number>
  cumulativeScores: Record<string, number>
}

export interface GameResult {
  gameIndex: number
  rounds: RoundRecord[]
  leaderboard: GameLeaderboardEntry[]
  finalScores: Record<string, number>
}

/**
 * Runs a single complete game — pure synchronous function.
 * No I/O, no timers, no side effects beyond RNG state advancement.
 */
export function simulateGame(
  plugin: GamePlugin,
  players: Player[],
  roundCount: number,
  bot: BotDecisionMaker,
  pickGenerator: PickGenerator,
  rng: Rng,
  gameIndex: number,
  onRound?: (round: RoundRecord) => void
): GameResult {
  // Reset coin-toss streak state at the start of each game (mirrors room.ts behavior)
  if (plugin.gameType === "coin-toss") {
    resetCoinTossStreakState()
  }
  // Build default settings from the plugin's schema
  const tuning: Record<string, number | boolean | string> = {}
  if (plugin.settingsSchema) {
    for (const field of plugin.settingsSchema) {
      tuning[field.key] = field.defaultValue
    }
  }
  const settings: GameSettings = {
    roundCount,
    pickWindowMs: plugin.pickWindowMs,
    tuning,
  }

  const gameScores: Record<string, number> = {}
  for (const p of players) gameScores[p.id] = 0

  const rounds: RoundRecord[] = []

  for (let r = 1; r <= roundCount; r++) {
    // Generate picks for all bots
    const picks: Record<string, unknown> = {}
    for (const p of players) {
      picks[p.id] = bot.decidePick(pickGenerator, rng)
    }

    // Resolve round via plugin
    const result = plugin.resolveRound(picks, settings)

    // Score round via plugin
    const scoreResult: RoundScoreResult = plugin.scoreRound(picks, result, players, settings)

    // Accumulate scores
    for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
      gameScores[playerId] = (gameScores[playerId] ?? 0) + delta
    }

    const record: RoundRecord = {
      roundNumber: r,
      picks,
      result,
      deltas: scoreResult.deltas,
      cumulativeScores: { ...gameScores },
    }

    rounds.push(record)
    onRound?.(record)
  }

  // Compute final leaderboard
  const leaderboard = plugin.computeGameLeaderboard(players, gameScores)

  return { gameIndex, rounds, leaderboard, finalScores: { ...gameScores } }
}
