import type {
  PlaycallerPick,
  PlaycallerRoundResult,
  Bracket,
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  GameSettings,
  Matchup,
} from "@games-of-chance/shared"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./drive"
import { createDriveState, resolveDown, selectRandomPlay, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./drive"
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
  resetDriveStates()
}

// ── Module-level drive state ───────────────────────────────────────────────

/** Per-matchup drive states for the current bracket round */
let driveStates: Record<string, DriveState> | null = null

/** Per-down picks: matchupId → { offense?: play, defense?: play } */
let downPicks: Record<string, { offense?: OffensivePlayId; defense?: DefensivePlayId }> = {}

export function getDriveStates(): Record<string, DriveState> | null {
  return driveStates
}

export function setDriveStates(states: Record<string, DriveState>): void {
  driveStates = states
}

export function resetDriveStates(): void {
  driveStates = null
  downPicks = {}
}

export function getDownPicks(): Record<string, { offense?: OffensivePlayId; defense?: DefensivePlayId }> {
  return downPicks
}

export function clearDownPicks(): void {
  downPicks = {}
}

/**
 * Check if all active (non-complete) matchups have both picks submitted for the current down.
 * Returns true when every active drive has both offense and defense picks recorded.
 */
export function allActiveMatchupsResolved(): boolean {
  if (!driveStates) return true
  for (const [matchupId, drive] of Object.entries(driveStates)) {
    if (drive.isComplete) continue
    const picks = downPicks[matchupId]
    if (!picks || picks.offense === undefined || picks.defense === undefined) {
      return false
    }
  }
  return true
}

/**
 * Check if all active (non-complete) drives have been resolved for this down cycle.
 */
export function allDrivesComplete(): boolean {
  if (!driveStates) return true
  return Object.values(driveStates).every(d => d.isComplete)
}

/**
 * Get matchup IDs for drives still in progress.
 */
export function getActiveDriveMatchups(): string[] {
  if (!driveStates) return []
  return Object.entries(driveStates)
    .filter(([_, d]) => !d.isComplete)
    .map(([id]) => id)
}

// ── Per-Down Pick Handling ──────────────────────────────────────────────────

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

/**
 * Record a play selection for a player in their matchup.
 * Returns the matchupId if both picks are now present (ready to resolve), else null.
 */
export function recordPlaySelection(
  playerId: string,
  matchupId: string,
  play: OffensivePlayId | DefensivePlayId
): { resolved: boolean; matchupId: string } | { error: string } {
  if (!driveStates || !driveStates[matchupId]) {
    return { error: "Invalid matchup" }
  }

  const drive = driveStates[matchupId]

  // Verify player belongs to this matchup
  if (playerId !== drive.offensePlayerId && playerId !== drive.defensePlayerId) {
    return { error: "Player not in this matchup" }
  }

  // Drive already complete — reject
  if (drive.isComplete) {
    return { error: "Drive already complete" }
  }

  // Initialize picks for this matchup if needed
  if (!downPicks[matchupId]) {
    downPicks[matchupId] = {}
  }

  // Determine role and validate play type
  const isOffense = playerId === drive.offensePlayerId
  if (isOffense) {
    if (downPicks[matchupId].offense !== undefined) {
      return { error: "Already picked" }
    }
    if (!OFFENSIVE_PLAYS.includes(play as OffensivePlayId)) {
      return { error: "Invalid play for role" }
    }
    downPicks[matchupId].offense = play as OffensivePlayId
  } else {
    if (downPicks[matchupId].defense !== undefined) {
      return { error: "Already picked" }
    }
    if (!DEFENSIVE_PLAYS.includes(play as DefensivePlayId)) {
      return { error: "Invalid play for role" }
    }
    downPicks[matchupId].defense = play as DefensivePlayId
  }

  // Check if both picks are in
  const picks = downPicks[matchupId]
  const resolved = picks.offense !== undefined && picks.defense !== undefined
  return { resolved, matchupId }
}

// ── Drive Initialization ───────────────────────────────────────────────────

/**
 * Initialize DriveState objects for all active matchups in the current bracket round.
 * When explicit assignments are provided (from coin toss ceremony), uses them to
 * determine offense/defense. Otherwise falls back to random assignment.
 */
export function initializeDrives(
  matchups: Matchup[],
  assignments?: Record<string, { offense: string; defense: string }>
): Record<string, DriveState> {
  const states: Record<string, DriveState> = {}

  for (const matchup of matchups) {
    const matchupId = matchup.matchupId
    let seedA: number
    let seedB: number

    if (assignments && assignments[matchupId]) {
      // Use explicit assignments: offense gets higher seed (2), defense gets lower seed (1)
      const { offense } = assignments[matchupId]
      const aIsOffense = matchup.playerA === offense
      seedA = aIsOffense ? 2 : 1
      seedB = aIsOffense ? 1 : 2
    } else {
      // Random offense/defense assignment via random seed values
      const aIsOffense = Math.random() < 0.5
      seedA = aIsOffense ? 2 : 1
      seedB = aIsOffense ? 1 : 2
    }

    states[matchupId] = createDriveState(matchup.playerA, matchup.playerB, seedA, seedB)
  }

  setDriveStates(states)
  return states
}

// ── Down Resolution ────────────────────────────────────────────────────────

/**
 * Resolve a single matchup's down. Updates driveStates in place.
 * Returns the updated DriveState.
 */
export function resolveMatchupDown(matchupId: string): DriveState {
  const drive = driveStates![matchupId]
  const picks = downPicks[matchupId]

  const { state: newState } = resolveDown(
    drive,
    picks.offense!,
    picks.defense!,
    Math.random,
    DEFAULT_PLAY_CONFIG,
    DEFAULT_PLAY_MATRIX
  )

  driveStates![matchupId] = newState
  return newState
}

// ── Fill Missing Picks ─────────────────────────────────────────────────────

/**
 * Fill missing picks with random plays for timeout scenarios.
 * Iterates active (non-complete) drives and assigns random plays
 * for any role that hasn't yet submitted a pick.
 * Returns array of matchup IDs that were filled.
 */
export function fillMissingPicks(): string[] {
  const resolvedMatchups: string[] = []

  if (!driveStates) return resolvedMatchups

  for (const [matchupId, drive] of Object.entries(driveStates)) {
    if (drive.isComplete) continue

    if (!downPicks[matchupId]) {
      downPicks[matchupId] = {}
    }

    const picks = downPicks[matchupId]
    if (picks.offense === undefined) {
      picks.offense = selectRandomPlay(OFFENSIVE_PLAYS, Math.random) as OffensivePlayId
    }
    if (picks.defense === undefined) {
      picks.defense = selectRandomPlay(DEFENSIVE_PLAYS, Math.random) as DefensivePlayId
    }

    resolvedMatchups.push(matchupId)
  }

  return resolvedMatchups
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
