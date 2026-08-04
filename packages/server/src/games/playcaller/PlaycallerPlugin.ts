import type {
  PlaycallerPick,
  PlaycallerRoundResult,
  Bracket,
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  GameSettings,
} from "@games-of-chance/shared"
import type { GamePlugin } from "../GamePlugin"
import { registry } from "../GameRegistry"
import { PLAYCALLER, PLAYCALLER_SETTINGS_SCHEMA } from "./constants"
import { resolveCurrentRound, isComplete, computePlacements } from "./BracketEngine"
import { randomResolver } from "./MatchResolver"
import { validateScoreTable } from "./validateScoreTable"

// ── Module-level bracket state ─────────────────────────────────────────────

let bracketState: Bracket | null = null

export function getPlaycallerState(): Bracket | null {
  return bracketState
}

export function setPlaycallerState(state: Bracket): void {
  bracketState = state
}

export function resetPlaycallerState(): void {
  bracketState = null
}

// ── Plugin Implementation ──────────────────────────────────────────────────

/**
 * Extracts the Score_Table from settings, falling back to the default.
 * Validates that any custom table is well-formed before using it.
 */
function getScoreTable(settings: GameSettings): number[] {
  const customTable = (settings.tuning as Record<string, unknown>)?.SCORE_TABLE
  if (Array.isArray(customTable) && validateScoreTable(customTable)) {
    return customTable
  }
  return [...PLAYCALLER.DEFAULT_SCORE_TABLE]
}

/**
 * Playcaller tournament game plugin — single-elimination bracket.
 * Phase 1: match outcomes resolved at random, picks are unused.
 */
export const playcallerPlugin: GamePlugin<PlaycallerPick, PlaycallerRoundResult> = {
  gameType: "playcaller",

  settingsSchema: PLAYCALLER_SETTINGS_SCHEMA,

  pickWindowMs: PLAYCALLER.PICK_WINDOW_MS,

  /** Playcaller is the tournament finale */
  isFinale: true,

  validatePick(_pick: unknown): _pick is PlaycallerPick {
    // Phase 1: accept any pick (picks are unused)
    return true
  },

  resolveRound(
    _picks: Record<string, PlaycallerPick>,
    settings: GameSettings
  ): PlaycallerRoundResult {
    if (!bracketState) {
      throw new Error("Playcaller bracket state not initialized")
    }

    // When SKIP_GAMEPLAY is true (or Phase 2 not yet implemented), use random resolver.
    // Phase 2 will check `settings.tuning.SKIP_GAMEPLAY === false` to run play-calling mechanics.
    bracketState = resolveCurrentRound(bracketState, randomResolver)

    const currentRoundIndex = bracketState.currentRoundIndex - 1 // just resolved (index was incremented)
    const resolvedRound = bracketState.rounds[currentRoundIndex]

    return {
      bracketRound: currentRoundIndex,
      matchups: resolvedRound.matchups,
      isComplete: isComplete(bracketState),
    }
  },

  scoreRound(
    _picks: Record<string, PlaycallerPick>,
    result: PlaycallerRoundResult,
    _players: Player[],
    settings: GameSettings
  ): RoundScoreResult {
    // All scoring happens at tournament end — zero deltas during play
    if (!result.isComplete) {
      return { deltas: {} }
    }

    // Defensive: if bracketState is somehow null, return zero deltas
    if (!bracketState) {
      return { deltas: {} }
    }

    // Tournament complete — assign placement points
    const placements = computePlacements(bracketState)
    const scoreTable = getScoreTable(settings)
    const deltas: Record<string, number> = {}

    for (const [playerId, placement] of placements) {
      const index = placement - 1 // 0-based index
      deltas[playerId] = index < scoreTable.length ? scoreTable[index] : 0
    }

    return { deltas }
  },

  computeGameLeaderboard(
    players: Player[],
    gameScores: Record<string, number>
  ): GameLeaderboardEntry[] {
    if (!bracketState) {
      // No bracket yet — return players at rank 1 with 0 score
      return players.map((p, i) => ({
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] || 0,
        rank: i + 1,
      }))
    }

    if (isComplete(bracketState)) {
      // Tournament complete — rank by final placement
      const placements = computePlacements(bracketState)
      const entries: GameLeaderboardEntry[] = players.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] || 0,
        rank: placements.get(p.id) || players.length,
      }))
      // Sort by rank ascending
      entries.sort((a, b) => a.rank - b.rank)
      return entries
    }

    // During play: active competitors ranked above eliminated players
    const eliminated = new Set(Object.keys(bracketState.eliminated))
    const active = players.filter((p) => !eliminated.has(p.id))
    const elim = players.filter((p) => eliminated.has(p.id))

    const entries: GameLeaderboardEntry[] = []
    let rank = 1

    // Active players first (all share rank range, sorted by seed)
    for (const p of active) {
      entries.push({
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] || 0,
        rank: rank,
      })
    }
    rank = active.length + 1

    // Eliminated players next, sorted by elimination round (later = higher rank)
    const sortedElim = [...elim].sort((a, b) => {
      const roundA = bracketState!.eliminated[a.id] ?? -1
      const roundB = bracketState!.eliminated[b.id] ?? -1
      return roundB - roundA // later round = better placement = lower rank number
    })

    for (const p of sortedElim) {
      entries.push({
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] || 0,
        rank: rank,
      })
      rank++
    }

    return entries
  },
}

// ── Spectator / Active Competitor Helpers ───────────────────────────────────

/**
 * Returns the current spectators (eliminated + bye players for current round)
 */
export function getSpectators(): string[] {
  if (!bracketState) return []
  const eliminated = Object.keys(bracketState.eliminated)
  const currentRound = bracketState.rounds[bracketState.currentRoundIndex]
  const currentByes = currentRound ? currentRound.byes : []
  return [...eliminated, ...currentByes]
}

/**
 * Returns the active competitors for the current round
 */
export function getActiveCompetitors(): string[] {
  if (!bracketState) return []
  const currentRound = bracketState.rounds[bracketState.currentRoundIndex]
  if (!currentRound) return []
  return currentRound.matchups.flatMap(m => [m.playerA, m.playerB]).filter(p => p !== "")
}

// Register the plugin in the global GameRegistry
registry.register(playcallerPlugin)
