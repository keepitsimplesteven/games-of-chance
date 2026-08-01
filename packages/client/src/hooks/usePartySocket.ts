import { useEffect, useRef, useCallback, useState } from "react"
import PartySocket from "partysocket"
import type { ServerMessage, ClientMessage } from "@games-of-chance/shared"
import { useGameStore, setJoinState } from "../store/useGameStore"
import type { ConnectionStatus } from "../store/useGameStore"

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || "localhost:1999"

/**
 * Custom hook that creates and manages a PartySocket connection to a game room.
 *
 * Handles:
 * - Automatic reconnection with exponential backoff (500ms initial, 30s cap)
 * - Server message dispatching (STATE_SYNC, PICK_ACK, ERROR)
 * - Connection status tracking
 * - Sending a JOIN message on connection open
 * - Cleanup on unmount
 */
export function usePartySocket(
  roomId: string,
  playerName: string,
  role: "host" | "player"
) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting")
  const socketRef = useRef<PartySocket | null>(null)

  useEffect(() => {
    // Don't connect if roomId or playerName is not set
    if (!roomId || !playerName) return

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
      // Exponential backoff: initial 500ms, doubling each attempt, capped at 30s
      minReconnectionDelay: 500,
      reconnectionDelayGrowFactor: 2,
      maxReconnectionDelay: 30_000,
      startClosed: false,
    })

    socketRef.current = socket

    // ── Connection opened ──────────────────────────────────────────────────
    socket.addEventListener("open", () => {
      setConnectionStatus("connected")
      useGameStore.setState({ connectionStatus: "connected" })

      // Store the send function reference in Zustand for use by submitPick/startRound
      useGameStore.setState({
        _socketSend: (msg: ClientMessage) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg))
          }
        },
      })

      // Send JOIN message upon connection with clientId for stable identity
      const { clientId, scoringMode } = useGameStore.getState()
      const joinMsg: ClientMessage = {
        type: "JOIN",
        payload: { name: playerName, role, clientId: clientId!, ...(scoringMode ? { scoringMode } : {}) },
      }
      socket.send(JSON.stringify(joinMsg))
    })

    // ── Message received ───────────────────────────────────────────────────
    socket.addEventListener("message", (event) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }

      switch (msg.type) {
        case "STATE_SYNC": {
          const store = useGameStore.getState()
          store._onStateSync(msg.payload)

          // Check if the player is in the roster by clientId → transition to IN_ROOM
          const { clientId, playerId } = store
          const matchId = playerId || clientId
          const isInRoster = matchId
            ? msg.payload.players.some((p) => p.id === matchId && p.connected)
            : false

          if (isInRoster) {
            setJoinState("IN_ROOM")
          }
          break
        }
        case "PICK_ACK":
          // No-op: pickSubmitted already set optimistically on send
          break
        case "SKIP_ANIMATION":
          // Host skipped — all clients jump to results
          useGameStore.setState({ roundAnimationDone: true })
          break
        case "BATTLE_TICK":
          useGameStore.getState()._onBattleTick(msg.payload)
          break
        case "ERROR":
          // Dispatch to error handler — update connection status for critical errors
          console.error("[PartySocket] Server error:", msg.payload.code, msg.payload.message)
          break
      }
    })

    // ── Connection closed ──────────────────────────────────────────────────
    socket.addEventListener("close", () => {
      setConnectionStatus("disconnected")
      useGameStore.setState({ connectionStatus: "disconnected", _socketSend: null })
    })

    // ── Connection error ───────────────────────────────────────────────────
    socket.addEventListener("error", () => {
      setConnectionStatus("error")
      useGameStore.setState({ connectionStatus: "error" })
    })

    // ── Cleanup on unmount ─────────────────────────────────────────────────
    return () => {
      socket.close()
      socketRef.current = null
      useGameStore.setState({ _socketSend: null })
    }
  }, [roomId, playerName, role])

  // ── Send function ────────────────────────────────────────────────────────

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }, [])

  return { send, connectionStatus }
}
