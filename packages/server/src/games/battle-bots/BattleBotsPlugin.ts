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
  FFABracketState,
  RobotVisual,
  CombatRobot,
  TickLogPayload,
  WeaponType,
  HeadType,
  BodyType,
} from "./types"
import { BATTLE_BOTS, BATTLE_BOTS_SETTINGS_SCHEMA } from "./constants"
import { ensureEvenParticipants, botPersonaSelectParts } from "./BotPersona"
import { createPairings } from "./simulation/PairingEngine"
import { simulate1v1, simulateFFA } from "./simulation/BattleEngine"
import type { BattleResult, FFAResult } from "./simulation/BattleEngine"
import { computeFinalRankings } from "./simulation/RankingEngine"
import type { ParticipantInfo } from "./simulation/RankingEngine"
import { filterBotPersonasFromLeaderboard, filterBotPersonasFromDeltas, computeEliminatedSurvivalPoints, computeSurvivorScore } from "./scoring-utils"
import { WIN_BONUS } from "./scoring-constants"
import { generateUniqueNames } from "./robotNames"
import { validateBuild, computeStars } from "./PartDefinitions"
import { deriveCombatStats } from "./ModifierTable"

/**
 * Result type for each round of the Battle Bots game.
 * Shape varies by round.
 */
export interface BattleBotsRoundResult {
  round: number
  [key: string]: unknown
}

// ── Valid part options for validation ──────────────────────────────────────

const VALID_WEAPONS: WeaponType[] = ["drill", "blaster", "bazooka"]
const VALID_HEADS: HeadType[] = ["square", "rounded", "triangular", "hexagonal"]
const VALID_BODIES: BodyType[] = ["square", "rounded", "triangular", "hexagonal"]

/** Color palette available for robot customization */
const ROBOT_COLORS = [
  "#e53935", // red
  "#1e88e5", // blue
  "#43a047", // green
  "#fb8c00", // orange
  "#8e24aa", // purple
  "#00acc1", // cyan
  "#f4511e", // deep orange
  "#7cb342", // light green
]

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
 * Selects random parts (one weapon, one head, one body) with uniform probability.
 * Used as the server-side fallback when a player doesn't lock in before timer expiry.
 * (Req 10.3: Timer expiry → select random option from each part category server-side)
 */
function selectRandomParts(): BattleBotsPick {
  return {
    weapon: VALID_WEAPONS[Math.floor(Math.random() * VALID_WEAPONS.length)],
    head: VALID_HEADS[Math.floor(Math.random() * VALID_HEADS.length)],
    body: VALID_BODIES[Math.floor(Math.random() * VALID_BODIES.length)],
    color: ROBOT_COLORS[Math.floor(Math.random() * ROBOT_COLORS.length)],
  }
}

/**
 * Constructs a CombatRobot from a validated build pick, owner ID, and name.
 */
function buildCombatRobot(pick: BattleBotsPick, ownerId: string, name: string): CombatRobot {
  const stars = computeStars(pick.weapon, pick.head, pick.body)
  const stats = deriveCombatStats(stars)

  const visual: RobotVisual = {
    weapon: pick.weapon,
    head: pick.head,
    body: pick.body,
    color: pick.color ?? ROBOT_COLORS[Math.floor(Math.random() * ROBOT_COLORS.length)],
  }

  return {
    ownerId,
    name,
    maxHit: stats.maxHit,
    accuracy: stats.accuracy,
    tickInterval: stats.tickInterval,
    currentHp: stats.hp,
    maxHp: stats.hp,
    stars,
    visual,
  }
}

// ── Round 1: Prep Phase ────────────────────────────────────────────────────

/**
 * Resolves Round 1 (Prep Phase):
 * 1. Determine participants (players + bot persona if needed)
 * 2. For each participant: use submitted pick or generate random parts
 * 3. Validate build, compute stars, derive combat stats
 * 4. Assign robot name via existing name generator
 * 5. Construct CombatRobot instances and store in gameState.builds
 *
 * Requirements: 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 15.1, 15.2, 15.3, 15.4
 */
function resolveRound1(
  picks: Record<string, BattleBotsPick>,
  _settings: GameSettings
): BattleBotsRoundResult {
  // Get player IDs from picks (everyone who joined the game round)
  const playerIds = Object.keys(picks)

  // Ensure even participant count — add bot persona if needed
  const botPersonas = ensureEvenParticipants(playerIds)
  const botPersonaIds = botPersonas.map((b) => b.id)
  const participants = [...playerIds, ...botPersonaIds]

  // Generate unique names for all participants (Req 15.1, 15.3)
  const names = generateUniqueNames(participants.length)

  // Build CombatRobot for each participant
  const builds: Record<string, CombatRobot> = {}

  for (let i = 0; i < participants.length; i++) {
    const participantId = participants[i]
    let pick: BattleBotsPick

    if (botPersonaIds.includes(participantId)) {
      // Bot persona: select parts with uniform probability (Req 10.4)
      pick = botPersonaSelectParts()
    } else {
      const submitted = picks[participantId]
      if (
        submitted &&
        typeof submitted.weapon === "string" && VALID_WEAPONS.includes(submitted.weapon) &&
        typeof submitted.head === "string" && VALID_HEADS.includes(submitted.head) &&
        typeof submitted.body === "string" && VALID_BODIES.includes(submitted.body)
      ) {
        // Player submitted a valid pick (Req 10.2: only final locked-in build transmitted)
        pick = submitted
      } else {
        // Player didn't pick or submitted invalid data — select random parts server-side (Req 10.3)
        pick = selectRandomParts()
      }
    }

    // Validate the build (should always pass for valid parts, guards against corruption)
    const validation = validateBuild(pick.weapon, pick.head, pick.body)
    if (!validation.valid) {
      // Fallback: generate random parts if somehow invalid
      pick = selectRandomParts()
    }

    // Construct CombatRobot with name, stars, and derived combat stats
    builds[participantId] = buildCombatRobot(pick, participantId, names[i])
  }

  // Store in module-level game state for use in subsequent rounds
  gameState = {
    participants,
    botPersonas,
    builds,
    pairings: [],
    winnersBracket: null,
    losersBracket: null,
    finalRankings: [],
  }

  return {
    round: 1,
    participants,
    botPersonas,
    builds,
  }
}

// ── Round 2: 1v1 Battles ───────────────────────────────────────────────────

/**
 * Resolves Round 2 (1v1 Battles):
 * 1. Create random pairings from participant IDs using PairingEngine
 * 2. For each pairing: call simulate1v1() with CombatRobot builds directly
 * 3. Store tick log and winner in BattlePairing state
 * 4. Produce TickLogPayload per pairing for client broadcast
 * 5. Store pairings in gameState
 *
 * Requirements: 7.1, 7.2, 7.3, 7.6, 7.7
 */
function resolveRound2(
  _picks: Record<string, BattleBotsPick>,
  settings: GameSettings
): BattleBotsRoundResult {
  if (!gameState) throw new Error("Cannot resolve Round 2 without Round 1 state")
  if (!gameState.builds) throw new Error("Cannot resolve Round 2 without builds")

  const gameSpeed = Number(settings.tuning.GAME_SPEED) || 100

  // Create pairings from participant IDs (no longer needs robot instances)
  const pairings = createPairings(gameState.participants)

  // Collect TickLogPayloads for client broadcast
  const tickLogPayloads: TickLogPayload[] = []

  // Run all 1v1 battles using the new BattleEngine directly with CombatRobot
  for (const pairing of pairings) {
    const robot1 = { ...gameState.builds[pairing.player1Id] }
    const robot2 = { ...gameState.builds[pairing.player2Id] }

    const result: BattleResult = simulate1v1(robot1, robot2)

    // Store results in pairing state
    pairing.winnerId = result.winnerId
    pairing.loserId = pairing.player1Id === result.winnerId
      ? pairing.player2Id
      : pairing.player1Id
    pairing.tickLog = result.tickLog

    // Build TickLogPayload for this pairing (Req 7.1, 7.2)
    const payload: TickLogPayload = {
      battleId: pairing.id,
      robots: [robot1, robot2].map((r) => ({
        ownerId: r.ownerId,
        name: r.name,
        stars: r.stars,
        visual: r.visual,
        maxHp: r.maxHp,
      })),
      tickLog: result.tickLog,
      gameSpeed,
    }
    tickLogPayloads.push(payload)
  }

  // Store pairings in game state for bracket creation in Round 3
  gameState.pairings = pairings

  return {
    round: 2,
    pairings,
    tickLogPayloads,
  }
}

// ── Round 3: Free-For-All ──────────────────────────────────────────────────

/**
 * Resolves Round 3 (Free-For-All):
 * 1. Create winners and losers brackets from Round 2 results
 * 2. Construct CombatRobot arrays with HP reset to maxHp
 * 3. Call simulateFFA() from BattleEngine for each bracket
 * 4. Store results using FFABracketState
 * 5. Call RankingEngine to compute final rankings
 * 6. Store brackets and rankings in gameState
 *
 * Requirements: 7.1, 7.2, 7.3, 7.6, 7.7, 17.4
 */
function resolveRound3(
  _picks: Record<string, BattleBotsPick>,
  settings: GameSettings
): BattleBotsRoundResult {
  if (!gameState) throw new Error("Cannot resolve Round 3 without previous state")
  if (gameState.pairings.length === 0) throw new Error("No pairings from Round 2")
  if (!gameState.builds) throw new Error("Cannot resolve Round 3 without builds")

  const gameSpeed = Number(settings.tuning.GAME_SPEED) || 100

  // Categorize winners and losers from Round 2 pairings
  const winnerIds: string[] = []
  const loserIds: string[] = []
  for (const pairing of gameState.pairings) {
    if (pairing.winnerId) {
      winnerIds.push(pairing.winnerId)
      // The loser is the other player
      const loserId = pairing.player1Id === pairing.winnerId
        ? pairing.player2Id
        : pairing.player1Id
      loserIds.push(loserId)
    }
  }

  // Build CombatRobot arrays with HP reset to maxHp for FFA
  const winnersRobots: CombatRobot[] = winnerIds.map((id) => {
    const build = gameState!.builds![id]
    return { ...build, currentHp: build.maxHp }
  })

  const losersRobots: CombatRobot[] = loserIds.map((id) => {
    const build = gameState!.builds![id]
    return { ...build, currentHp: build.maxHp }
  })

  // Run FFA simulations for both brackets using the new engine
  // Handle edge case: if a bracket has only 1 robot, skip FFA — they auto-win
  let winnersFFAResult: FFAResult | null = null
  let losersFFAResult: FFAResult | null = null

  if (winnersRobots.length > 1) {
    winnersFFAResult = simulateFFA(winnersRobots.map((r) => ({ ...r }))) as FFAResult
  }

  if (losersRobots.length > 1) {
    losersFFAResult = simulateFFA(losersRobots.map((r) => ({ ...r }))) as FFAResult
  }

  // Build FFABracketState objects
  const winnersBracket: FFABracketState = {
    id: "winners",
    participantIds: winnerIds,
    eliminationOrder: winnersFFAResult
      ? winnersFFAResult.eliminationOrder
      : [],
    survivorId: winnersFFAResult
      ? winnersFFAResult.survivorId
      : (winnerIds[0] ?? null),
    tickLog: winnersFFAResult ? winnersFFAResult.tickLog : [],
  }

  const losersBracket: FFABracketState = {
    id: "losers",
    participantIds: loserIds,
    eliminationOrder: losersFFAResult
      ? losersFFAResult.eliminationOrder
      : [],
    survivorId: losersFFAResult
      ? losersFFAResult.survivorId
      : (loserIds[0] ?? null),
    tickLog: losersFFAResult ? losersFFAResult.tickLog : [],
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

  // Compute final rankings from FFABracketState directly
  const finalRankings = computeFinalRankings(winnersBracket, losersBracket, participantInfo)

  // Build TickLogPayloads for FFA brackets
  const tickLogPayloads: TickLogPayload[] = []

  if (winnersFFAResult) {
    tickLogPayloads.push({
      battleId: "ffa-winners",
      robots: winnersRobots.map((r) => ({
        ownerId: r.ownerId,
        name: r.name,
        stars: r.stars,
        visual: r.visual,
        maxHp: r.maxHp,
      })),
      tickLog: winnersFFAResult.tickLog,
      gameSpeed,
    })
  }

  if (losersFFAResult) {
    tickLogPayloads.push({
      battleId: "ffa-losers",
      robots: losersRobots.map((r) => ({
        ownerId: r.ownerId,
        name: r.name,
        stars: r.stars,
        visual: r.visual,
        maxHp: r.maxHp,
      })),
      tickLog: losersFFAResult.tickLog,
      gameSpeed,
    })
  }

  // Store in game state
  gameState.winnersBracket = winnersBracket
  gameState.losersBracket = losersBracket
  gameState.finalRankings = finalRankings

  return {
    round: 3,
    winnersBracket,
    losersBracket,
    finalRankings,
    tickLogPayloads,
  }
}

// ── Plugin Implementation ──────────────────────────────────────────────────

/**
 * Battle Bots game plugin — 3-round robot combat game.
 * Round 1: Prep (robot building via part selection)
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
    return (
      typeof p.weapon === "string" && VALID_WEAPONS.includes(p.weapon as WeaponType) &&
      typeof p.head === "string" && VALID_HEADS.includes(p.head as HeadType) &&
      typeof p.body === "string" && VALID_BODIES.includes(p.body as BodyType)
    )
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
        // Winners receive WIN_BONUS points, losers receive 0 — exclude bot personas
        const deltas: Record<string, number> = {}
        for (const pairing of gameState.pairings) {
          if (pairing.winnerId) {
            deltas[pairing.winnerId] = WIN_BONUS
            // The loser is the other player
            const loserId = pairing.player1Id === pairing.winnerId
              ? pairing.player2Id
              : pairing.player1Id
            deltas[loserId] = 0
          }
        }
        return { deltas: filterBotPersonasFromDeltas(deltas, botPersonaIds) }
      }

      case 3: {
        const deltas: Record<string, number> = {}

        // Process both brackets (winners and losers)
        for (const bracket of [gameState.winnersBracket, gameState.losersBracket]) {
          if (!bracket) continue
          const ffaBracket = bracket as FFABracketState

          // Total_Ticks = tick of the final elimination in this bracket
          const totalTicks = ffaBracket.eliminationOrder.length > 0
            ? ffaBracket.eliminationOrder[ffaBracket.eliminationOrder.length - 1].eliminatedOnTick
            : 0

          // Score eliminated players
          for (const elimination of ffaBracket.eliminationOrder) {
            if (!botPersonaIds.has(elimination.ownerId)) {
              deltas[elimination.ownerId] = computeEliminatedSurvivalPoints(
                elimination.eliminatedOnTick,
                totalTicks
              )
            }
          }

          // Score survivor
          if (ffaBracket.survivorId && !botPersonaIds.has(ffaBracket.survivorId)) {
            deltas[ffaBracket.survivorId] = computeSurvivorScore()
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

    // After Round 3: update finalRankings with actual cumulative scores and re-rank
    const botPersonaIds = new Set(gameState.botPersonas.map((b) => b.id))

    // Inject cumulative scores into the existing finalRankings array entries
    for (const r of gameState.finalRankings) {
      r.score = gameScores[r.playerId] ?? 0
    }

    // Sort in-place by score descending
    gameState.finalRankings.sort((a, b) => b.score - a.score)

    // Re-assign ranks (tied scores share rank)
    for (let i = 0; i < gameState.finalRankings.length; i++) {
      if (i === 0) {
        gameState.finalRankings[i].rank = 1
      } else if (gameState.finalRankings[i].score === gameState.finalRankings[i - 1].score) {
        gameState.finalRankings[i].rank = gameState.finalRankings[i - 1].rank
      } else {
        gameState.finalRankings[i].rank = i + 1
      }
    }

    // Build leaderboard from finalRankings, excluding bot personas
    const leaderboard: GameLeaderboardEntry[] = gameState.finalRankings
      .filter((r) => !r.isBot)
      .map((r) => {
        // Find player name from players array
        const player = players.find((p) => p.id === r.playerId)
        return {
          playerId: r.playerId,
          playerName: player?.name ?? r.playerName,
          score: r.score,
          rank: r.rank,
        }
      })
      .sort((a, b) => a.rank - b.rank)

    return filterBotPersonasFromLeaderboard(leaderboard, botPersonaIds)
  },

}
