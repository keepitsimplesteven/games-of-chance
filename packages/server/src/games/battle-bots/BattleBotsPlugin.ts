import type {
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  GameSettings,
} from "@games-of-chance/shared"
import type { GamePlugin } from "../GamePlugin"
import type {
  BattleBotsPick,
  BattleBotsGameState,
  BattlePairing,
  FFABracket,
  FinalRanking,
  RobotTemplate,
  RobotInstance,
  RobotOptions,
} from "./types"
import { BATTLE_BOTS, BATTLE_BOTS_SETTINGS_SCHEMA } from "./constants"
import { ensureEvenParticipants, botPersonaSelectRobot } from "./BotPersona"
import { createPairings } from "./simulation/PairingEngine"
import { simulateBattle1v1, simulateFFA } from "./simulation/BattleEngine"
import { computeFinalRankings } from "./simulation/RankingEngine"
import type { ParticipantInfo } from "./simulation/RankingEngine"
import { filterBotPersonasFromLeaderboard, filterBotPersonasFromDeltas } from "./scoring-utils"

/**
 * Result type for each round of the Battle Bots game.
 * Shape varies by round.
 */
export interface BattleBotsRoundResult {
  round: number
  [key: string]: unknown
}

// ── Module-level game state ────────────────────────────────────────────────

/** Module-level state for the current game (reset on new game or game end) */
let gameState: BattleBotsGameState | null = null

/** Internal round counter — increments each time resolveRound is called */
let currentRound = 0

/**
 * Resets the module-level game state. Called when a game ends or for testing.
 */
export function resetGameState(): void {
  gameState = null
  currentRound = 0
}

/**
 * Returns the current game state (read-only access for testing and other modules).
 */
export function getGameState(): BattleBotsGameState | null {
  return gameState
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates the robot template collection from active game settings.
 * V1: returns 3 templates with identical stats but different names/visuals.
 */
export function getRobotTemplates(settings: GameSettings): RobotTemplate[] {
  const hp = Number(settings.tuning.BOT_HP) || BATTLE_BOTS.BOT_HP
  const accuracy = Number(settings.tuning.ACCURACY) || BATTLE_BOTS.ACCURACY
  const damageMin = Number(settings.tuning.DAMAGE_MIN) || BATTLE_BOTS.DAMAGE_MIN
  const damageMax = Number(settings.tuning.DAMAGE_MAX) || BATTLE_BOTS.DAMAGE_MAX

  return [
    { id: "bot-alpha", name: "Iron Crusher", hp, accuracy, damageMin, damageMax, visualId: "robot-1" },
    { id: "bot-beta", name: "Steel Viper", hp, accuracy, damageMin, damageMax, visualId: "robot-2" },
    { id: "bot-gamma", name: "Chrome Fang", hp, accuracy, damageMin, damageMax, visualId: "robot-3" },
  ]
}

/**
 * Creates a RobotInstance from a selected template, assigned to a specific owner.
 */
function createRobotInstance(template: RobotTemplate, ownerId: string): RobotInstance {
  return {
    templateId: template.id,
    ownerId,
    currentHp: template.hp,
    maxHp: template.hp,
    accuracy: template.accuracy,
    damageMin: template.damageMin,
    damageMax: template.damageMax,
  }
}

// ── Round 1: Prep Phase ────────────────────────────────────────────────────

/**
 * Resolves Round 1 (Prep Phase):
 * 1. Determine participants (players + bot persona if needed)
 * 2. Generate 3 robot options per participant
 * 3. Finalize selections: use player's pick or randomly assign one of their options
 * 4. Create RobotInstance for each participant
 * 5. Store everything in gameState
 */
function resolveRound1(
  picks: Record<string, BattleBotsPick>,
  settings: GameSettings
): BattleBotsRoundResult {
  // Get player IDs from picks (everyone who joined the game round)
  const playerIds = Object.keys(picks)

  // Ensure even participant count — add bot persona if needed
  const botPersonas = ensureEvenParticipants(playerIds)
  const botPersonaIds = botPersonas.map((b) => b.id)
  const participants = [...playerIds, ...botPersonaIds]

  // Generate robot templates from settings
  const templates = getRobotTemplates(settings)

  // Generate 3 robot options per participant
  const robotOptions: Record<string, RobotOptions> = {}
  for (const participantId of participants) {
    robotOptions[participantId] = {
      playerId: participantId,
      options: [...templates], // All 3 options (V1: same stats, different visuals)
    }
  }

  // Finalize robot selections
  const selectedRobots: Record<string, RobotInstance> = {}

  for (const participantId of participants) {
    const options = robotOptions[participantId].options
    let selectedTemplate: RobotTemplate

    // Check if this is a bot persona — auto-select
    if (botPersonaIds.includes(participantId)) {
      const selectedId = botPersonaSelectRobot(options)
      selectedTemplate = options.find((t) => t.id === selectedId) ?? options[0]
    }
    // Check if player submitted a valid pick
    else if (picks[participantId]?.robotTemplateId) {
      const pickedId = picks[participantId].robotTemplateId
      const found = options.find((t) => t.id === pickedId)
      // Use picked template if valid, otherwise random assign
      selectedTemplate = found ?? options[Math.floor(Math.random() * options.length)]
    }
    // Player didn't pick — randomly assign
    else {
      selectedTemplate = options[Math.floor(Math.random() * options.length)]
    }

    selectedRobots[participantId] = createRobotInstance(selectedTemplate, participantId)
  }

  // Store in module-level game state for use in subsequent rounds
  gameState = {
    participants,
    botPersonas,
    robotOptions,
    selectedRobots,
    pairings: [],
    winnersBracket: null,
    losersBracket: null,
    finalRankings: [],
  }

  return {
    round: 1,
    participants,
    botPersonas,
    robotOptions,
    selectedRobots,
  }
}

// ── Round 2: 1v1 Battles ───────────────────────────────────────────────────

/**
 * Resolves Round 2 (1v1 Battles):
 * 1. Create random pairings from participants using PairingEngine
 * 2. Clone robot instances to avoid mutating the originals
 * 3. Run all 1v1 battles via BattleEngine
 * 4. Categorize winners and losers for bracket assignment in Round 3
 * 5. Store pairings in gameState
 */
function resolveRound2(
  _picks: Record<string, BattleBotsPick>,
  _settings: GameSettings
): BattleBotsRoundResult {
  if (!gameState) throw new Error("Cannot resolve Round 2 without Round 1 state")

  // Create pairings from participants using their selected robots
  const pairings = createPairings(gameState.participants, gameState.selectedRobots)

  // Run all 1v1 battles
  for (const pairing of pairings) {
    // Clone robots so we don't mutate the original selectedRobots
    const robot1: RobotInstance = { ...pairing.robot1 }
    const robot2: RobotInstance = { ...pairing.robot2 }

    const result = simulateBattle1v1(robot1, robot2)
    pairing.winnerId = result.winnerId
    pairing.loserId = result.loserId
    pairing.tickLog = result.tickLog
  }

  // Store pairings in game state for bracket creation in Round 3
  gameState.pairings = pairings

  return {
    round: 2,
    pairings,
  }
}

// ── Round 3: Free-For-All ──────────────────────────────────────────────────

/**
 * Resolves Round 3 (Free-For-All):
 * 1. Create winners and losers FFA brackets from Round 2 results
 * 2. Reset all robots to full HP for fairness
 * 3. Run both FFA brackets via BattleEngine
 * 4. Call RankingEngine to compute final rankings from elimination order
 * 5. Store brackets and rankings in gameState
 */
function resolveRound3(
  _picks: Record<string, BattleBotsPick>,
  settings: GameSettings
): BattleBotsRoundResult {
  if (!gameState) throw new Error("Cannot resolve Round 3 without previous state")
  if (gameState.pairings.length === 0) throw new Error("No pairings from Round 2")

  // Categorize winners and losers from Round 2 pairings
  const winnerIds = gameState.pairings
    .map((p) => p.winnerId)
    .filter((id): id is string => id !== null)
  const loserIds = gameState.pairings
    .map((p) => p.loserId)
    .filter((id): id is string => id !== null)

  // Reset HP to full for FFA fairness
  const hp = Number(settings.tuning.BOT_HP) || BATTLE_BOTS.BOT_HP

  // Create robot instances for winners bracket — reset HP to full
  const winnersRobots: RobotInstance[] = winnerIds.map((id) => ({
    ...gameState!.selectedRobots[id],
    currentHp: hp,
    maxHp: hp,
  }))

  // Create robot instances for losers bracket — reset HP to full
  const losersRobots: RobotInstance[] = loserIds.map((id) => ({
    ...gameState!.selectedRobots[id],
    currentHp: hp,
    maxHp: hp,
  }))

  // Run FFA simulations for both brackets
  // Handle edge case: if a bracket has only 1 robot, skip FFA — they auto-win
  const winnersResult =
    winnersRobots.length > 1
      ? simulateFFA([...winnersRobots.map((r) => ({ ...r }))])
      : { eliminationOrder: [winnersRobots[0].ownerId], tickLog: [] }

  const losersResult =
    losersRobots.length > 1
      ? simulateFFA([...losersRobots.map((r) => ({ ...r }))])
      : { eliminationOrder: [losersRobots[0].ownerId], tickLog: [] }

  // Build bracket objects
  const winnersBracket: FFABracket = {
    id: "winners",
    participants: winnersRobots,
    eliminationOrder: winnersResult.eliminationOrder,
    tickLog: winnersResult.tickLog,
  }

  const losersBracket: FFABracket = {
    id: "losers",
    participants: losersRobots,
    eliminationOrder: losersResult.eliminationOrder,
    tickLog: losersResult.tickLog,
  }

  // Build participant info map for ranking engine
  const participantInfo = new Map<string, ParticipantInfo>()
  for (const id of gameState.participants) {
    const isBot = gameState.botPersonas.some((b) => b.id === id)
    const name = isBot
      ? gameState.botPersonas.find((b) => b.id === id)!.name
      : id
    participantInfo.set(id, { name, isBot })
  }

  // Compute final rankings from elimination order
  const finalRankings = computeFinalRankings(winnersBracket, losersBracket, participantInfo)

  // Store in game state
  gameState.winnersBracket = winnersBracket
  gameState.losersBracket = losersBracket
  gameState.finalRankings = finalRankings

  return {
    round: 3,
    winnersBracket,
    losersBracket,
    finalRankings,
  }
}

// ── Plugin Implementation ──────────────────────────────────────────────────

/**
 * Battle Bots game plugin — 3-round robot combat game.
 * Round 1: Prep (robot selection)
 * Round 2: 1v1 battles
 * Round 3: Free-for-all elimination
 */
export const battleBotsPlugin: GamePlugin<BattleBotsPick, BattleBotsRoundResult> = {
  gameType: "battle-bots",

  settingsSchema: BATTLE_BOTS_SETTINGS_SCHEMA,

  pickWindowMs: BATTLE_BOTS.PICK_WINDOW_MS,

  validatePick(pick: unknown): pick is BattleBotsPick {
    if (!pick || typeof pick !== "object") return false
    const p = pick as Record<string, unknown>
    if (typeof p.robotTemplateId !== "string" || p.robotTemplateId.length === 0) return false

    // Cross-reference against player's assigned options if game state exists
    // (validation happens during PICKING phase when gameState.robotOptions is populated)
    // Note: we can't validate the specific player's options here because validatePick
    // doesn't receive the player ID. The cross-reference check is handled in resolveRound.
    return true
  },

  resolveRound(
    picks: Record<string, BattleBotsPick>,
    settings: GameSettings
  ): BattleBotsRoundResult {
    currentRound++

    switch (currentRound) {
      case 1:
        return resolveRound1(picks, settings)
      case 2:
        return resolveRound2(picks, settings)
      case 3:
        return resolveRound3(picks, settings)
      default:
        return { round: currentRound }
    }
  },

  scoreRound(
    _picks: Record<string, BattleBotsPick>,
    result: BattleBotsRoundResult,
    _players: Player[],
    _settings: GameSettings
  ): RoundScoreResult {
    if (!gameState) return { deltas: {} }

    const botPersonaIds = new Set(gameState.botPersonas.map((b) => b.id))

    switch (result.round) {
      case 1:
        // No scoring in prep phase
        return { deltas: {} }

      case 2: {
        // 1 point for winners, 0 for losers — exclude bot personas
        const deltas: Record<string, number> = {}
        for (const pairing of gameState.pairings) {
          if (pairing.winnerId) {
            deltas[pairing.winnerId] = 1
          }
          if (pairing.loserId) {
            deltas[pairing.loserId] = 0
          }
        }
        return { deltas: filterBotPersonasFromDeltas(deltas, botPersonaIds) }
      }

      case 3: {
        // Ranking-based scoring — exclude bot personas
        // Points = totalParticipants - rank (higher rank = more points)
        const deltas: Record<string, number> = {}
        const totalParticipants = gameState.participants.length

        for (const ranking of gameState.finalRankings) {
          if (!ranking.isBot) {
            deltas[ranking.playerId] = totalParticipants - ranking.rank
          }
        }
        return { deltas: filterBotPersonasFromDeltas(deltas, botPersonaIds) }
      }

      default:
        return { deltas: {} }
    }
  },

  computeGameLeaderboard(
    players: Player[],
    gameScores: Record<string, number>
  ): GameLeaderboardEntry[] {
    if (!gameState || gameState.finalRankings.length === 0) {
      // Before Round 3 completes, return score-based leaderboard
      return players
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          score: gameScores[p.id] ?? 0,
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry, i) => ({ ...entry, rank: i + 1 }))
    }

    // After Round 3: use finalRankings
    const botPersonaIds = new Set(gameState.botPersonas.map((b) => b.id))
    const totalParticipants = gameState.participants.length

    // Build leaderboard from finalRankings, excluding bot personas
    const leaderboard: GameLeaderboardEntry[] = gameState.finalRankings
      .filter((r) => !r.isBot)
      .map((r) => {
        // Find player name from players array
        const player = players.find((p) => p.id === r.playerId)
        return {
          playerId: r.playerId,
          playerName: player?.name ?? r.playerName,
          score: totalParticipants - r.rank,
          rank: r.rank,
        }
      })
      .sort((a, b) => a.rank - b.rank)

    return filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)
  },

  /** Battle Bots is the tournament finale */
  isFinale: true,
}
