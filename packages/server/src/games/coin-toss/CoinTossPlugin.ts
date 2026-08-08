import type {
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  CoinTossPick,
  CoinTossResult,
  CoinSide,
  GameSettings,
  TossHistoryEntry,
  CoinTossGameState,
} from "@games-of-chance/shared"
import type { GamePlugin } from "../GamePlugin"
import { registry } from "../GameRegistry"
import { COIN_TOSS, COIN_TOSS_SETTINGS_SCHEMA } from "./constants"
import { computeStreakScoring, type StreakState } from "./StreakEngine"

// ── Module-level streak state ──────────────────────────────────────────────

let streakState: StreakState = {
  correctStreaks: {},
  wrongStreaks: {},
}

/** Last round's applied multipliers (for leaderboard display) */
let lastAppliedMultipliers: Record<string, number> = {}

/** Ordered toss history — one entry per resolved round */
let tossHistory: TossHistoryEntry[] = []

/**
 * Resets the module-level streak state. Called when a new game starts.
 */
export function resetCoinTossStreakState(): void {
  streakState = {
    correctStreaks: {},
    wrongStreaks: {},
  }
  lastAppliedMultipliers = {}
  tossHistory = []
}

/**
 * Returns the current streak state (for testing).
 */
export function getStreakState(): StreakState {
  return streakState
}

/**
 * Returns the current coin-toss game state for client broadcast.
 */
export function getCoinTossGameState(): CoinTossGameState | null {
  if (tossHistory.length === 0) return null
  return { tossHistory }
}

// ── Plugin Implementation ──────────────────────────────────────────────────

/**
 * Coin Toss game plugin — fair 50/50 coin flip.
 * Players guess HEADS or TAILS; correct guesses earn streak-multiplied points.
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
    const basePoints = Number(settings.tuning.CORRECT_GUESS_CHIPS) || COIN_TOSS.CORRECT_GUESS_CHIPS

    // Filter out disconnected players — only score connected players
    const connectedIds = new Set(players.filter((p) => p.connected).map((p) => p.id))
    const connectedPicks: Record<string, CoinTossPick> = {}
    for (const [id, pick] of Object.entries(picks)) {
      if (connectedIds.has(id)) {
        connectedPicks[id] = pick
      }
    }

    // Use streak-based scoring
    const scoringResult = computeStreakScoring(connectedPicks, result, streakState, basePoints)

    // Update module-level streak state
    streakState = scoringResult.nextStreakState
    lastAppliedMultipliers = scoringResult.appliedMultipliers

    // Record this toss in history
    const picksRecord: Record<string, CoinSide> = {}
    for (const [id, pick] of Object.entries(connectedPicks)) {
      picksRecord[id] = pick.side
    }
    tossHistory.push({
      outcome: result.outcome,
      picks: picksRecord,
      deltas: scoringResult.deltas,
    })

    return { deltas: scoringResult.deltas }
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
        streak: streakState.correctStreaks[p.id] ?? 0,
        coldStreak: streakState.wrongStreaks[p.id] ?? 0,
        lastMultiplier: lastAppliedMultipliers[p.id] ?? 0,
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
