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
      default:
        // Only JOIN is wired for M1 — all other message types return ERROR
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
      }
    }

    this.broadcastState()
  }

  // ── Message handlers ───────────────────────────────────────────────────

  private handleJoin(
    connection: Party.Connection,
    payload: { name: string; role: "host" | "player"; clientId: string }
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

  // ── Utilities ──────────────────────────────────────────────────────────

  /** Check if there's a connected host in the room */
  private hasConnectedHost(): boolean {
    return Object.values(this.state.players).some(
      (p) => p.role === "host" && p.connected
    )
  }

  /** Cancel the deadline timer — idempotent (no-op if no timer) */
  private cancelDeadlineTimer() {
    if (this.deadlineTimerId !== null) {
      clearTimeout(this.deadlineTimerId)
      this.deadlineTimerId = null
    }
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
