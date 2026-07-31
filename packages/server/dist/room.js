// ── Default configuration ──────────────────────────────────────────────────
function createDefaultConfig(roomId) {
    return {
        roomId,
        gameType: "coin-toss",
        maxPlayers: 10,
        scoringMode: "grand-prix",
        autoMode: false,
        autoRoundIntervalMs: 5000,
        placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
    };
}
function createDefaultRoundState() {
    return {
        phase: "LOBBY",
        roundNumber: 0,
        pickDeadlineMs: null,
        picks: {},
        result: null,
        resolvedAt: null,
    };
}
// ── Room Server ────────────────────────────────────────────────────────────
export default class GameRoom {
    room;
    state;
    deadlineTimerId = null;
    constructor(room) {
        this.room = room;
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
        };
    }
    async onConnect(connection) {
        // Send full STATE_SYNC to the newly connected client
        const msg = {
            type: "STATE_SYNC",
            payload: this.getPublicState(),
        };
        connection.send(JSON.stringify(msg));
    }
    async onMessage(message, sender) {
        let msg;
        try {
            msg = JSON.parse(message);
        }
        catch {
            this.sendError(sender, "INVALID_MESSAGE", "Could not parse message");
            return;
        }
        switch (msg.type) {
            case "JOIN":
                this.handleJoin(sender, msg.payload);
                break;
            default:
                // Only JOIN is wired for M1 — all other message types return ERROR
                this.sendError(sender, "UNSUPPORTED", `Message type "${msg.type}" is not supported yet`);
                break;
        }
    }
    async onClose(connection) {
        // Find player by connection id
        const player = Object.values(this.state.players).find((p) => p.connectionId === connection.id);
        if (!player)
            return;
        // Mark disconnected
        player.connected = false;
        player.connectionId = null;
        // If the disconnected player was the host, promote another connected player
        if (player.role === "host") {
            const nextHost = Object.values(this.state.players).find((p) => p.connected && p.id !== player.id);
            if (nextHost) {
                player.role = "player";
                nextHost.role = "host";
            }
        }
        this.broadcastState();
    }
    // ── Message handlers ───────────────────────────────────────────────────
    handleJoin(connection, payload) {
        const playerCount = Object.keys(this.state.players).length;
        // Reject if at capacity
        if (playerCount >= this.state.config.maxPlayers) {
            this.sendError(connection, "ROOM_FULL", "Room is at maximum capacity");
            return;
        }
        // Determine role
        let role = "player";
        if (playerCount === 0) {
            // First player always gets host
            role = "host";
        }
        else if (payload.role === "host" && !this.hasConnectedHost()) {
            // Explicit host request when no host exists
            role = "host";
        }
        else {
            // Demote duplicate host attempts to player
            role = "player";
        }
        // Create the player
        const player = {
            id: connection.id,
            name: payload.name,
            role,
            connected: true,
            connectionId: connection.id,
        };
        this.state.players[player.id] = player;
        // Initialize scores for new player
        if (!(player.id in this.state.gameScores)) {
            this.state.gameScores[player.id] = 0;
        }
        if (!(player.id in this.state.sessionScores)) {
            this.state.sessionScores[player.id] = 0;
        }
        if (!(player.id in this.state.sessionGamesPlayed)) {
            this.state.sessionGamesPlayed[player.id] = 0;
        }
        this.broadcastState();
    }
    // ── Utilities ──────────────────────────────────────────────────────────
    /** Check if there's a connected host in the room */
    hasConnectedHost() {
        return Object.values(this.state.players).some((p) => p.role === "host" && p.connected);
    }
    /** Cancel the deadline timer — idempotent (no-op if no timer) */
    cancelDeadlineTimer() {
        if (this.deadlineTimerId !== null) {
            clearTimeout(this.deadlineTimerId);
            this.deadlineTimerId = null;
        }
    }
    /** Broadcast full STATE_SYNC to all connected clients */
    broadcastState() {
        const msg = {
            type: "STATE_SYNC",
            payload: this.getPublicState(),
        };
        this.room.broadcast(JSON.stringify(msg));
    }
    /** Send an ERROR message to a specific connection */
    sendError(connection, code, message) {
        const msg = {
            type: "ERROR",
            payload: { code, message },
        };
        connection.send(JSON.stringify(msg));
    }
    /**
     * Convert internal LiveRoomState to the client-facing RoomState.
     * Converts players from Record to Array for the client.
     */
    getPublicState() {
        return {
            room: this.state.config,
            players: Object.values(this.state.players),
            round: this.state.round,
            gameLeaderboard: this.state.gameLeaderboard,
            sessionLeaderboard: this.state.sessionLeaderboard,
        };
    }
}
