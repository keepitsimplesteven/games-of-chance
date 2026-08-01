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
} from "@games-of-chance/shared"
import { registry } from "./games/GameRegistry"
import { getStrategy } from "./scoring"
import { COIN_TOSS } from "./games/coin-toss/constants"
// Side-effect import: registers the coin-toss plugin in the global registry
import "./games/coin-toss/CoinTossPlugin"
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

// ── Room Server ────────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  readonly room: Party.Room
  private state!: LiveRoomState
  private deadlineTimerId: ReturnType<typeof setTimeout> | null = null
  private simulationAdapter: FastPlayAdapter | null = null

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

    // Cancel any lingering timer
    this.cancelDeadlineTimer()

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

    this.broadcastState()
  }

  private handleSkipAnimation(sender: Party.Connection) {
    // Only host can skip
    const hostId = this.getHostId()
    const senderId = this.getPlayerIdByConnectionId(sender.id)
    if (senderId !== hostId) return

    // Only skip during RESOLVING or RESULT phases (while animation would be playing)
    if (this.state.round.phase !== "RESOLVING" && this.state.round.phase !== "RESULT") return

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

  // ── Round lifecycle ────────────────────────────────────────────────────

  /**
   * Begin a new round: reset picks, set deadline, broadcast, schedule resolve.
   */
  private beginRound() {
    // Cancel any lingering timer from a previous round
    this.cancelDeadlineTimer()

    const plugin = registry.lookup(this.state.config.gameType)

    // Transition to PICKING phase
    this.state.round = {
      phase: "PICKING",
      roundNumber: this.state.round.roundNumber + 1,
      picks: {},
      result: null,
      pickDeadlineMs: Date.now() + plugin.pickWindowMs,
      resolvedAt: null,
    }

    this.broadcastState()

    // Schedule the deadline timer
    this.scheduleResolve(plugin.pickWindowMs)
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
    const result = plugin.resolveRound(this.state.round.picks)

    // Score the round via plugin
    const scoreResult = plugin.scoreRound(
      this.state.round.picks,
      result,
      Object.values(this.state.players)
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
   * Auto-end the game when round limit is reached.
   * Same as handleEndGame but without auth check (system-triggered).
   */
  private autoEndGame() {
    if (this.state.round.phase !== "RESULT") return

    this.cancelDeadlineTimer()

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

    this.broadcastState()
  }

  /**
   * Get the max rounds for the current game type.
   * Returns from the plugin's constants. Default: 10.
   */
  private getMaxRounds(): number {
    // Currently only coin-toss is supported — use its MAX_ROUNDS constant
    // Future: this could be part of the GamePlugin interface or room config
    return COIN_TOSS.MAX_ROUNDS
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
    }
  }
}
