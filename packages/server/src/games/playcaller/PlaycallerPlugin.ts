import type {
  PlaycallerPick,
  PlaycallerRoundResult,
  Bracket,
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  GameSettings,
  Matchup,
  MatchResolver,
} from "@games-of-chance/shared"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./drive"
import { createDriveState, resolveDown, selectRandomPlay, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./drive"
import { resolveLotteryDown } from "./lottery/lotteryDriveResolver"
import type { GamePlugin } from "../GamePlugin"
import { registry } from "../GameRegistry"
import { PLAYCALLER, PLAYCALLER_SETTINGS_SCHEMA } from "./constants"
import { resolveCurrentRound, isComplete, isFullyComplete, computePlacements, generateConsolationForRound, buildSchedule } from "./BracketEngine"
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
  resetLotteryWinners()
  resetLotteryPlacements()
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

// ── Module-level lottery winners state ────────────────────────────────────

/** Predetermined winners from lottery draw — matchupId → winnerId */
let lotteryWinners: Record<string, string> | null = null

export function getLotteryWinners(): Record<string, string> | null {
  return lotteryWinners
}

export function setLotteryWinners(winners: Record<string, string>): void {
  lotteryWinners = winners
}

export function resetLotteryWinners(): void {
  lotteryWinners = null
}

// ── Module-level lottery placements state ─────────────────────────────────

/** Lottery placements: playerId → placement number (1-based, lower = better) */
let lotteryPlacements: Record<string, number> | null = null

export function getLotteryPlacements(): Record<string, number> | null {
  return lotteryPlacements
}

export function setLotteryPlacements(placements: Record<string, number>): void {
  lotteryPlacements = placements
}

export function resetLotteryPlacements(): void {
  lotteryPlacements = null
}

// ── Lottery Matchup Resolver ────────────────────────────────────────────────

/**
 * Creates a MatchResolver that determines the winner using lottery placements.
 * Primary mechanism: the player with the lower placement number always wins.
 * Fallback: looks up by matchup ID in the winners map (for pre-computed main bracket).
 */
function createLotteryMatchupResolver(
  winners: Record<string, string>,
  bracket: Bracket
): MatchResolver {
  return (playerA: string, playerB: string): string => {
    // Primary: use placement-based resolution — lower placement number always wins.
    // This works regardless of matchup ID, handling consolation rounds generated at runtime.
    if (lotteryPlacements) {
      const placA = lotteryPlacements[playerA]
      const placB = lotteryPlacements[playerB]
      if (placA !== undefined && placB !== undefined) {
        return placA < placB ? playerA : playerB
      }
    }

    // Fallback: find the matchup by player pair in main bracket rounds
    for (const round of bracket.rounds) {
      for (const matchup of round.matchups) {
        if (
          (matchup.playerA === playerA && matchup.playerB === playerB) ||
          (matchup.playerA === playerB && matchup.playerB === playerA)
        ) {
          const winner = winners[matchup.matchupId]
          if (winner) return winner
        }
      }
    }
    // Check consolation rounds
    for (const cRound of bracket.consolationRounds) {
      for (const matchup of cRound.matchups) {
        if (
          (matchup.playerA === playerA && matchup.playerB === playerB) ||
          (matchup.playerA === playerB && matchup.playerB === playerA)
        ) {
          const winner = winners[matchup.matchupId]
          if (winner) return winner
        }
      }
    }
    // Last resort fallback: shouldn't happen in lottery mode
    return playerA
  }
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

  let newState: DriveState

  // Check if there's a predetermined winner for this matchup (lottery mode)
  let predeterminedWinner = lotteryWinners?.[matchupId]

  // If no matchup ID match, try placement-based resolution
  if (!predeterminedWinner && lotteryPlacements) {
    const placA = lotteryPlacements[drive.offensePlayerId]
    const placB = lotteryPlacements[drive.defensePlayerId]
    if (placA !== undefined && placB !== undefined) {
      predeterminedWinner = placA < placB ? drive.offensePlayerId : drive.defensePlayerId
    }
  }

  if (predeterminedWinner) {
    // Determine if this is the Final game — if so, enforce minimum play count for drama
    let minPlays: number | undefined
    if (bracketState) {
      const scheduleEntry = bracketState.schedule[bracketState.currentScheduleIndex]
      if (scheduleEntry?.description === "Final") {
        minPlays = PLAYCALLER.FINAL_MIN_PLAYS
      }
    }

    const resolved = resolveLotteryDown(
      drive,
      picks.offense!,
      picks.defense!,
      Math.random,
      DEFAULT_PLAY_CONFIG,
      DEFAULT_PLAY_MATRIX,
      predeterminedWinner,
      minPlays
    )
    newState = resolved.state
  } else {
    const resolved = resolveDown(
      drive,
      picks.offense!,
      picks.defense!,
      Math.random,
      DEFAULT_PLAY_CONFIG,
      DEFAULT_PLAY_MATRIX
    )
    newState = resolved.state
  }

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
    _settings: GameSettings
  ): PlaycallerRoundResult {
    if (!bracketState) {
      throw new Error("Playcaller bracket state not initialized")
    }

    // Schedule-based resolution: resolve the current schedule entry (main + consolation)
    const scheduleEntry = bracketState.schedule[bracketState.currentScheduleIndex]

    let resultMatchups: Matchup[] = []
    let resultBracketRound = -1
    let consolationMatchupsResolved: Matchup[] = []
    let consolationContext: { placementStart: number; description: string }[] = []

    // Determine the match resolver — lottery mode uses predetermined winners
    const resolver: MatchResolver = lotteryWinners
      ? createLotteryMatchupResolver(lotteryWinners, bracketState)
      : randomResolver

    // Resolve main-bracket matchups (if schedule entry has a mainBracketRoundIndex)
    if (scheduleEntry.mainBracketRoundIndex !== null) {
      bracketState = resolveCurrentRound(bracketState, resolver)
      resultBracketRound = scheduleEntry.mainBracketRoundIndex
      resultMatchups = bracketState.rounds[scheduleEntry.mainBracketRoundIndex].matchups
    }

    // Resolve consolation matchups (for each consolation round index in the schedule entry)
    for (const cIdx of scheduleEntry.consolationRoundIndices) {
      const consolationRound = bracketState.consolationRounds[cIdx]
      if (!consolationRound || consolationRound.resolved) continue

      // Skip rounds with empty players (shouldn't happen with flat matchups, but defensive)
      const hasReadyMatchup = consolationRound.matchups.some((m) => m.playerA !== "" && m.playerB !== "")
      if (!hasReadyMatchup) continue

      // Resolve each matchup with the appropriate resolver (lottery or random)
      for (const matchup of consolationRound.matchups) {
        if (matchup.playerA && matchup.playerB) {
          matchup.winner = resolver(matchup.playerA, matchup.playerB)
        }
      }
      consolationRound.resolved = true

      consolationMatchupsResolved.push(...consolationRound.matchups)
      consolationContext.push({
        placementStart: consolationRound.placementStart,
        description: `${consolationRound.placementStart}th place consolation`,
      })
    }

    // Generate new consolation rounds for newly eliminated players
    if (scheduleEntry.mainBracketRoundIndex !== null) {
      const resolvedRoundIndex = scheduleEntry.mainBracketRoundIndex
      const newConsolation = generateConsolationForRound(bracketState, resolvedRoundIndex)
      if (newConsolation.length > 0) {
        bracketState.consolationRounds.push(...newConsolation)
      }
    }

    // Rebuild schedule to include newly generated consolation rounds
    bracketState.schedule = buildSchedule(bracketState)

    // Advance currentScheduleIndex
    bracketState.currentScheduleIndex++

    return {
      bracketRound: resultBracketRound,
      matchups: resultMatchups.length > 0 ? resultMatchups : consolationMatchupsResolved,
      isComplete: isFullyComplete(bracketState),
      ...(consolationMatchupsResolved.length > 0 && { consolationMatchups: consolationMatchupsResolved }),
      ...(consolationContext.length > 0 && { consolationContext }),
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
 * Returns the current spectators — players NOT in an active matchup this round.
 * During main bracket rounds: eliminated + bye players.
 * During consolation: finalists + anyone not in a consolation matchup.
 */
export function getSpectators(): string[] {
  if (!bracketState) return []

  const allPlayerIds = Object.keys(bracketState.seeds)
  const activeCompetitors = new Set(getActiveCompetitors())

  // Spectators are everyone NOT actively competing
  return allPlayerIds.filter(id => !activeCompetitors.has(id))
}

/**
 * Returns the active competitors for the current schedule entry.
 * During main bracket rounds: players in the current round's matchups.
 * During consolation: players in the consolation matchups.
 */
export function getActiveCompetitors(): string[] {
  if (!bracketState) return []

  const scheduleEntry = bracketState.schedule[bracketState.currentScheduleIndex]
  if (!scheduleEntry) return []

  if (scheduleEntry.mainBracketRoundIndex !== null) {
    // Main bracket round
    const currentRound = bracketState.rounds[scheduleEntry.mainBracketRoundIndex]
    if (!currentRound) return []
    return currentRound.matchups.flatMap(m => [m.playerA, m.playerB]).filter(p => p !== "")
  } else {
    // Consolation round — active competitors are those in consolation matchups
    const competitors: string[] = []
    for (const cIdx of scheduleEntry.consolationRoundIndices) {
      const cRound = bracketState.consolationRounds[cIdx]
      if (cRound) {
        for (const matchup of cRound.matchups) {
          if (matchup.playerA) competitors.push(matchup.playerA)
          if (matchup.playerB) competitors.push(matchup.playerB)
        }
      }
    }
    return competitors
  }
}

// Register the plugin in the global GameRegistry
registry.register(playcallerPlugin)
