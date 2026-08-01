import { create } from "zustand"
import type { RoomState, ClientMessage, ScoringMode, GameSettings, GameType, BattleHPSnapshot } from "@games-of-chance/shared"

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
  playerName: string | null
  role: "host" | "player" | null
  scoringMode: ScoringMode | undefined

  // Connection
  connectionStatus: ConnectionStatus

  // Server state mirror
  roomState: RoomState | null

  // Client-side pick tracking (prevents double-submission)
  pickSubmitted: boolean
  currentRoundNumber: number | null

  // Animation state — shared so GameView can gate the leaderboard
  roundAnimationDone: boolean

  // Battle HP state — latest snapshot from BATTLE_TICK messages per battle
  battleHPState: Record<string, BattleHPSnapshot["robots"]> | null

  // Socket send reference — set by usePartySocket when connected
  _socketSend: ((msg: ClientMessage) => void) | null

  // Actions
  connect: (roomId: string, name: string, role: "host" | "player", scoringMode?: ScoringMode) => void
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
  playerName: null,
  role: null,
  scoringMode: undefined,
  connectionStatus: "disconnected",
  roomState: null,
  pickSubmitted: false,
  currentRoundNumber: null,
  roundAnimationDone: false,
  battleHPState: null,
  _socketSend: null,

  // ── Actions ────────────────────────────────────────────────────────────

  connect: (roomId, name, role, scoringMode) => {
    const current = get().joinState
    // Non-regression guard: once IN_ROOM, never transition backwards
    if (current === "IN_ROOM") return

    // Generate a stable client ID for this session
    const clientId = get().clientId ?? crypto.randomUUID()

    set({
      roomId,
      playerName: name,
      clientId,
      role,
      scoringMode,
      joinState: "CONNECTING",
      connectionStatus: "connecting",
    })
  },

  submitPick: (pick: unknown) => {
    const { _socketSend } = get()
    // Optimistically mark pick as submitted
    set({ pickSubmitted: true })
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

  // ── Internal Actions ───────────────────────────────────────────────────

  _onStateSync: (state: RoomState) => {
    const { currentRoundNumber, playerId, clientId } = get()

    // Match self in roster: by playerId if set, otherwise by clientId (stable client-generated ID)
    const me = playerId
      ? state.players.find((p) => p.id === playerId)
      : state.players.find((p) => p.id === clientId)

    const serverRole = me?.role ?? get().role

    // Set playerId from roster if not yet set
    if (!playerId && me) {
      set({ playerId: me.id })
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
        roundAnimationDone: false,
        battleHPState: null,
        currentRoundNumber: state.round.roundNumber,
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
