import { Server, type Connection, routePartykitRequest } from "partyserver"
import type {
  ClientMessage,
  ServerMessage,
  Player,
  RoomConfig,
  RoomState,
  RoundState,
  GameLeaderboardEntry,
  SessionLeaderboardEntry,
  AdjustmentLogEntry,
  GameSettings,
  BattleTickUpdate,
  BattleHPSnapshot,
  BigWheelGameState,
  BigWheelSpinResult,
  PlaycallerGameState,
  TournamentProgress,
  ProgressionMode,
} from "@games-of-chance/shared"
import { registry } from "./games/GameRegistry"
import { getStrategy } from "./scoring"
import { COIN_TOSS } from "./games/coin-toss/constants"
import { BATTLE_BOTS } from "./games/battle-bots/constants"
import { BIG_WHEEL } from "./games/big-wheel/constants"
import { getRobotTemplates, resetGameState as resetBattleBotsState } from "./games/battle-bots/BattleBotsPlugin"
import { resetCoinTossStreakState, getCoinTossGameState } from "./games/coin-toss/CoinTossPlugin"
import {
  getBigWheelState,
  setBigWheelState,
  resetBigWheelState,
} from "./games/big-wheel/BigWheelPlugin"
import { generateBracket, isComplete } from "./games/playcaller/BracketEngine"
import { setPlaycallerState, resetPlaycallerState, getPlaycallerState, getSpectators, getActiveCompetitors, getDriveStates, initializeDrives, resetDriveStates } from "./games/playcaller/PlaycallerPlugin"
import { PLAYCALLER } from "./games/playcaller/constants"
import {
  handlePlaySelection as handlePlaySelectionFn,
  beginPlaycallerDown as beginPlaycallerDownFn,
  schedulePlaycallerBotPicks as schedulePlaycallerBotPicksFn,
  resolvePlaycallerTimeout as resolvePlaycallerTimeoutFn,
  advancePlaycallerBracket as advancePlaycallerBracketFn,
  type PlaycallerRoomContext,
} from "./games/playcaller/roomHandlers"
import { determineSpinOrder } from "./games/big-wheel/spinOrder"
import {
  handleDisconnection as handleBigWheelDisconnection,
  resolveDisconnectedTurn,
  isPlayerDisconnected,
} from "./games/big-wheel/disconnection"
// Side-effect import: registers the coin-toss plugin in the global registry
import "./games/coin-toss/CoinTossPlugin"
// Side-effect import: registers the battle-bots plugin in the global registry
import "./games/battle-bots/index"
// Side-effect import: registers the big-wheel plugin in the global registry
import "./games/big-wheel/BigWheelPlugin"
// Side-effect import: registers the playcaller plugin in the global registry
import "./games/playcaller/PlaycallerPlugin"
import { validateSettingsUpdate } from "./settings/validateSettings"
import { evaluateAvailability } from "./tournament/UnlockCriteriaHarness"
import { FastPlayAdapter } from "./simulation/FastPlayAdapter"
import { BotManager } from "./bots/BotManager"
// Side-effect import: registers coin-toss pick generator in the simulation registry
import "@games-of-chance/simulation/src/pick-generators/coin-toss"

// ── Server-side live state (not sent to clients directly) ──────────────────

interface LiveRoomState {
  config: RoomConfig
  players: Record<string, Player>
  round: RoundState
  gameScores: Record<string, number>
  gameLeaderboard: GameLeaderboardEntry[]
  sessionScores: Record<string, number>
  sessionGamesPlayed: Record<string, number>
  sessionLeaderboard: SessionLeaderboardEntry[]
  adjustmentLog: AdjustmentLogEntry[]
  /** Resolved game settings (shared + tuning) */
  gameSettings: GameSettings
  /** Whether settings are locked (game in progress) */
  settingsLocked: boolean
  /** Plugin-specific state for multi-round games */
  pluginState: Record<string, unknown>
  /** Game votes — gameType → set of player IDs who voted for it */
  gameVotes: Record<string, string[]>
  /** Tournament progress — only tracked when progressionMode is "tournament" */
  tournamentProgress: TournamentProgress | null
}

// ── Default configuration ──────────────────────────────────────────────────

function createDefaultConfig(roomId: string): RoomConfig {
  return {
    roomId,
    gameType: "coin-toss",
    maxPlayers: 10,
    scoringMode: "grand-prix",
    autoMode: false,
    autoRoundIntervalMs: 5000,
    placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
    roomSize: 4,
    progressionMode: "endless",
  }
}

function createDefaultRoundState(): RoundState {
  return {
    phase: "LOBBY",
    roundNumber: 0,
    pickDeadlineMs: null,
    picks: {},
    result: null,
    resolvedAt: null,
  }
}

/**
 * Build default GameSettings from the active plugin.
 * Reads the plugin's constants (MAX_ROUNDS, pickWindowMs) and its settingsSchema
 * to populate the tuning defaults.
 */
function buildDefaultGameSettings(gameType: string): GameSettings {
  const plugin = registry.lookup(gameType)

  const tuning: Record<string, number | boolean | string> = {}
  if (plugin.settingsSchema) {
    for (const field of plugin.settingsSchema) {
      tuning[field.key] = field.defaultValue
    }
  }

  // Use game-specific round count: battle-bots always uses 3 rounds
  // big-wheel round count equals number of players, determined at game launch
  // playcaller round count equals bracket totalRounds, determined at game launch
  let roundCount: number
  if (gameType === "battle-bots") {
    roundCount = BATTLE_BOTS.ROUND_COUNT
  } else if (gameType === "big-wheel") {
    // Placeholder — actual round count set dynamically at game launch (equals player count)
    roundCount = 0
  } else if (gameType === "playcaller") {
    // Placeholder — actual round count set dynamically at game launch (equals bracket totalRounds)
    roundCount = 0
  } else {
    roundCount = COIN_TOSS.MAX_ROUNDS
  }

  return {
    roundCount,
    pickWindowMs: plugin.pickWindowMs,
    tuning,
    theme: "retro-casino",
  }
}

// ── Room Server ────────────────────────────────────────────────────────────

export class GameRoom extends Server {
  private state!: LiveRoomState
  private deadlineTimerId: ReturnType<typeof setTimeout> | null = null
  private simulationAdapter: FastPlayAdapter | null = null
  private tickReplayTimerId: ReturnType<typeof setTimeout> | null = null
  /** Holds the round result during async tick replay so SKIP_ANIMATION can finalize it */
  private pendingResolveResult: unknown = null
  private botManager: BotManager = new BotManager()
  private botPickTimerIds: ReturnType<typeof setTimeout>[] = []

  async onStart() {
    // Initialize state on cold start
    this.state = {
      config: createDefaultConfig(this.name),
      players: {},
      round: createDefaultRoundState(),
      gameScores: {},
      gameLeaderboard: [],
      sessionScores: {},
      sessionGamesPlayed: {},
      sessionLeaderboard: [],
      adjustmentLog: [],
      gameSettings: buildDefaultGameSettings("coin-toss"),
      settingsLocked: false,
      pluginState: {},
      gameVotes: {},
      tournamentProgress: null,
    }
  }

  async onConnect(connection: Connection) {
    // Send full STATE_SYNC to the newly connected client
    const msg: ServerMessage = {
      type: "STATE_SYNC",
      payload: this.getPublicState(),
    }
    connection.send(JSON.stringify(msg))
  }

  async onMessage(sender: Connection, message: string | ArrayBuffer) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message as string) as ClientMessage
    } catch {
      this.sendError(sender, "INVALID_MESSAGE", "Could not parse message")
      return
    }

    switch (msg.type) {
      case "JOIN":
        this.handleJoin(sender, msg.payload)
        break
      case "START_ROUND":
        this.handleStartRound(sender)
        break
      case "SUBMIT_PICK":
        this.handleSubmitPick(sender, msg.payload)
        break
      case "END_GAME":
        this.handleEndGame(sender)
        break
      case "SKIP_ANIMATION":
        this.handleSkipAnimation(sender)
        break
      case "START_SIMULATION":
        this.handleStartSimulation(sender, msg.payload)
        break
      case "STOP_SIMULATION":
        this.handleStopSimulation(sender)
        break
      case "KICK_PLAYER":
        this.handleKickPlayer(sender, msg.payload)
        break
      case "REASSIGN_HOST":
        this.handleReassignHost(sender, msg.payload)
        break
      case "ADJUST_SCORE":
        this.handleAdjustScore(sender, msg.payload)
        break
      case "UPDATE_SETTINGS":
        this.handleUpdateSettings(sender, msg.payload)
        break
      case "SET_GAME_TYPE":
        this.handleGameTypeChange(sender, msg.payload)
        break
      case "UPDATE_ROOM_SIZE":
        this.handleUpdateRoomSize(sender, msg.payload)
        break
      case "RETURN_TO_LOBBY":
        this.handleReturnToLobby(sender)
        break
      case "VOTE_GAME":
        this.handleVoteGame(sender, msg.payload)
        break
      case "PLAY_SELECTION":
        this.handlePlaySelection(sender, msg.payload)
        break
      default:
        this.sendError(
          sender,
          "UNSUPPORTED",
          `Message type "${msg.type}" is not supported yet`
        )
        break
    }
  }

  async onClose(connection: Connection, code?: number, reason?: string, wasClean?: boolean) {
    // Find player by connection id
    const player = Object.values(this.state.players).find(
      (p) => p.connectionId === connection.id
    )
    if (!player) return

    // Mark disconnected
    player.connected = false
    player.connectionId = null

    // If the disconnected player was the host, promote another connected human player.
    // Bots must NEVER become host — if no humans remain, there is no host.
    if (player.role === "host") {
      player.role = "player"
      const nextHost = Object.values(this.state.players).find(
        (p) => p.connected && p.id !== player.id && !this.botManager.isBot(p.id)
      )
      if (nextHost) {
        nextHost.role = "host"
      } else if (this.state.round.phase === "PICKING") {
        // Host disconnected during PICKING and no new host available — suspend timer
        this.cancelDeadlineTimer()
      }
      // If no humans remain, no one is host. First human to rejoin becomes host.
    }

    // Remove the disconnected player from the roster so a bot can replace them
    delete this.state.players[player.id]

    // ── Big Wheel: handle disconnection ───────────────────────────────────
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        handleBigWheelDisconnection(player.id)

        // If the active spinner disconnected during PICKING, auto-resolve their turn
        const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
        if (player.id === activeSpinnerId && this.state.round.phase === "PICKING") {
          this.cancelDeadlineTimer()
          // Auto-resolve by triggering resolveRound (the pick will be auto-assigned)
          this.scheduleResolve(0)
        }
      }
    }

    // Disconnection during PICKING: if all remaining connected players have submitted picks,
    // cancel deadline timer and proceed to immediate resolution.
    // Note: disconnected player's pick is retained for scoring if already recorded.
    if (
      this.state.round.phase === "PICKING" &&
      this.allConnectedPlayersHavePicked()
    ) {
      this.cancelDeadlineTimer()
      this.broadcastState()
      // Reconcile bots after a human disconnects (add a bot to replace the human)
      this.reconcileBots()
      this.scheduleResolve(0)
      return
    }

    this.broadcastState()

    // Reconcile bots after a human disconnects (add a bot to replace the human)
    this.reconcileBots()
  }

  // ── Message handlers ───────────────────────────────────────────────────

  private handleJoin(
    connection: Connection,
    payload: { name: string; role: "host" | "player"; clientId: string; scoringMode?: "grand-prix" | "chips"; roomSize?: number; progressionMode?: ProgressionMode }
  ) {
    const playerCount = Object.keys(this.state.players).length

    // Reject if at capacity: when all slots are filled by humans (no bots to remove)
    const botCount = Object.keys(this.state.players).filter(id => this.botManager.isBot(id)).length
    const humanCount = playerCount - botCount
    if (humanCount >= this.state.config.roomSize) {
      this.sendError(connection, "ROOM_FULL", "Room is at maximum capacity")
      return
    }

    // Use the client-generated stable ID as the player identity
    const stableId = payload.clientId

    // Determine role
    let role: "host" | "player" = "player"

    if (playerCount === 0) {
      // First player always gets host
      role = "host"
    } else if (!this.hasConnectedHost()) {
      // No current host (all humans left, only bots remain) — this human becomes host
      role = "host"
    } else {
      // Demote duplicate host attempts to player
      role = "player"
    }

    // If this is the first player (host) and they provided a scoring mode, apply it
    if (role === "host" && payload.scoringMode) {
      this.state.config.scoringMode = payload.scoringMode
    }

    // If this is the host creating the room and they provided a room size, apply it
    if (role === "host" && payload.roomSize && Number.isInteger(payload.roomSize) && payload.roomSize >= 2 && payload.roomSize <= 10) {
      this.state.config.roomSize = payload.roomSize
    }

    // If this is the host creating the room and they provided a progression mode, apply it
    if (role === "host" && payload.progressionMode) {
      this.state.config.progressionMode = payload.progressionMode
    }

    // Initialize tournament progress for the host when in tournament mode
    if (role === "host" && this.state.config.progressionMode === "tournament" && !this.state.tournamentProgress) {
      this.state.tournamentProgress = {
        completedGames: [],
        availability: evaluateAvailability({ completedGames: [], availability: {} }),
      }
    } else if (role === "host" && this.state.config.progressionMode === "endless") {
      this.state.tournamentProgress = null
    }

    // Create the player
    const player: Player = {
      id: stableId,
      name: payload.name,
      role,
      connected: true,
      connectionId: connection.id,
    }

    this.state.players[stableId] = player

    // Initialize scores for new player
    if (!(stableId in this.state.gameScores)) {
      this.state.gameScores[stableId] = 0
    }
    if (!(stableId in this.state.sessionScores)) {
      this.state.sessionScores[stableId] = 0
    }
    if (!(stableId in this.state.sessionGamesPlayed)) {
      this.state.sessionGamesPlayed[stableId] = 0
    }

    this.broadcastState()

    // Reconcile bots after a human joins (remove a bot to make room)
    this.reconcileBots()
  }

  private handleStartRound(sender: Connection) {
    // Authorization: host can always start a round. For Big Wheel, the active spinner can too.
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    let authorized = senderId === hostId
    if (!authorized && this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
        authorized = senderId === activeSpinnerId
      }
    }

    if (!authorized) {
      this.sendError(sender, "NOT_HOST", "Only the host or active spinner can advance the round")
      return
    }

    // Tournament terminal state guard
    if (this.state.round.phase === "END_TOURNAMENT") {
      this.sendError(sender, "TOURNAMENT_ENDED", "The tournament has concluded")
      return
    }

    // Phase guard: can only start from LOBBY or RESULT
    if (
      this.state.round.phase !== "LOBBY" &&
      this.state.round.phase !== "RESULT"
    ) {
      this.sendError(
        sender,
        "WRONG_PHASE",
        "Cannot start round in current phase"
      )
      return
    }

    // Playcaller: advance to next bracket round when SKIP_GAMEPLAY is false
    if (
      this.state.config.gameType === "playcaller" &&
      this.state.round.phase === "RESULT" &&
      this.state.gameSettings.tuning?.SKIP_GAMEPLAY === false
    ) {
      const bracket = getPlaycallerState()!
      if (!isComplete(bracket)) {
        const currentRound = bracket.rounds[bracket.currentRoundIndex]
        initializeDrives(currentRound.matchups)
        this.state.round.roundNumber++
        this.beginPlaycallerDown()
        return
      } else {
        // Bracket is fully complete — end the game
        this.autoEndGame()
        return
      }
    }

    // If the last round just completed, transition to END_GAME instead of starting a new round
    // (Big Wheel manages its own game end — skip this check for big-wheel)
    const maxRounds = this.getMaxRounds()
    if (
      this.state.config.gameType !== "big-wheel" &&
      this.state.round.phase === "RESULT" &&
      maxRounds > 0 &&
      this.state.round.roundNumber >= maxRounds
    ) {
      this.autoEndGame()
      return
    }

    // Big Wheel: advance turn index after spin 2 before starting next round
    if (this.state.config.gameType === "big-wheel" && this.state.round.phase === "RESULT") {
      const bwState = getBigWheelState()
      if (bwState) {
        // Use the round result to determine what just happened
        const lastResult = this.state.round.result as BigWheelSpinResult | null
        if (lastResult && lastResult.spinNumber === 2) {
          // Spin 2 just completed — advance to next player
          bwState.currentTurnIndex++
          bwState.currentSpinNumber = 1

          // Check if all players are done
          if (bwState.currentTurnIndex >= bwState.spinOrder.length) {
            this.finalizeBigWheelGame()
            return
          }
        }
        // If spinNumber === 1, we're advancing from spin 1 to spin 2 (same player)
        // currentSpinNumber is already set to 2 by resolveRound
      }
    }

    this.beginRound()
  }

  private handleSubmitPick(
    sender: Connection,
    payload: { pick: unknown }
  ) {
    // Guard: reject if not in PICKING phase
    if (this.state.round.phase !== "PICKING") {
      this.sendError(
        sender,
        "WRONG_PHASE",
        "Picks are only accepted during the PICKING phase"
      )
      return
    }

    // Guard: reject if deadline has passed
    if (
      this.state.round.pickDeadlineMs !== null &&
      Date.now() > this.state.round.pickDeadlineMs
    ) {
      this.sendError(
        sender,
        "DEADLINE_PASSED",
        "The pick deadline has passed"
      )
      return
    }

    // Get the player ID for this connection
    const playerId = this.getPlayerIdByConnectionId(sender.id)
    if (!playerId) {
      this.sendError(sender, "NOT_IN_ROOM", "Player not found in room")
      return
    }

    // ── Big Wheel: only the active spinner can submit a pick ──────────────
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
        if (playerId !== activeSpinnerId) {
          this.sendError(sender, "NOT_ACTIVE_SPINNER", "Only the active spinner can submit a pick")
          return
        }
      }
    }

    // ── Playcaller drive mode: route play selections to drive handler ─────
    if (
      this.state.config.gameType === "playcaller" &&
      getDriveStates() !== null &&
      payload.pick &&
      typeof payload.pick === "object" &&
      (payload.pick as any).type === "play_selection"
    ) {
      const { matchupId, play } = payload.pick as { type: string; matchupId: string; play: string }
      this.handlePlaySelection(sender, { matchupId, play })
      return
    }

    // Guard: silently ignore if player already has a pick recorded (pick immutability)
    if (playerId in this.state.round.picks) {
      return
    }

    // Validate pick via plugin
    const plugin = registry.lookup(this.state.config.gameType)
    if (!plugin.validatePick(payload.pick)) {
      this.sendError(sender, "INVALID_PICK", "The submitted pick is invalid")
      return
    }

    // Record pick
    this.state.round.picks[playerId] = payload.pick

    // Send PICK_ACK to sender
    const ackMsg: ServerMessage = {
      type: "PICK_ACK",
      payload: { playerId },
    }
    sender.send(JSON.stringify(ackMsg))

    // Check if all players (humans + bots) have picked — if yes, resolve immediately
    // For big-wheel: resolve immediately after the active spinner picks (only 1 pick per round)
    if (this.state.config.gameType === "big-wheel") {
      this.cancelDeadlineTimer()
      this.scheduleResolve(0)
    } else if (this.allPlayersHavePicked()) {
      this.cancelDeadlineTimer()
      this.scheduleResolve(0)
    }
  }

  private handleEndGame(sender: Connection) {
    // Authorization: only host can end the game
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can end the game")
      return
    }

    // Phase guard: can only end game from RESULT or LOBBY
    if (
      this.state.round.phase !== "RESULT" &&
      this.state.round.phase !== "LOBBY"
    ) {
      this.sendError(
        sender,
        "WRONG_PHASE",
        "Cannot end game in current phase"
      )
      return
    }

    // Cancel any lingering timers
    this.cancelDeadlineTimer()
    this.cancelTickReplay()

    // Apply session scoring based on scoringMode
    if (this.state.config.scoringMode === "chips") {
      // In Chips mode, gameScores already include the session carry-in,
      // so they ARE the new session totals — set directly.
      for (const playerId of Object.keys(this.state.players)) {
        this.state.sessionScores[playerId] = this.state.gameScores[playerId] ?? 0
      }
    } else {
      const strategy = getStrategy(
        this.state.config.scoringMode,
        this.state.config.placementPoints
      )
      const sessionUpdate = strategy.applyGameResult(
        Object.values(this.state.players),
        this.state.gameLeaderboard,
        this.state.gameScores
      )

      // Accumulate session scores (additive only — monotonically increasing)
      for (const [playerId, points] of Object.entries(sessionUpdate.sessionScores)) {
        this.state.sessionScores[playerId] =
          (this.state.sessionScores[playerId] ?? 0) + points
      }
    }

    // Increment games played for all current players
    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionGamesPlayed[playerId] =
        (this.state.sessionGamesPlayed[playerId] ?? 0) + 1
    }

    // Rebuild session leaderboard with accumulated totals
    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    // Reset game scores and game leaderboard for next game
    // In Chips mode, seed gameScores with session totals so the next plugin
    // starts with each player's running chip count already in place.
    this.state.gameScores = {}
    for (const playerId of Object.keys(this.state.players)) {
      this.state.gameScores[playerId] =
        this.state.config.scoringMode === "chips"
          ? (this.state.sessionScores[playerId] ?? 0)
          : 0
    }
    this.state.gameLeaderboard = []

    // Transition to LOBBY, reset round state
    this.state.round = createDefaultRoundState()

    // Unlock settings now that game is over
    this.state.settingsLocked = false

    // Clear plugin state for next game
    this.state.pluginState = {}
    resetBattleBotsState()
    resetCoinTossStreakState()
    resetBigWheelState()
    resetPlaycallerState()

    // ── Tournament mode: lock the completed game and re-evaluate availability ──
    if (
      this.state.config.progressionMode === "tournament" &&
      this.state.tournamentProgress
    ) {
      const currentGameType = this.state.config.gameType
      const plugin = registry.lookup(currentGameType)

      // 1. Mark this game as completed (locked)
      if (!this.state.tournamentProgress.completedGames.includes(currentGameType)) {
        this.state.tournamentProgress.completedGames.push(currentGameType)
      }

      // 2. Re-evaluate all game availability based on updated progress
      this.state.tournamentProgress.availability = evaluateAvailability(
        this.state.tournamentProgress
      )

      // 3. If the completed game was the finale, transition to terminal state
      if (plugin.isFinale) {
        this.state.round.phase = "END_TOURNAMENT"
      }
    }

    this.broadcastState()
  }

  private handleSkipAnimation(sender: Connection) {
    // Only host can skip
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) return

    // Only skip during RESOLVING or RESULT phases (while animation would be playing)
    if (this.state.round.phase !== "RESOLVING" && this.state.round.phase !== "RESULT") return

    // If tick replay is in progress (battle-bots RESOLVING), cancel it and finish immediately
    if (this.tickReplayTimerId !== null && this.state.round.phase === "RESOLVING") {
      this.cancelTickReplay()
      // Finalize the round using the stored pending result
      this.finishResolving(this.pendingResolveResult)
      // Also broadcast SKIP_ANIMATION so clients skip client-side animations
      const skipMsg: ServerMessage = { type: "SKIP_ANIMATION" }
      this.broadcast(JSON.stringify(skipMsg))
      return
    }

    // Broadcast SKIP_ANIMATION to all clients
    const msg: ServerMessage = { type: "SKIP_ANIMATION" }
    this.broadcast(JSON.stringify(msg))
  }

  private handleStartSimulation(
    sender: Connection,
    payload: { playerCount?: number; roundCount?: number; seed?: number }
  ) {
    // Authorization: only host can start a simulation
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can start a simulation")
      return
    }

    // Phase guard: can only start from LOBBY or RESULT (same as START_ROUND)
    if (
      this.state.round.phase !== "LOBBY" &&
      this.state.round.phase !== "RESULT"
    ) {
      this.sendError(
        sender,
        "WRONG_PHASE",
        "Cannot start simulation in current phase"
      )
      return
    }

    // Create and run the FastPlayAdapter
    const adapter = new FastPlayAdapter({ id: this.name, broadcast: (msg: string) => this.broadcast(msg) })
    this.simulationAdapter = adapter

    const gameType = this.state.config.gameType
    const playerCount = payload.playerCount ?? 4
    const roundCount = payload.roundCount ?? COIN_TOSS.MAX_ROUNDS
    const seed = payload.seed

    // Fire-and-forget: run the simulation asynchronously
    adapter.run(gameType, playerCount, roundCount, seed).then(() => {
      // Clear the reference when simulation completes naturally
      if (this.simulationAdapter === adapter) {
        this.simulationAdapter = null
      }
    })
  }

  private handleStopSimulation(sender: Connection) {
    // Authorization: only host can stop a simulation
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can stop a simulation")
      return
    }

    // Abort the running simulation
    this.simulationAdapter?.abort()
    this.simulationAdapter = null
  }

  private handleKickPlayer(
    sender: Connection,
    payload: { playerId: string }
  ) {
    // Authorization: only host can kick players
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can kick players")
      return
    }

    // Validate target exists and is not the host
    const target = this.state.players[payload.playerId]
    if (!target) {
      this.sendError(sender, "INVALID_TARGET", "Player not found")
      return
    }
    if (target.role === "host") {
      this.sendError(sender, "INVALID_TARGET", "Cannot kick the host")
      return
    }

    // Remove player from state
    delete this.state.players[payload.playerId]

    // Close their WebSocket connection if connected
    if (target.connectionId) {
      const conn = [...this.getConnections()].find(
        (c) => c.id === target.connectionId
      )
      conn?.close(4001, "Kicked by host")
    }

    // During PICKING: re-evaluate if all remaining connected players have picked
    if (
      this.state.round.phase === "PICKING" &&
      this.allConnectedPlayersHavePicked()
    ) {
      this.cancelDeadlineTimer()
      this.broadcastState()
      // Reconcile bots after a player is kicked (add a bot to replace the kicked human)
      this.reconcileBots()
      this.scheduleResolve(0)
      return
    }

    this.broadcastState()

    // Reconcile bots after a player is kicked (add a bot to replace the kicked human)
    this.reconcileBots()
  }

  private handleReassignHost(
    sender: Connection,
    payload: { targetPlayerId: string }
  ) {
    // Authorization: only host can reassign the host role
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can reassign the host role")
      return
    }

    // Validate target exists and is connected
    const target = this.state.players[payload.targetPlayerId]
    if (!target || !target.connected) {
      this.sendError(sender, "INVALID_TARGET", "Target player is not connected")
      return
    }

    // Bots cannot be promoted to host
    if (this.botManager.isBot(payload.targetPlayerId)) {
      this.sendError(sender, "INVALID_TARGET", "Cannot assign host role to a bot")
      return
    }

    // Swap roles: demote current host to player, promote target to host
    const currentHost = Object.values(this.state.players).find(p => p.role === "host")
    if (currentHost) currentHost.role = "player"
    target.role = "host"

    this.broadcastState()
  }

  private handleAdjustScore(
    sender: Connection,
    payload: { targetPlayerId: string; delta: number; scoreType: "game" | "session"; reason?: string }
  ) {
    // Authorization: only host can adjust scores
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can adjust scores")
      return
    }

    // Validate delta is integer
    if (!Number.isInteger(payload.delta)) {
      this.sendError(sender, "INVALID_PAYLOAD", "Delta must be an integer")
      return
    }

    // Validate target exists
    const target = this.state.players[payload.targetPlayerId]
    if (!target) {
      this.sendError(sender, "INVALID_TARGET", "Target player not found")
      return
    }

    // Apply delta to the appropriate score
    if (payload.scoreType === "game") {
      this.state.gameScores[payload.targetPlayerId] =
        (this.state.gameScores[payload.targetPlayerId] ?? 0) + payload.delta
    } else {
      this.state.sessionScores[payload.targetPlayerId] =
        (this.state.sessionScores[payload.targetPlayerId] ?? 0) + payload.delta
    }

    // Append to adjustment log
    const entry: AdjustmentLogEntry = {
      id: crypto.randomUUID(),
      targetPlayerId: payload.targetPlayerId,
      delta: payload.delta,
      scoreType: payload.scoreType,
      reason: payload.reason ?? "",
      timestamp: Date.now(),
      performedBy: senderId!,
    }
    this.state.adjustmentLog.push(entry)

    // Rebuild leaderboards after score change
    if (payload.scoreType === "game") {
      const plugin = registry.lookup(this.state.config.gameType)
      this.state.gameLeaderboard = plugin.computeGameLeaderboard(
        Object.values(this.state.players),
        this.state.gameScores
      )
    }
    // Always rebuild session leaderboard for consistency
    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    this.broadcastState()
  }

  private handleUpdateRoomSize(
    sender: Connection,
    payload: { roomSize: number }
  ) {
    // Authorization: only host can change room size
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can change room size")
      return
    }

    // Lock guard: reject during active game
    if (this.state.settingsLocked) {
      this.sendError(sender, "SETTINGS_LOCKED", "Cannot change room size during an active game")
      return
    }

    // Validate roomSize is an integer between 2 and 10
    if (!Number.isInteger(payload.roomSize) || payload.roomSize < 2 || payload.roomSize > 10) {
      this.sendError(sender, "INVALID_ROOM_SIZE", "Room size must be an integer between 2 and 10")
      return
    }

    // Reject if new room size < current human player count
    const humanCount = Object.keys(this.state.players).filter(
      (id) => !this.botManager.isBot(id)
    ).length
    if (payload.roomSize < humanCount) {
      this.sendError(
        sender,
        "ROOM_SIZE_TOO_SMALL",
        `Cannot reduce room size below the number of human players (${humanCount})`
      )
      return
    }

    // Apply the new room size
    this.state.config.roomSize = payload.roomSize

    // Reconcile bots to match the new room size
    this.reconcileBots()

    // Broadcast state (reconcileBots already broadcasts if changes occurred,
    // but we need to broadcast even if bot count didn't change, since roomSize config changed)
    this.broadcastState()
  }

  private handleReturnToLobby(sender: Connection) {
    // Authorization: only host can return to lobby
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can return to lobby")
      return
    }

    // Phase guard: can only return to lobby from END_GAME
    if (this.state.round.phase !== "END_GAME") {
      this.sendError(
        sender,
        "WRONG_PHASE",
        "Can only return to lobby from END_GAME phase"
      )
      return
    }

    // Reset game scores
    // In Chips mode, seed gameScores with session totals so the next plugin
    // starts with each player's running chip count already in place.
    this.state.gameScores = {}
    for (const playerId of Object.keys(this.state.players)) {
      this.state.gameScores[playerId] =
        this.state.config.scoringMode === "chips"
          ? (this.state.sessionScores[playerId] ?? 0)
          : 0
    }
    this.state.gameLeaderboard = []

    // Transition to LOBBY, reset round state
    this.state.round = createDefaultRoundState()

    // Unlock settings now that game is over
    this.state.settingsLocked = false

    // Clear plugin state for next game
    this.state.pluginState = {}
    resetBattleBotsState()
    resetCoinTossStreakState()
    resetBigWheelState()
    resetPlaycallerState()

    // ── Tournament mode: lock the completed game and re-evaluate availability ──
    if (
      this.state.config.progressionMode === "tournament" &&
      this.state.tournamentProgress
    ) {
      const currentGameType = this.state.config.gameType
      const plugin = registry.lookup(currentGameType)

      // 1. Mark this game as completed (locked)
      if (!this.state.tournamentProgress.completedGames.includes(currentGameType)) {
        this.state.tournamentProgress.completedGames.push(currentGameType)
      }

      // 2. Re-evaluate all game availability based on updated progress
      this.state.tournamentProgress.availability = evaluateAvailability(
        this.state.tournamentProgress
      )

      // 3. If the completed game was the finale, transition to terminal state
      if (plugin.isFinale) {
        this.state.round.phase = "END_TOURNAMENT"
      }
    }

    this.broadcastState()
  }

  private handleVoteGame(
    sender: Connection,
    payload: { gameType: string }
  ) {
    // Any connected player can vote — no role restriction
    const playerId = this.getPlayerIdByConnectionId(sender.id)
    if (!playerId) {
      this.sendError(sender, "NOT_IN_ROOM", "Player not found in room")
      return
    }

    // Only allow voting during LOBBY phase
    if (this.state.round.phase !== "LOBBY") {
      return
    }

    // Only allow voting on active (registered) games
    const gameType = payload.gameType
    try {
      registry.lookup(gameType)
    } catch {
      return
    }

    // Check if player was already voting for this specific game (for toggle logic)
    const previousVote = this.state.gameVotes[gameType]?.includes(playerId)

    // Remove player's vote from ALL games first (one vote per player)
    for (const gt of Object.keys(this.state.gameVotes)) {
      this.state.gameVotes[gt] = this.state.gameVotes[gt].filter((id) => id !== playerId)
      if (this.state.gameVotes[gt].length === 0) {
        delete this.state.gameVotes[gt]
      }
    }

    // If they were voting for this same game, toggle it off (don't re-add)
    // If they weren't, add their vote
    if (!previousVote) {
      if (!this.state.gameVotes[gameType]) {
        this.state.gameVotes[gameType] = []
      }
      this.state.gameVotes[gameType].push(playerId)
    }

    this.broadcastState()
  }

  private handlePlaySelection(
    sender: Connection,
    payload: { matchupId: string; play: string }
  ) {
    handlePlaySelectionFn(this.getPlaycallerContext(), sender, payload)
  }

  private advancePlaycallerBracket() {
    advancePlaycallerBracketFn(this.getPlaycallerContext())
  }

  private beginPlaycallerDown() {
    beginPlaycallerDownFn(this.getPlaycallerContext())
  }

  private schedulePlaycallerBotPicks() {
    schedulePlaycallerBotPicksFn(this.getPlaycallerContext())
  }

  private resolvePlaycallerTimeout() {
    resolvePlaycallerTimeoutFn(this.getPlaycallerContext())
  }

  /** Build the context object needed by playcaller room handlers */
  private getPlaycallerContext(): PlaycallerRoomContext {
    return {
      state: this.state,
      broadcastState: () => this.broadcastState(),
      cancelDeadlineTimer: () => this.cancelDeadlineTimer(),
      cancelBotPickTimers: () => this.cancelBotPickTimers(),
      scheduleResolve: (delayMs: number) => this.scheduleResolve(delayMs),
      sendError: (conn, code, message) => this.sendError(conn, code, message),
      getPlayerIdByConnectionId: (connId: string) => this.getPlayerIdByConnectionId(connId),
      botManager: this.botManager,
      autoEndGame: () => this.autoEndGame(),
      botPickTimerIds: this.botPickTimerIds,
    }
  }

  private handleGameTypeChange(
    sender: Connection,
    payload: { gameType: string }
  ) {
    // Authorization: only host can change game type
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can change the game type")
      return
    }

    // Lock guard: reject during active game
    if (this.state.settingsLocked) {
      this.sendError(sender, "SETTINGS_LOCKED", "Cannot change game type during an active game")
      return
    }

    // Tournament guard: reject if game is locked or unavailable in tournament mode
    if (
      this.state.config.progressionMode === "tournament" &&
      this.state.tournamentProgress
    ) {
      const tileStatus = this.state.tournamentProgress.availability[payload.gameType]
      if (tileStatus === "locked") {
        this.sendError(sender, "GAME_LOCKED", "This game has already been played in the current tournament")
        return
      }
      if (tileStatus === "unavailable") {
        this.sendError(sender, "GAME_UNAVAILABLE", "This game's unlock criteria are not met")
        return
      }
    }

    // No-op if same game type
    if (payload.gameType === this.state.config.gameType) {
      return
    }

    const newGameType = payload.gameType
    const plugin = registry.lookup(newGameType)

    // Reset game-specific tuning to new plugin defaults
    const newTuning: Record<string, number | boolean | string> = {}
    if (plugin.settingsSchema) {
      for (const field of plugin.settingsSchema) {
        newTuning[field.key] = field.defaultValue
      }
    }

    // Retain shared settings, reset tuning and pickWindowMs
    this.state.gameSettings = {
      roundCount: newGameType === "battle-bots"
        ? BATTLE_BOTS.ROUND_COUNT
        : newGameType === "big-wheel"
        ? 0  // determined at game launch (equals player count)
        : newGameType === "playcaller"
        ? 0  // determined at game launch (equals bracket totalRounds)
        : this.state.gameSettings.roundCount,  // retained for non-battle-bots
      pickWindowMs: plugin.pickWindowMs,               // reset to new plugin default
      tuning: newTuning,                               // reset to new plugin defaults
    }

    this.state.config.gameType = newGameType
    this.broadcastState()
  }

  private handleUpdateSettings(
    sender: Connection,
    payload: { changes: Partial<GameSettings> }
  ) {
    // Auth: only host
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can update settings")
      return
    }

    // Lock guard: reject during active game
    if (this.state.settingsLocked) {
      this.sendError(sender, "SETTINGS_LOCKED", "Settings cannot be changed during an active game")
      return
    }

    // Validate and sanitize
    const plugin = registry.lookup(this.state.config.gameType)
    const result = validateSettingsUpdate(
      payload.changes,
      this.state.gameSettings,
      plugin.settingsSchema
    )

    if (!result.valid) {
      this.sendError(sender, "INVALID_SETTINGS", result.error)
      return
    }

    // Battle-bots has a fixed round count of 3 — prevent overriding
    if (this.state.config.gameType === "battle-bots" && result.sanitized.roundCount !== undefined) {
      result.sanitized.roundCount = BATTLE_BOTS.ROUND_COUNT
    }

    // Big-wheel round count equals player count — prevent manual overriding
    if (this.state.config.gameType === "big-wheel" && result.sanitized.roundCount !== undefined) {
      delete result.sanitized.roundCount
    }

    // Playcaller round count equals bracket totalRounds — prevent manual overriding
    if (this.state.config.gameType === "playcaller" && result.sanitized.roundCount !== undefined) {
      delete result.sanitized.roundCount
    }

    // Merge sanitized changes into gameSettings
    this.state.gameSettings = {
      ...this.state.gameSettings,
      ...result.sanitized,
      tuning: {
        ...this.state.gameSettings.tuning,
        ...(result.sanitized.tuning ?? {}),
      },
    }

    this.broadcastState()
  }

  // ── Round lifecycle ────────────────────────────────────────────────────

  /**
   * Begin a new round: reset picks, set deadline, broadcast, schedule resolve.
   * For battle-bots rounds 2 and 3, skip PICKING and go directly to RESOLVING.
   */
  private beginRound() {
    // Cancel any lingering timer from a previous round
    this.cancelDeadlineTimer()
    this.cancelTickReplay()

    // Lock settings during active game
    this.state.settingsLocked = true

    // Clear game votes when a game starts
    this.state.gameVotes = {}

    const roundNumber = this.state.round.roundNumber + 1

    // Reset streak counters at the start of a new game (round 1)
    if (roundNumber === 1) {
      resetCoinTossStreakState()
    }

    // ── Big Wheel: initialize plugin state on first round ─────────────────
    if (this.state.config.gameType === "big-wheel" && roundNumber === 1) {
      const playerIds = Object.keys(this.state.players)
      const spinOrder = determineSpinOrder(playerIds, this.state.sessionLeaderboard)
      const reelStripSetting = this.state.gameSettings.tuning?.REEL_STRIP
      const reelStrip = Array.isArray(reelStripSetting)
        ? (reelStripSetting as number[])
        : [...BIG_WHEEL.DEFAULT_REEL_STRIP]

      setBigWheelState({
        spinOrder,
        currentTurnIndex: 0,
        currentSpinNumber: 1,
        reelStrip,
        spinResults: {},
        disconnectedPlayers: [],
      })

      // Set round count equal to player count * 2 spins (each spin is a "round")
      // Actually each player's full turn (2 spins) maps to rounds in the server lifecycle
      this.state.gameSettings.roundCount = spinOrder.length * BIG_WHEEL.SPINS_PER_TURN
    }

    // ── Playcaller: initialize bracket on first round ─────────────────────
    if (this.state.config.gameType === "playcaller" && roundNumber === 1) {
      const playerIds = Object.keys(this.state.players)

      // Validate player count
      if (playerIds.length < PLAYCALLER.MIN_PLAYERS) {
        const hostConn = this.getHostConnection()
        if (hostConn) {
          this.sendError(hostConn, "INVALID_PLAYER_COUNT", "Playcaller requires at least 2 players")
        }
        return
      }

      // Build session leaderboard sorted by session score descending
      const leaderboard = playerIds
        .map((id) => ({ id, score: this.state.sessionScores[id] ?? 0 }))
        .sort((a, b) => b.score - a.score)

      // Group by score and shuffle tied groups (random tiebreaker, never alphabetical)
      const rankedPlayerIds: string[] = []
      let i = 0
      while (i < leaderboard.length) {
        let j = i
        while (j < leaderboard.length && leaderboard[j].score === leaderboard[i].score) {
          j++
        }
        // Shuffle the tied group
        const tiedGroup = leaderboard.slice(i, j).map((e) => e.id)
        for (let k = tiedGroup.length - 1; k > 0; k--) {
          const r = Math.floor(Math.random() * (k + 1));
          [tiedGroup[k], tiedGroup[r]] = [tiedGroup[r], tiedGroup[k]]
        }
        rankedPlayerIds.push(...tiedGroup)
        i = j
      }

      // Generate bracket and store state
      const bracket = generateBracket(rankedPlayerIds)
      setPlaycallerState(bracket)
      this.state.pluginState["playcaller"] = bracket

      // Set round count to bracket's totalRounds
      this.state.gameSettings.roundCount = bracket.totalRounds
    }

    // ── Playcaller: start down loop if SKIP_GAMEPLAY is false ──────────
    if (this.state.config.gameType === "playcaller" && this.state.gameSettings.tuning?.SKIP_GAMEPLAY === false) {
      const bracket = getPlaycallerState()!
      if (isComplete(bracket)) {
        // Bracket is done — end the game
        this.autoEndGame()
        return
      }
      const currentRound = bracket.rounds[bracket.currentRoundIndex]
      initializeDrives(currentRound.matchups)
      this.state.round.roundNumber = roundNumber
      this.beginPlaycallerDown()
      return
    }

    // ── Big Wheel: check if current player is disconnected and skip ───────
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
        if (activeSpinnerId && isPlayerDisconnected(activeSpinnerId)) {
          // Auto-resolve the disconnected player's turn
          resolveDisconnectedTurn(activeSpinnerId)

          // Advance to next player
          bwState.currentTurnIndex++
          bwState.currentSpinNumber = 1

          // Check if all players are done
          if (bwState.currentTurnIndex >= bwState.spinOrder.length) {
            this.finalizeBigWheelGame()
            return
          }

          // Recurse to start the next player's turn (which increments roundNumber again)
          this.broadcastState()
          this.beginRound()
          return
        }
      }
    }

    // Battle-bots rounds 2 and 3 skip PICKING — no player input needed
    const shouldSkipPicking =
      this.state.config.gameType === "battle-bots" && roundNumber > 1

    if (shouldSkipPicking) {
      // Skip PICKING — go directly to RESOLVING
      this.state.round = {
        phase: "RESOLVING",
        roundNumber,
        picks: {},
        result: null,
        pickDeadlineMs: null,
        resolvedAt: null,
      }
      this.broadcastState()
      // Resolve immediately without waiting for picks
      this.resolveRoundDirect()
    } else {
      // Standard PICKING phase
      this.state.round = {
        phase: "PICKING",
        roundNumber,
        picks: {},
        result: null,
        pickDeadlineMs: Date.now() + this.state.gameSettings.pickWindowMs,
        resolvedAt: null,
      }

      // For battle-bots Round 1: pre-generate robot options so clients can display them during PICKING
      if (this.state.config.gameType === "battle-bots" && roundNumber === 1) {
        const templates = getRobotTemplates(this.state.gameSettings)
        const robotOptions: Record<string, { playerId: string; options: typeof templates }> = {}
        for (const player of Object.values(this.state.players)) {
          robotOptions[player.id] = { playerId: player.id, options: [...templates] }
        }
        this.state.round.result = { robotOptions }
      }

      this.broadcastState()

      // Schedule bot picks — for big-wheel, only the active spinner matters
      if (this.state.config.gameType === "big-wheel") {
        // If bot picks immediately, it handles resolution — don't set deadline
        if (!this.scheduleBigWheelBotPick()) {
          this.scheduleResolve(this.state.gameSettings.pickWindowMs)
        }
      } else {
        // Schedule bot picks with random delays (500–2000ms per bot)
        this.scheduleBotPicks()

        // Schedule the deadline timer
        this.scheduleResolve(this.state.gameSettings.pickWindowMs)
      }
    }
  }

  /**
   * Schedule bot picks with random delays (500–2000ms per bot).
   * Bots submit picks instantly so that the round resolves as soon as all
   * HUMAN players have made their choices.
   */
  private scheduleBotPicks() {
    this.cancelBotPickTimers()

    const botIds = this.botManager.getBotIds()
    if (botIds.length === 0) return

    const plugin = registry.lookup(this.state.config.gameType)
    const picks = this.botManager.generatePicks(
      this.state.config.gameType,
      this.state.gameSettings
    )

    // Submit all bot picks immediately (no delay)
    for (const botId of botIds) {
      const pick = picks[botId]
      if (pick === undefined) continue
      if (botId in this.state.round.picks) continue

      // Validate pick via plugin (same validation as human picks)
      if (!plugin.validatePick(pick)) continue

      // Record the bot's pick instantly
      this.state.round.picks[botId] = pick
    }

    // After all bot picks are in, check if all players have picked → early resolution
    if (this.allPlayersHavePicked()) {
      this.cancelDeadlineTimer()
      this.scheduleResolve(0)
    }
  }

  /**
   * Resolve the current round. Has an idempotency guard to prevent double-fire:
   * if phase ≠ PICKING, this is a no-op.
   */
  private resolveRound() {
    // IDEMPOTENCY GUARD: Only resolves if currently PICKING.
    // Both timer expiry and "all picks in" may call this — only the first takes effect.
    if (this.state.round.phase !== "PICKING") {
      return
    }

    // Cancel deadline timer BEFORE any resolution logic
    this.cancelDeadlineTimer()

    // ── Big Wheel: auto-assign spin pick if active spinner didn't submit ──
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
        if (!(activeSpinnerId in this.state.round.picks)) {
          // Auto-resolve: assign the spin pick for the active spinner
          this.state.round.picks[activeSpinnerId] = { type: "spin" }
        }
      }
    } else {
      // Assign random picks to connected human players who didn't submit in time
      const connectedHumans = Object.values(this.state.players).filter(
        p => p.connected && !this.botManager.isBot(p.id)
      )
      for (const player of connectedHumans) {
        if (!(player.id in this.state.round.picks)) {
          const randomSide = Math.random() < 0.5 ? "HEADS" : "TAILS"
          this.state.round.picks[player.id] = { side: randomSide }
        }
      }

      // Assign picks for bots that haven't submitted yet (their timers may not have fired)
      const botPicks = this.botManager.generatePicks(
        this.state.config.gameType,
        this.state.gameSettings
      )
      for (const [botId, pick] of Object.entries(botPicks)) {
        if (!(botId in this.state.round.picks)) {
          this.state.round.picks[botId] = pick
        }
      }
    }

    // Transition to RESOLVING, broadcast
    this.state.round.phase = "RESOLVING"
    this.broadcastState()

    const plugin = registry.lookup(this.state.config.gameType)

    // Resolve the round via plugin
    const result = plugin.resolveRound(this.state.round.picks, this.state.gameSettings)

    // Score the round via plugin
    const scoreResult = plugin.scoreRound(
      this.state.round.picks,
      result,
      Object.values(this.state.players),
      this.state.gameSettings
    )

    // Apply deltas to gameScores
    for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
      if (playerId in this.state.gameScores) {
        this.state.gameScores[playerId] += delta
      } else {
        this.state.gameScores[playerId] = delta
      }
    }

    // Compute game leaderboard
    this.state.gameLeaderboard = plugin.computeGameLeaderboard(
      Object.values(this.state.players),
      this.state.gameScores
    )

    // Sync session scores per-round in Chips mode
    this.syncChipsSessionScores()

    // ── Big Wheel: handle spin advancement after resolution ───────────────
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        const spinResult = result as BigWheelSpinResult
        const activeSpinnerId = spinResult.spinnerPlayerId

        // Record the spin result in pluginState
        if (!bwState.spinResults[activeSpinnerId]) {
          bwState.spinResults[activeSpinnerId] = []
        }
        bwState.spinResults[activeSpinnerId].push(spinResult.value)

        if (bwState.currentSpinNumber === 1) {
          // After spin 1: advance to spin 2, stay on same player
          bwState.currentSpinNumber = 2

          // Transition to RESULT — stay here until player/host clicks to continue
          this.state.round.phase = "RESULT"
          this.state.round.result = result
          this.state.round.resolvedAt = Date.now()
          this.broadcastState()

          // If active spinner is a bot, auto-advance after animation delay
          if (this.botManager.isBot(activeSpinnerId)) {
            this.deadlineTimerId = setTimeout(() => {
              // Transition to PICKING for spin 2
              this.state.round = {
                phase: "PICKING",
                roundNumber: this.state.round.roundNumber + 1,
                picks: {},
                result: null,
                pickDeadlineMs: Date.now() + this.state.gameSettings.pickWindowMs,
                resolvedAt: null,
              }
              this.broadcastState()

              // Small delay before bot picks for spin 2 — lets client reset animation state
              this.deadlineTimerId = setTimeout(() => {
                if (!this.scheduleBigWheelBotPick()) {
                  this.scheduleResolve(this.state.gameSettings.pickWindowMs)
                }
              }, 100)
            }, BIG_WHEEL.BOT_SPIN_DELAY_MS)
          }
          return
        } else {
          // After spin 2: player's turn is complete
          // DON'T increment currentTurnIndex yet — keep it pointing at the player
          // whose result we're showing, so the client displays correctly

          // Transition to RESULT to show spin 2 result
          this.state.round.phase = "RESULT"
          this.state.round.result = result
          this.state.round.resolvedAt = Date.now()
          this.broadcastState()

          // If active spinner is a bot, auto-advance after animation delay
          if (this.botManager.isBot(activeSpinnerId)) {
            this.deadlineTimerId = setTimeout(() => {
              bwState.currentTurnIndex++
              bwState.currentSpinNumber = 1
              if (bwState.currentTurnIndex >= bwState.spinOrder.length) {
                this.finalizeBigWheelGame()
                return
              }
              this.beginRound()
            }, BIG_WHEEL.BOT_SPIN_DELAY_MS)
            return
          }

          // Human player — stay in RESULT until host/player clicks to continue
          // (includes the last player — host must click "Next Player" / "View Results")
          return
        }
      }
    }

    // Transition to RESULT, store result and resolvedAt
    this.state.round.phase = "RESULT"
    this.state.round.result = result
    this.state.round.resolvedAt = Date.now()

    this.broadcastState()
  }

  /**
   * Resolve a round directly without waiting for picks.
   * Used for battle-bots rounds 2 and 3 which skip the PICKING phase entirely.
   * The round is already in RESOLVING phase when this is called.
   */
  private resolveRoundDirect() {
    const plugin = registry.lookup(this.state.config.gameType)

    // Resolve the round via plugin (picks are empty — battle-bots rounds 2/3 don't need them)
    const result = plugin.resolveRound(this.state.round.picks, this.state.gameSettings)

    // Score the round via plugin
    const scoreResult = plugin.scoreRound(
      this.state.round.picks,
      result,
      Object.values(this.state.players),
      this.state.gameSettings
    )

    // Apply deltas to gameScores
    for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
      if (playerId in this.state.gameScores) {
        this.state.gameScores[playerId] += delta
      } else {
        this.state.gameScores[playerId] = delta
      }
    }

    // Compute game leaderboard
    this.state.gameLeaderboard = plugin.computeGameLeaderboard(
      Object.values(this.state.players),
      this.state.gameScores
    )

    // Sync session scores per-round in Chips mode
    this.syncChipsSessionScores()

    // For battle-bots rounds 2 and 3, replay tick logs asynchronously before transitioning
    if (this.state.config.gameType === "battle-bots" && this.state.round.roundNumber >= 2) {
      this.replayBattleTicks(result)
      return
    }

    // Transition to RESULT
    this.state.round.phase = "RESULT"
    this.state.round.result = result
    this.state.round.resolvedAt = Date.now()

    this.broadcastState()
  }

  /**
   * Replay pre-computed battle tick logs asynchronously during the RESOLVING phase.
   * Emits BATTLE_TICK messages at TICK_RATE_MS (250ms) intervals to all clients,
   * then transitions to RESULT phase when all ticks have been emitted.
   *
   * Used by battle-bots during Rounds 2 and 3 for real-time tick updates.
   */
  private replayBattleTicks(result: unknown) {
    // Store the result so SKIP_ANIMATION can finalize the round immediately
    this.pendingResolveResult = result

    const tickRateMs = BATTLE_BOTS.TICK_RATE_MS
    const battleResult = result as { round: number; pairings?: Array<{ id: string; robot1: { ownerId: string; currentHp: number }; robot2: { ownerId: string; currentHp: number }; tickLog: Array<{ tick: number; attacks: Array<{ targetId: string; targetHpAfter: number }> }> }>; winnersBracket?: { id: string; participants: Array<{ ownerId: string; currentHp: number }>; tickLog: Array<{ tick: number; attacks: Array<{ targetId: string; targetHpAfter: number }> }> }; losersBracket?: { id: string; participants: Array<{ ownerId: string; currentHp: number }>; tickLog: Array<{ tick: number; attacks: Array<{ targetId: string; targetHpAfter: number }> }> } }

    // Collect all tick snapshots to replay, ordered by tick number
    const tickSnapshots: BattleTickUpdate[] = []

    if (battleResult.round === 2 && battleResult.pairings) {
      // Round 2: replay 1v1 battle ticks from all pairings
      // Find the maximum tick number across all pairings
      const maxTick = Math.max(
        ...battleResult.pairings.map((p) =>
          p.tickLog.length > 0 ? p.tickLog[p.tickLog.length - 1].tick : 0
        )
      )

      // Track running HP for each robot in each pairing
      const pairingHp: Array<{ robot1Hp: number; robot2Hp: number }> = battleResult.pairings.map((pairing) => ({
        robot1Hp: pairing.robot1.currentHp,
        robot2Hp: pairing.robot2.currentHp,
      }))

      for (let t = 1; t <= maxTick; t++) {
        const battles: BattleHPSnapshot[] = battleResult.pairings.map((pairing, idx) => {
          const tickEvent = pairing.tickLog.find((te) => te.tick === t)
          if (tickEvent) {
            // Update running HP from this tick's attacks
            const r1HpAfter = this.getHpAfterTick(pairing.robot1.ownerId, tickEvent.attacks, pairingHp[idx].robot1Hp)
            const r2HpAfter = this.getHpAfterTick(pairing.robot2.ownerId, tickEvent.attacks, pairingHp[idx].robot2Hp)
            pairingHp[idx].robot1Hp = r1HpAfter
            pairingHp[idx].robot2Hp = r2HpAfter
          }

          return {
            battleId: pairing.id,
            robots: [
              { ownerId: pairing.robot1.ownerId, currentHp: Math.max(0, pairingHp[idx].robot1Hp), eliminated: pairingHp[idx].robot1Hp <= 0 },
              { ownerId: pairing.robot2.ownerId, currentHp: Math.max(0, pairingHp[idx].robot2Hp), eliminated: pairingHp[idx].robot2Hp <= 0 },
            ],
          }
        })

        tickSnapshots.push({
          type: "BATTLE_TICK",
          payload: { tick: t, battles },
        })
      }
    } else if (battleResult.round === 3) {
      // Round 3: replay FFA bracket ticks
      const winnersTicks = battleResult.winnersBracket?.tickLog ?? []
      const losersTicks = battleResult.losersBracket?.tickLog ?? []
      const maxTick = Math.max(
        winnersTicks.length > 0 ? winnersTicks[winnersTicks.length - 1].tick : 0,
        losersTicks.length > 0 ? losersTicks[losersTicks.length - 1].tick : 0
      )

      // Track running HP for each robot across ticks
      const winnersHp: Record<string, number> = {}
      const losersHp: Record<string, number> = {}
      if (battleResult.winnersBracket) {
        for (const p of battleResult.winnersBracket.participants) {
          winnersHp[p.ownerId] = p.currentHp
        }
      }
      if (battleResult.losersBracket) {
        for (const p of battleResult.losersBracket.participants) {
          losersHp[p.ownerId] = p.currentHp
        }
      }

      for (let t = 1; t <= maxTick; t++) {
        const battles: BattleHPSnapshot[] = []

        // Winners bracket snapshot for this tick
        if (battleResult.winnersBracket) {
          const tickEvent = winnersTicks.find((te) => te.tick === t)
          if (tickEvent) {
            for (const attack of tickEvent.attacks) {
              winnersHp[attack.targetId] = attack.targetHpAfter
            }
          }
          battles.push({
            battleId: battleResult.winnersBracket.id,
            robots: battleResult.winnersBracket.participants.map((p) => ({
              ownerId: p.ownerId,
              currentHp: Math.max(0, winnersHp[p.ownerId] ?? 0),
              eliminated: (winnersHp[p.ownerId] ?? 0) <= 0,
            })),
          })
        }

        // Losers bracket snapshot for this tick
        if (battleResult.losersBracket) {
          const tickEvent = losersTicks.find((te) => te.tick === t)
          if (tickEvent) {
            for (const attack of tickEvent.attacks) {
              losersHp[attack.targetId] = attack.targetHpAfter
            }
          }
          battles.push({
            battleId: battleResult.losersBracket.id,
            robots: battleResult.losersBracket.participants.map((p) => ({
              ownerId: p.ownerId,
              currentHp: Math.max(0, losersHp[p.ownerId] ?? 0),
              eliminated: (losersHp[p.ownerId] ?? 0) <= 0,
            })),
          })
        }

        tickSnapshots.push({
          type: "BATTLE_TICK",
          payload: { tick: t, battles },
        })
      }
    }

    // If no ticks to replay, transition immediately
    if (tickSnapshots.length === 0) {
      this.finishResolving(result)
      return
    }

    // Emit ticks at configured interval using recursive setTimeout
    let tickIndex = 0
    const emitNextTick = () => {
      if (tickIndex >= tickSnapshots.length) {
        // All ticks emitted — transition to RESULT
        this.tickReplayTimerId = null
        this.finishResolving(result)
        return
      }

      // Broadcast the tick message to all clients
      this.broadcast(JSON.stringify(tickSnapshots[tickIndex]))
      tickIndex++

      // Schedule next tick emission
      this.tickReplayTimerId = setTimeout(emitNextTick, tickRateMs)
    }

    // Start emitting — first tick immediately
    this.broadcast(JSON.stringify(tickSnapshots[tickIndex]))
    tickIndex++
    this.tickReplayTimerId = setTimeout(emitNextTick, tickRateMs)
  }

  /**
   * Get the HP of a target robot after a specific tick's attacks resolve.
   * Finds the last attack targeting this robot in the tick and returns targetHpAfter.
   */
  private getHpAfterTick(
    targetOwnerId: string,
    attacks: Array<{ targetId: string; targetHpAfter: number }>,
    fallbackHp: number
  ): number {
    // Find the last attack targeting this robot in this tick
    for (let i = attacks.length - 1; i >= 0; i--) {
      if (attacks[i].targetId === targetOwnerId) {
        return attacks[i].targetHpAfter
      }
    }
    return fallbackHp
  }

  /**
   * Complete the RESOLVING phase by transitioning to RESULT.
   * Called after all battle ticks have been emitted (or immediately for non-battle-bots).
   */
  private finishResolving(result: unknown) {
    // Clear pending result reference
    this.pendingResolveResult = null

    this.state.round.phase = "RESULT"
    this.state.round.result = result
    this.state.round.resolvedAt = Date.now()

    this.broadcastState()
  }

  /** Cancel the tick replay timer — idempotent (no-op if no timer) */
  private cancelTickReplay() {
    if (this.tickReplayTimerId !== null) {
      clearTimeout(this.tickReplayTimerId)
      this.tickReplayTimerId = null
    }
  }

  /**
   * Auto-end the game when round limit is reached.
   * Transitions to END_GAME phase instead of directly to LOBBY.
   * The host must send RETURN_TO_LOBBY to complete the transition back to LOBBY.
   */
  private autoEndGame() {
    if (this.state.round.phase !== "RESULT") return

    this.cancelDeadlineTimer()
    this.cancelTickReplay()

    // Apply session scoring before transitioning to END_GAME
    if (this.state.config.scoringMode === "chips") {
      // In Chips mode, gameScores already include the session carry-in,
      // so they ARE the new session totals — set directly.
      for (const playerId of Object.keys(this.state.players)) {
        this.state.sessionScores[playerId] = this.state.gameScores[playerId] ?? 0
      }
    } else {
      const strategy = getStrategy(
        this.state.config.scoringMode,
        this.state.config.placementPoints
      )
      const sessionUpdate = strategy.applyGameResult(
        Object.values(this.state.players),
        this.state.gameLeaderboard,
        this.state.gameScores
      )

      for (const [playerId, points] of Object.entries(sessionUpdate.sessionScores)) {
        this.state.sessionScores[playerId] =
          (this.state.sessionScores[playerId] ?? 0) + points
      }
    }

    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionGamesPlayed[playerId] =
        (this.state.sessionGamesPlayed[playerId] ?? 0) + 1
    }

    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    // Transition to END_GAME phase (keep game scores and leaderboard for display)
    this.state.round.phase = "END_GAME"

    this.broadcastState()
  }

  /**
   * Finalize a Big Wheel game after all players have completed their turns.
   * Transitions to END_GAME phase with session scoring applied.
   */
  private finalizeBigWheelGame() {
    this.cancelDeadlineTimer()
    this.cancelTickReplay()

    // Compute final leaderboard
    const plugin = registry.lookup(this.state.config.gameType)
    this.state.gameLeaderboard = plugin.computeGameLeaderboard(
      Object.values(this.state.players),
      this.state.gameScores
    )

    // Apply session scoring before transitioning to END_GAME
    if (this.state.config.scoringMode === "chips") {
      for (const playerId of Object.keys(this.state.players)) {
        this.state.sessionScores[playerId] = this.state.gameScores[playerId] ?? 0
      }
    } else {
      const strategy = getStrategy(
        this.state.config.scoringMode,
        this.state.config.placementPoints
      )
      const sessionUpdate = strategy.applyGameResult(
        Object.values(this.state.players),
        this.state.gameLeaderboard,
        this.state.gameScores
      )

      for (const [playerId, points] of Object.entries(sessionUpdate.sessionScores)) {
        this.state.sessionScores[playerId] =
          (this.state.sessionScores[playerId] ?? 0) + points
      }
    }

    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionGamesPlayed[playerId] =
        (this.state.sessionGamesPlayed[playerId] ?? 0) + 1
    }

    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    // Transition to END_GAME phase
    this.state.round.phase = "END_GAME"

    this.broadcastState()
  }

  /**
   * Schedule a bot's spin pick for Big Wheel if the active spinner is a bot.
   * Bots auto-submit their spin pick immediately.
   * Returns true if the bot submitted a pick and resolution was scheduled.
   */
  private scheduleBigWheelBotPick(): boolean {
    const bwState = getBigWheelState()
    if (!bwState) return false

    const activeSpinnerId = bwState.spinOrder[bwState.currentTurnIndex]
    if (!activeSpinnerId) return false

    // Only schedule if the active spinner is a bot
    if (!this.botManager.isBot(activeSpinnerId)) return false

    // Submit the spin pick immediately for the bot
    if (!(activeSpinnerId in this.state.round.picks)) {
      this.state.round.picks[activeSpinnerId] = { type: "spin" }

      // Resolve immediately since the only player that matters (active spinner) has picked
      this.cancelDeadlineTimer()
      this.scheduleResolve(0)
      return true
    }
    return false
  }

  /**
   * Get the max rounds for the current game type.
   * Returns the configured round count from game settings.
   */
  private getMaxRounds(): number {
    return this.state.gameSettings.roundCount
  }

  /**
   * Schedule resolveRound to fire after a delay.
   * Always cancels any existing timer first.
   */
  private scheduleResolve(delayMs: number) {
    this.cancelDeadlineTimer()
    this.deadlineTimerId = setTimeout(() => {
      if (this.state.config.gameType === "playcaller" && getDriveStates() !== null) {
        this.resolvePlaycallerTimeout()
      } else {
        this.resolveRound()
      }
    }, delayMs)
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  /** Check if there's a connected host in the room */
  private hasConnectedHost(): boolean {
    return Object.values(this.state.players).some(
      (p) => p.role === "host" && p.connected
    )
  }

  /** Get the player ID of the current host, or null if no host */
  private getHostId(): string | null {
    const host = Object.values(this.state.players).find(
      (p) => p.role === "host" && p.connected
    )
    return host?.id ?? null
  }

  /** Get the WebSocket connection for the current host */
  private getHostConnection(): Connection | null {
    const host = Object.values(this.state.players).find(
      (p) => p.role === "host" && p.connected
    )
    if (!host?.connectionId) return null
    return [...this.getConnections()].find(
      (c) => c.id === host.connectionId
    ) ?? null
  }

  /** Get the player ID for a given connection ID */
  private getPlayerIdByConnectionId(connectionId: string): string | null {
    const player = Object.values(this.state.players).find(
      (p) => p.connectionId === connectionId
    )
    return player?.id ?? null
  }

  /** Check if all connected players have submitted their picks */
  private allConnectedPlayersHavePicked(): boolean {
    const connectedPlayers = Object.values(this.state.players).filter(
      (p) => p.connected && !this.botManager.isBot(p.id)
    )
    return connectedPlayers.every((p) => p.id in this.state.round.picks)
  }

  /** Check if ALL players (humans + bots) have submitted their picks */
  private allPlayersHavePicked(): boolean {
    const allPlayerIds = Object.keys(this.state.players)
    return allPlayerIds.every((id) => id in this.state.round.picks)
  }

  /** Cancel the deadline timer — idempotent (no-op if no timer) */
  private cancelDeadlineTimer() {
    if (this.deadlineTimerId !== null) {
      clearTimeout(this.deadlineTimerId)
      this.deadlineTimerId = null
    }
    this.cancelBotPickTimers()
  }

  /** Cancel all pending bot pick timers — idempotent */
  private cancelBotPickTimers() {
    for (const timerId of this.botPickTimerIds) {
      clearTimeout(timerId)
    }
    this.botPickTimerIds = []
  }

  /**
   * In Chips mode, sync sessionScores from gameScores after each round so that
   * the session leaderboard (PlayerList) reflects live running totals during play.
   * No-op for Grand Prix mode (session scores are only set at game end).
   */
  private syncChipsSessionScores(): void {
    if (this.state.config.scoringMode !== "chips") return

    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionScores[playerId] = this.state.gameScores[playerId] ?? 0
    }
    this.state.sessionLeaderboard = this.computeSessionLeaderboard()
  }

  /**
   * Compute session leaderboard from accumulated session scores.
   * Tied players receive equal rank values.
   */
  private computeSessionLeaderboard(): SessionLeaderboardEntry[] {
    const entries = Object.values(this.state.players).map((player) => ({
      playerId: player.id,
      playerName: player.name,
      sessionPoints: this.state.sessionScores[player.id] ?? 0,
      gamesPlayed: this.state.sessionGamesPlayed[player.id] ?? 0,
    }))

    // Sort by sessionPoints descending
    entries.sort((a, b) => b.sessionPoints - a.sessionPoints)

    // Assign ranks with ties getting equal rank
    const ranked: SessionLeaderboardEntry[] = []
    for (let i = 0; i < entries.length; i++) {
      const rank =
        i > 0 && entries[i].sessionPoints === entries[i - 1].sessionPoints
          ? ranked[i - 1].rank
          : i + 1
      ranked.push({ ...entries[i], rank })
    }

    return ranked
  }

  /** Broadcast full STATE_SYNC to all connected clients */
  private broadcastState() {
    const msg: ServerMessage = {
      type: "STATE_SYNC",
      payload: this.getPublicState(),
    }
    this.broadcast(JSON.stringify(msg))
  }

  /** Send an ERROR message to a specific connection */
  private sendError(
    connection: Connection,
    code: string,
    message: string
  ) {
    const msg: ServerMessage = {
      type: "ERROR",
      payload: { code, message },
    }
    connection.send(JSON.stringify(msg))
  }

  /**
   * Reconcile bots to maintain the room size invariant.
   * Adds or removes bots and updates player entries and scores accordingly.
   */
  private reconcileBots() {
    const { added, removed } = this.botManager.reconcile(
      this.state.players,
      this.state.config.roomSize
    )

    // Add new bot player entries and initialize their scores
    for (const persona of added) {
      const botPlayer: Player = {
        id: persona.id,
        name: persona.name,
        role: "player",
        connected: true,
        connectionId: null,
      }
      this.state.players[persona.id] = botPlayer

      // Initialize scores to 0
      this.state.gameScores[persona.id] = 0
      this.state.sessionScores[persona.id] = 0
      if (!(persona.id in this.state.sessionGamesPlayed)) {
        this.state.sessionGamesPlayed[persona.id] = 0
      }
    }

    // Remove departed bot entries and clean up their scores
    for (const botId of removed) {
      delete this.state.players[botId]
      delete this.state.gameScores[botId]
      delete this.state.sessionScores[botId]
      delete this.state.sessionGamesPlayed[botId]

      // Remove from game leaderboard
      this.state.gameLeaderboard = this.state.gameLeaderboard.filter(
        (entry) => entry.playerId !== botId
      )

      // Remove from session leaderboard
      this.state.sessionLeaderboard = this.state.sessionLeaderboard.filter(
        (entry) => entry.playerId !== botId
      )
    }

    // Broadcast state if any changes occurred
    if (added.length > 0 || removed.length > 0) {
      this.broadcastState()
    }
  }

  /**
   * Convert internal LiveRoomState to the client-facing RoomState.
   * Converts players from Record to Array for the client.
   */
  private getPublicState(): RoomState {
    // Build Big Wheel game state if active
    let bigWheelGameState: BigWheelGameState | null = null
    if (this.state.config.gameType === "big-wheel") {
      const bwState = getBigWheelState()
      if (bwState) {
        bigWheelGameState = {
          spinOrder: bwState.spinOrder,
          currentTurnIndex: bwState.currentTurnIndex,
          currentSpinNumber: bwState.currentSpinNumber,
          activeSpinnerId: bwState.spinOrder[bwState.currentTurnIndex] ?? "",
          spinResults: bwState.spinResults,
          reelStrip: bwState.reelStrip,
        }
      }
    }

    // Build Playcaller game state if active
    let playcallerGameState: PlaycallerGameState | null = null
    if (this.state.config.gameType === "playcaller") {
      const bracket = getPlaycallerState()
      if (bracket) {
        // Strip circular finalState from drive completions before serialization
        const rawDrives = getDriveStates()
        let serializableDrives: Record<string, unknown> | null = null
        if (rawDrives) {
          serializableDrives = {}
          for (const [id, drive] of Object.entries(rawDrives)) {
            if (drive.completion) {
              const { finalState, ...rest } = drive.completion
              serializableDrives[id] = { ...drive, completion: rest }
            } else {
              serializableDrives[id] = drive
            }
          }
        }

        playcallerGameState = {
          bracket,
          spectators: getSpectators(),
          activeCompetitors: getActiveCompetitors(),
          driveStates: serializableDrives as any,
        }
      }
    }

    return {
      room: this.state.config,
      players: Object.values(this.state.players),
      round: this.state.round,
      gameLeaderboard: this.state.gameLeaderboard,
      sessionLeaderboard: this.state.sessionLeaderboard,
      adjustmentLog: this.state.adjustmentLog ?? [],
      gameSettings: this.state.gameSettings,
      settingsLocked: this.state.settingsLocked,
      coinTossGameState: this.state.config.gameType === "coin-toss" ? getCoinTossGameState() : undefined,
      bigWheelGameState,
      playcallerGameState,
      gameVotes: this.state.gameVotes,
      tournamentProgress: this.state.tournamentProgress,
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Try to route WebSocket/party requests first
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    // Fall back to serving static assets (SPA)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
