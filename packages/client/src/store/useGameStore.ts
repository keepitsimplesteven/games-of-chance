import { create } from "zustand"
import type { RoomState } from "@games-of-chance/shared"

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
  playerName: string | null
  role: "host" | "player" | null

  // Connection
  connectionStatus: ConnectionStatus

  // Server state mirror
  roomState: RoomState | null

  // Client-side pick tracking (prevents double-submission)
  pickSubmitted: boolean
  currentRoundNumber: number | null

  // Actions
  connect: (roomId: string, name: string, role: "host" | "player") => void
  submitPick: (pick: unknown) => void
  startRound: () => void

  // Internal actions
  _onStateSync: (state: RoomState) => void
  _resetPickOnNewRound: (roundNumber: number) => void
}

// ── Store Implementation ───────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  joinState: "NAME_ENTRY",
  roomId: null,
  playerId: null,
  playerName: null,
  role: null,
  connectionStatus: "disconnected",
  roomState: null,
  pickSubmitted: false,
  currentRoundNumber: null,

  // ── Actions ────────────────────────────────────────────────────────────

  connect: (roomId, name, role) => {
    const current = get().joinState
    // Non-regression guard: once IN_ROOM, never transition backwards
    if (current === "IN_ROOM") return

    set({
      roomId,
      playerName: name,
      role,
      joinState: "CONNECTING",
      connectionStatus: "connecting",
    })
  },

  submitPick: (_pick: unknown) => {
    // Optimistically mark pick as submitted
    set({ pickSubmitted: true })
  },

  startRound: () => {
    // No client-side state changes needed — server broadcasts STATE_SYNC
  },

  // ── Internal Actions ───────────────────────────────────────────────────

  _onStateSync: (state: RoomState) => {
    const { currentRoundNumber, playerId, playerName } = get()

    // Sync role from server — server is authoritative on role assignment
    const me = state.players.find(
      (p) => p.id === playerId || (p.name === playerName && p.connected)
    )
    const serverRole = me?.role ?? get().role

    // Detect new round and reset pick tracking
    if (
      state.round.roundNumber !== currentRoundNumber &&
      currentRoundNumber !== null
    ) {
      set({
        roomState: state,
        role: serverRole,
        pickSubmitted: false,
        currentRoundNumber: state.round.roundNumber,
      })
    } else {
      set({
        roomState: state,
        role: serverRole,
        currentRoundNumber: state.round.roundNumber,
      })
    }
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
