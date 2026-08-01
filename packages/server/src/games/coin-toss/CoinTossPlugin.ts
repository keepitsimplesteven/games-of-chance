import type {
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  CoinTossPick,
  CoinTossResult,
  CoinSide,
  GameSettings,
} from "@games-of-chance/shared"
import type { GamePlugin } from "../GamePlugin"
import { registry } from "../GameRegistry"
import { COIN_TOSS, COIN_TOSS_SETTINGS_SCHEMA } from "./constants"

/**
 * Coin Toss game plugin — fair 50/50 coin flip.
 * Players guess HEADS or TAILS; correct guesses earn CORRECT_GUESS_CHIPS.
 */
export const coinTossPlugin: GamePlugin<CoinTossPick, CoinTossResult> = {
  gameType: "coin-toss",

  settingsSchema: COIN_TOSS_SETTINGS_SCHEMA,

  pickWindowMs: COIN_TOSS.PICK_WINDOW_MS,

  validatePick(pick: unknown): pick is CoinTossPick {
    if (typeof pick !== "object" || pick === null) return false
    const candidate = pick as Record<string, unknown>
    return candidate.side === "HEADS" || candidate.side === "TAILS"
  },

  resolveRound(_picks: Record<string, CoinTossPick>, _settings: GameSettings): CoinTossResult {
    const outcome: CoinSide = Math.random() < 0.5 ? "HEADS" : "TAILS"
    return {
      outcome,
      flippedAt: Date.now(),
    }
  },

  scoreRound(
    picks: Record<string, CoinTossPick>,
    result: CoinTossResult,
    players: Player[],
    settings: GameSettings
  ): RoundScoreResult {
    const deltas: Record<string, number> = {}
    const correctGuessChips = Number(settings.tuning.CORRECT_GUESS_CHIPS) || COIN_TOSS.CORRECT_GUESS_CHIPS

    for (const player of players) {
      if (!player.connected) continue
      const pick = picks[player.id]
      deltas[player.id] =
        pick && pick.side === result.outcome ? correctGuessChips : 0
    }

    return { deltas }
  },

  computeGameLeaderboard(
    players: Player[],
    gameScores: Record<string, number>
  ): GameLeaderboardEntry[] {
    const connected = players.filter((p) => p.connected)

    // Sort by score descending
    const sorted = connected
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.score - a.score)

    // Assign ranks with ties getting equal rank
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        sorted[i].rank = 1
      } else if (sorted[i].score === sorted[i - 1].score) {
        sorted[i].rank = sorted[i - 1].rank
      } else {
        sorted[i].rank = i + 1
      }
    }

    return sorted
  },
}

// Register the plugin in the global GameRegistry
registry.register(coinTossPlugin)
