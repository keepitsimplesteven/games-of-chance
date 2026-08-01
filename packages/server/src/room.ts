import type * as Party from "partykit/server"
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
} from "@games-of-chance/shared"
import { registry } from "./games/GameRegistry"
import { getStrategy } from "./scoring"
import { COIN_TOSS } from "./games/coin-toss/constants"
import { BATTLE_BOTS } from "./games/battle-bots/constants"
import { getRobotTemplates, resetGameState as resetBattleBotsState } from "./games/battle-bots/BattleBotsPlugin"
// Side-effect import: registers the coin-toss plugin in the global registry
import "./games/coin-toss/CoinTossPlugin"
// Side-effect import: registers the battle-bots plugin in the global registry
import "./games/battle-bots/index"
import { validateSettingsUpdate } from "./settings/validateSettings"
import { FastPlayAdapter } from "./simulation/FastPlayAdapter"
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
  const roundCount = gameType === "battle-bots"
    ? BATTLE_BOTS.ROUND_COUNT
    : COIN_TOSS.MAX_ROUNDS

  return {
    roundCount,
    pickWindowMs: plugin.pickWindowMs,
    tuning,
  }
}

// ── Room Server ────────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  readonly room: Party.Room
  private state!: LiveRoomState
  private deadlineTimerId: ReturnType<typeof setTimeout> | null = null
  private simulationAdapter: FastPlayAdapter | null = null
  private tickReplayTimerId: ReturnType<typeof setTimeout> | null = null
  /** Holds the round result during async tick replay so SKIP_ANIMATION can finalize it */
  private pendingResolveResult: unknown = null

  constructor(room: Party.Room) {
    this.room = room
  }

  async onStart() {
    // Initialize state on cold start
    this.state = {
      config: createDefaultConfig(this.room.id),
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
    }
  }

  async onConnect(connection: Party.Connection) {
    // Send full STATE_SYNC to the newly connected client
    const msg: ServerMessage = {
      type: "STATE_SYNC",
      payload: this.getPublicState(),
    }
    connection.send(JSON.stringify(msg))
  }

  async onMessage(message: string, sender: Party.Connection) {
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
      default:
        this.sendError(
          sender,
          "UNSUPPORTED",
          `Message type "${msg.type}" is not supported yet`
        )
        break
    }
  }

  async onClose(connection: Party.Connection) {
    // Find player by connection id
    const player = Object.values(this.state.players).find(
      (p) => p.connectionId === connection.id
    )
    if (!player) return

    // Mark disconnected
    player.connected = false
    player.connectionId = null

    // If the disconnected player was the host, promote another connected player
    if (player.role === "host") {
      const nextHost = Object.values(this.state.players).find(
        (p) => p.connected && p.id !== player.id
      )
      if (nextHost) {
        player.role = "player"
        nextHost.role = "host"
      } else if (this.state.round.phase === "PICKING") {
        // Host disconnected during PICKING and no new host available — suspend timer
        this.cancelDeadlineTimer()
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
      this.scheduleResolve(0)
      return
    }

    this.broadcastState()
  }

  // ── Message handlers ───────────────────────────────────────────────────

  private handleJoin(
    connection: Party.Connection,
    payload: { name: string; role: "host" | "player"; clientId: string; scoringMode?: "grand-prix" | "chips" }
  ) {
    const playerCount = Object.keys(this.state.players).length

    // Reject if at capacity
    if (playerCount >= this.state.config.maxPlayers) {
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
    } else if (payload.role === "host" && !this.hasConnectedHost()) {
      // Explicit host request when no host exists
      role = "host"
    } else {
      // Demote duplicate host attempts to player
      role = "player"
    }

    // If this is the first player (host) and they provided a scoring mode, apply it
    if (role === "host" && payload.scoringMode) {
      this.state.config.scoringMode = payload.scoringMode
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
  }

  private handleStartRound(sender: Party.Connection) {
    // Authorization: only host can start a round
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)

    if (senderId !== hostId) {
      this.sendError(sender, "NOT_HOST", "Only the host can start a round")
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

    this.beginRound()
  }

  private handleSubmitPick(
    sender: Party.Connection,
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

    // Check if all connected players have picked — if yes, resolve immediately
    if (this.allConnectedPlayersHavePicked()) {
      this.cancelDeadlineTimer()
      this.scheduleResolve(0)
    }
  }

  private handleEndGame(sender: Party.Connection) {
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

    // Increment games played for all current players
    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionGamesPlayed[playerId] =
        (this.state.sessionGamesPlayed[playerId] ?? 0) + 1
    }

    // Rebuild session leaderboard with accumulated totals
    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    // Reset game scores and game leaderboard for next game
    this.state.gameScores = {}
    for (const playerId of Object.keys(this.state.players)) {
      this.state.gameScores[playerId] = 0
    }
    this.state.gameLeaderboard = []

    // Transition to LOBBY, reset round state
    this.state.round = createDefaultRoundState()

    // Unlock settings now that game is over
    this.state.settingsLocked = false

    // Clear plugin state for next game
    this.state.pluginState = {}
    resetBattleBotsState()

    this.broadcastState()
  }

  private handleSkipAnimation(sender: Party.Connection) {
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
      this.room.broadcast(JSON.stringify(skipMsg))
      return
    }

    // Broadcast SKIP_ANIMATION to all clients
    const msg: ServerMessage = { type: "SKIP_ANIMATION" }
    this.room.broadcast(JSON.stringify(msg))
  }

  private handleStartSimulation(
    sender: Party.Connection,
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
    const adapter = new FastPlayAdapter(this.room)
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

  private handleStopSimulation(sender: Party.Connection) {
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
    sender: Party.Connection,
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
      const conn = [...this.room.getConnections()].find(
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
      this.scheduleResolve(0)
      return
    }

    this.broadcastState()
  }

  private handleReassignHost(
    sender: Party.Connection,
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

    // Swap roles: demote current host to player, promote target to host
    const currentHost = Object.values(this.state.players).find(p => p.role === "host")
    if (currentHost) currentHost.role = "player"
    target.role = "host"

    this.broadcastState()
  }

  private handleAdjustScore(
    sender: Party.Connection,
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

  private handleGameTypeChange(
    sender: Party.Connection,
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
        : this.state.gameSettings.roundCount,  // retained for non-battle-bots
      pickWindowMs: plugin.pickWindowMs,               // reset to new plugin default
      tuning: newTuning,                               // reset to new plugin defaults
    }

    this.state.config.gameType = newGameType
    this.broadcastState()
  }

  private handleUpdateSettings(
    sender: Party.Connection,
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

    const roundNumber = this.state.round.roundNumber + 1

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
      // Schedule the deadline timer
      this.scheduleResolve(this.state.gameSettings.pickWindowMs)
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

    // Assign random picks to connected players who didn't submit in time
    // (future: bot personas could provide different strategies here)
    const connectedPlayers = Object.values(this.state.players).filter(p => p.connected)
    for (const player of connectedPlayers) {
      if (!(player.id in this.state.round.picks)) {
        const randomSide = Math.random() < 0.5 ? "HEADS" : "TAILS"
        this.state.round.picks[player.id] = { side: randomSide }
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

    // Transition to RESULT, store result and resolvedAt
    this.state.round.phase = "RESULT"
    this.state.round.result = result
    this.state.round.resolvedAt = Date.now()

    this.broadcastState()

    // Check if we've hit the round limit — auto-end game if so
    // Import MAX_ROUNDS from coin-toss constants (game-specific)
    const maxRounds = this.getMaxRounds()
    if (maxRounds > 0 && this.state.round.roundNumber >= maxRounds) {
      // Auto-end game after a short delay so clients can see final result
      setTimeout(() => this.autoEndGame(), 0)
    }
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

    // Check round limit for auto-end
    const maxRounds = this.getMaxRounds()
    if (maxRounds > 0 && this.state.round.roundNumber >= maxRounds) {
      setTimeout(() => this.autoEndGame(), 0)
    }
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
      this.room.broadcast(JSON.stringify(tickSnapshots[tickIndex]))
      tickIndex++

      // Schedule next tick emission
      this.tickReplayTimerId = setTimeout(emitNextTick, tickRateMs)
    }

    // Start emitting — first tick immediately
    this.room.broadcast(JSON.stringify(tickSnapshots[tickIndex]))
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

    // Check round limit for auto-end
    const maxRounds = this.getMaxRounds()
    if (maxRounds > 0 && this.state.round.roundNumber >= maxRounds) {
      setTimeout(() => this.autoEndGame(), 0)
    }
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
   * Same as handleEndGame but without auth check (system-triggered).
   */
  private autoEndGame() {
    if (this.state.round.phase !== "RESULT") return

    this.cancelDeadlineTimer()
    this.cancelTickReplay()

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

    for (const playerId of Object.keys(this.state.players)) {
      this.state.sessionGamesPlayed[playerId] =
        (this.state.sessionGamesPlayed[playerId] ?? 0) + 1
    }

    this.state.sessionLeaderboard = this.computeSessionLeaderboard()

    this.state.gameScores = {}
    for (const playerId of Object.keys(this.state.players)) {
      this.state.gameScores[playerId] = 0
    }
    this.state.gameLeaderboard = []
    this.state.round = createDefaultRoundState()

    // Unlock settings now that game is over
    this.state.settingsLocked = false

    // Clear plugin state for next game
    this.state.pluginState = {}
    resetBattleBotsState()

    this.broadcastState()
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
    this.deadlineTimerId = setTimeout(() => this.resolveRound(), delayMs)
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
      (p) => p.connected
    )
    return connectedPlayers.every((p) => p.id in this.state.round.picks)
  }

  /** Cancel the deadline timer — idempotent (no-op if no timer) */
  private cancelDeadlineTimer() {
    if (this.deadlineTimerId !== null) {
      clearTimeout(this.deadlineTimerId)
      this.deadlineTimerId = null
    }
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
    this.room.broadcast(JSON.stringify(msg))
  }

  /** Send an ERROR message to a specific connection */
  private sendError(
    connection: Party.Connection,
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
   * Convert internal LiveRoomState to the client-facing RoomState.
   * Converts players from Record to Array for the client.
   */
  private getPublicState(): RoomState {
    return {
      room: this.state.config,
      players: Object.values(this.state.players),
      round: this.state.round,
      gameLeaderboard: this.state.gameLeaderboard,
      sessionLeaderboard: this.state.sessionLeaderboard,
      adjustmentLog: this.state.adjustmentLog ?? [],
      gameSettings: this.state.gameSettings,
      settingsLocked: this.state.settingsLocked,
    }
  }
}
