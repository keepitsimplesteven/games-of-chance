import { create } from "zustand"
import type { RoomState, ClientMessage, ScoringMode, ProgressionMode, TournamentProgress, GameSettings, GameType, BattleHPSnapshot } from "@games-of-chance/shared"

// ── Join Flow State Machine ────────────────────────────────────────────────

export type JoinState = "NAME_ENTRY" | "CONNECTING" | "IN_ROOM"

// ── Connection Status ──────────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

// ── Store Interface ────────────────────────────────────────────────────────

export interface GameStore {
  // Join flow state (single-route state machine)
  joinState: JoinState

  // Identity
  roomId: string | null
  playerId: string | null
  clientId: string | null
  reconnectPlayerId: string | null
  playerName: string | null
  role: "host" | "player" | null
  scoringMode: ScoringMode | undefined
  progressionMode: ProgressionMode | undefined
  roomSize: number | undefined
  draftPickEnabled: boolean | undefined
  skipGameplay: boolean | undefined

  // Connection
  connectionStatus: ConnectionStatus

  // Server state mirror
  roomState: RoomState | null

  // Client-side pick tracking (prevents double-submission)
  pickSubmitted: boolean
  currentPick: unknown | null
  currentRoundNumber: number | null

  // Animation state — shared so GameView can gate the leaderboard
  roundAnimationDone: boolean

  // Host panel visibility — shared between GearIconTrigger and HostControlPanel
  hostPanelOpen: boolean

  // Battle HP state — latest snapshot from BATTLE_TICK messages per battle
  battleHPState: Record<string, BattleHPSnapshot["robots"]> | null

  // Socket send reference — set by usePartySocket when connected
  _socketSend: ((msg: ClientMessage) => void) | null

  // Actions
  connect: (roomId: string, name: string, role: "host" | "player", scoringMode?: ScoringMode, roomSize?: number, progressionMode?: ProgressionMode, draftPickEnabled?: boolean, skipGameplay?: boolean) => void
  submitPick: (pick: unknown) => void
  startRound: () => void
  endGame: () => void
  startSimulation: (options?: { playerCount?: number; roundCount?: number; seed?: number }) => void
  stopSimulation: () => void
  kickPlayer: (playerId: string) => void
  reassignHost: (targetPlayerId: string) => void
  adjustScore: (targetPlayerId: string, delta: number, scoreType: "game" | "session", reason?: string) => void
  updateSettings: (changes: Partial<GameSettings>) => void
  setGameType: (gameType: GameType) => void
  voteGame: (gameType: GameType) => void
  setHostPanelOpen: (open: boolean) => void

  // Internal actions
  _onStateSync: (state: RoomState) => void
  _onBattleTick: (payload: { tick: number; battles: BattleHPSnapshot[] }) => void
  _resetPickOnNewRound: (roundNumber: number) => void
}

// ── Store Implementation ───────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  joinState: "NAME_ENTRY",
  roomId: null,
  playerId: null,
  clientId: null,
  reconnectPlayerId: null,
  playerName: null,
  role: null,
  scoringMode: undefined,
  progressionMode: undefined,
  roomSize: undefined,
  draftPickEnabled: undefined,
  skipGameplay: undefined,
  connectionStatus: "disconnected",
  roomState: null,
  pickSubmitted: false,
  currentPick: null,
  currentRoundNumber: null,
  roundAnimationDone: false,
  hostPanelOpen: false,
  battleHPState: null,
  _socketSend: null,

  // ── Actions ────────────────────────────────────────────────────────────

  connect: (roomId, name, role, scoringMode, roomSize, progressionMode, draftPickEnabled, skipGameplay) => {
    const current = get().joinState
    // Non-regression guard: once IN_ROOM, never transition backwards
    if (current === "IN_ROOM") return

    // Generate a stable client ID for this session, or restore from localStorage
    const storageKey = `goc:session:${roomId}`
    let clientId = get().clientId
    let reconnectPlayerId: string | null = null

    if (!clientId) {
      // Check localStorage for an existing session in this room
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.clientId && parsed.playerId) {
            clientId = parsed.clientId
            reconnectPlayerId = parsed.playerId
          }
        }
      } catch {
        // localStorage unavailable or corrupt — ignore
      }
      if (!clientId) {
        clientId = crypto.randomUUID()
      }
    }

    set({
      roomId,
      playerName: name,
      clientId,
      reconnectPlayerId,
      role,
      scoringMode,
      progressionMode,
      roomSize,
      draftPickEnabled,
      skipGameplay,
      joinState: "CONNECTING",
      connectionStatus: "connecting",
    })
  },

  submitPick: (pick: unknown) => {
    const { _socketSend } = get()
    // Optimistically mark pick as submitted and store the pick value
    set({ pickSubmitted: true, currentPick: pick })
    // Send to server
    if (_socketSend) {
      _socketSend({ type: "SUBMIT_PICK", payload: { pick } })
    }
  },

  startRound: () => {
    const { _socketSend } = get()
    // Send START_ROUND to server
    if (_socketSend) {
      _socketSend({ type: "START_ROUND" })
    }
  },

  endGame: () => {
    const { _socketSend } = get()
    // Send END_GAME to server
    if (_socketSend) {
      _socketSend({ type: "END_GAME" })
    }
  },

  startSimulation: (options) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({
        type: "START_SIMULATION",
        payload: {
          playerCount: options?.playerCount,
          roundCount: options?.roundCount,
          seed: options?.seed,
        },
      })
    }
  },

  stopSimulation: () => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "STOP_SIMULATION" })
    }
  },

  kickPlayer: (playerId: string) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "KICK_PLAYER", payload: { playerId } })
    }
  },

  reassignHost: (targetPlayerId: string) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "REASSIGN_HOST", payload: { targetPlayerId } })
    }
  },

  adjustScore: (targetPlayerId: string, delta: number, scoreType: "game" | "session", reason?: string) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({
        type: "ADJUST_SCORE",
        payload: { targetPlayerId, delta, scoreType, ...(reason ? { reason } : {}) },
      })
    }
  },

  updateSettings: (changes: Partial<GameSettings>) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "UPDATE_SETTINGS", payload: { changes } })
    }
  },

  setGameType: (gameType: GameType) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "SET_GAME_TYPE", payload: { gameType } })
    }
  },

  voteGame: (gameType: GameType) => {
    const { _socketSend } = get()
    if (_socketSend) {
      _socketSend({ type: "VOTE_GAME", payload: { gameType } })
    }
  },

  setHostPanelOpen: (open: boolean) => set({ hostPanelOpen: open }),

  // ── Internal Actions ───────────────────────────────────────────────────

  _onStateSync: (state: RoomState) => {
    const { currentRoundNumber, playerId, clientId, roomId, reconnectPlayerId } = get()

    // Match self in roster: by playerId if set, otherwise by reconnectPlayerId (reconnection),
    // otherwise by clientId (stable client-generated ID).
    // Note: don't require p.connected — on reconnection the first STATE_SYNC arrives before
    // JOIN is processed, so the player may still be marked disconnected.
    let me = playerId
      ? state.players.find((p) => p.id === playerId)
      : undefined
    if (!me && reconnectPlayerId) {
      me = state.players.find((p) => p.id === reconnectPlayerId)
    }
    if (!me && clientId) {
      me = state.players.find((p) => p.id === clientId)
    }

    const serverRole = me?.role ?? get().role

    // Set playerId from roster if not yet set
    if (!playerId && me) {
      set({ playerId: me.id, reconnectPlayerId: null })

      // Persist session to localStorage for reconnection
      if (roomId && me.id && clientId) {
        try {
          const storageKey = `goc:session:${roomId}`
          localStorage.setItem(storageKey, JSON.stringify({
            clientId,
            playerId: me.id,
            playerName: me.name,
          }))
        } catch {
          // localStorage unavailable — silent fail
        }
      }
    }

    // Clear battle HP state when returning to lobby (game ended)
    const clearBattle = state.round.phase === "LOBBY" ? { battleHPState: null } : {}

    // Detect new round and reset pick tracking + battle HP state
    if (
      state.round.roundNumber !== currentRoundNumber &&
      currentRoundNumber !== null
    ) {
      set({
        roomState: state,
        role: serverRole,
        pickSubmitted: false,
        currentPick: null,
        roundAnimationDone: false,
        battleHPState: null,
        currentRoundNumber: state.round.roundNumber,
      })
    } else if (
      // Playcaller per-down reset: new pick deadline means a new down started
      state.round.phase === "PICKING" &&
      state.round.pickDeadlineMs !== null &&
      get().roomState?.round.pickDeadlineMs !== null &&
      state.round.pickDeadlineMs !== get().roomState?.round.pickDeadlineMs
    ) {
      set({
        roomState: state,
        role: serverRole,
        pickSubmitted: false,
        currentPick: null,
        ...clearBattle,
      })
    } else {
      set({
        roomState: state,
        role: serverRole,
        currentRoundNumber: state.round.roundNumber,
        ...clearBattle,
      })
    }
  },

  _onBattleTick: (payload) => {
    const battleHPState: Record<string, BattleHPSnapshot["robots"]> = {}
    for (const battle of payload.battles) {
      battleHPState[battle.battleId] = battle.robots
    }
    set({ battleHPState })
  },

  _resetPickOnNewRound: (roundNumber: number) => {
    set({
      pickSubmitted: false,
      currentPick: null,
      currentRoundNumber: roundNumber,
    })
  },
}))

// ── Non-regression guard for joinState ─────────────────────────────────────

/**
 * Safe setter for joinState that enforces the non-regression invariant:
 * once IN_ROOM, the state MUST NOT transition backwards to NAME_ENTRY or CONNECTING.
 */
export function setJoinState(nextState: JoinState): void {
  const current = useGameStore.getState().joinState
  if (current === "IN_ROOM") return // permanent — no backwards transitions
  useGameStore.setState({ joinState: nextState })
}

// ── Tournament Mode Selectors ──────────────────────────────────────────────

/**
 * Selector: returns the current progression mode from the room config.
 * Defaults to "endless" when room state is not yet available.
 */
export function selectProgressionMode(state: GameStore): ProgressionMode {
  return state.roomState?.room.progressionMode ?? "endless"
}

/**
 * Selector: returns the tournament progress object, or null if not in tournament mode
 * or room state is not yet available.
 */
export function selectTournamentProgress(state: GameStore): TournamentProgress | null {
  return state.roomState?.tournamentProgress ?? null
}
