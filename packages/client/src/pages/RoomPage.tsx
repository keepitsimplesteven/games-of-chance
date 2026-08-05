import { useState, useEffect, FormEvent } from "react"
import { useParams, useLocation } from "react-router-dom"
import type { ScoringMode, ProgressionMode } from "@games-of-chance/shared"
import { useGameStore, setJoinState } from "../store/useGameStore"
import { usePartySocket } from "../hooks/usePartySocket"
import LobbyShell from "../components/lobby/LobbyShell"
import { useTheme } from "../theme"

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const location = useLocation()
  const joinState = useGameStore((s) => s.joinState)
  const connectionStatus = useGameStore((s) => s.connectionStatus)
  const playerName = useGameStore((s) => s.playerName)
  const role = useGameStore((s) => s.role)
  const theme = useTheme()

  // Read scoring mode, progression mode, and room size from navigation state (set by LandingPage "Create Room")
  const scoringMode = (location.state as { scoringMode?: ScoringMode; progressionMode?: ProgressionMode; roomSize?: number } | null)?.scoringMode ?? undefined
  const progressionMode = (location.state as { progressionMode?: ProgressionMode } | null)?.progressionMode ?? undefined
  const roomSize = (location.state as { roomSize?: number } | null)?.roomSize ?? undefined

  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Connect the PartySocket when joinState is CONNECTING or IN_ROOM
  const shouldConnect = joinState === "CONNECTING" || joinState === "IN_ROOM"
  usePartySocket(
    shouldConnect && roomId ? roomId : "",
    shouldConnect && playerName ? playerName : "",
    shouldConnect ? (role ?? "player") : "player"
  )

  // Handle connection error: transition CONNECTING → NAME_ENTRY
  useEffect(() => {
    if (joinState === "CONNECTING" && connectionStatus === "error") {
      setJoinState("NAME_ENTRY")
      setError("Connection failed. Please try again.")
    }
  }, [joinState, connectionStatus])

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !roomId) return

    setError(null)
    // If scoringMode is set, this is the room creator (host)
    const joinRole = scoringMode ? "host" : "player"
    // Transition to CONNECTING and trigger WebSocket connection
    useGameStore.getState().connect(roomId, trimmed, joinRole, scoringMode, roomSize, progressionMode)
  }

  // ── NAME_ENTRY state ─────────────────────────────────────────────────────
  if (joinState === "NAME_ENTRY") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <form
          onSubmit={handleNameSubmit}
          className={`w-full max-w-sm space-y-4 rounded-lg p-6 ${theme.card}`}
        >
          <h2 className={`text-xl font-semibold ${theme.headingText}`}>Join Room</h2>
          <p className={`text-sm ${theme.mutedText}`}>Room: {roomId}</p>

          {error && (
            <p className={`text-sm ${theme.statusDanger}`}>{error}</p>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className={`w-full rounded border-2 bg-transparent px-3 py-2 ${theme.bodyText} ${theme.listItem} focus:outline-none focus:ring-1`}
            autoFocus
          />

          <button
            type="submit"
            disabled={!name.trim()}
            className={`w-full rounded px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${theme.btnPrimary}`}
          >
            Join
          </button>
        </form>
      </div>
    )
  }

  // ── CONNECTING state ─────────────────────────────────────────────────────
  if (joinState === "CONNECTING") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className={`h-3 w-3 animate-pulse rounded-full ${theme.accentText} bg-current`} />
          <p className={theme.mutedText}>Connecting to room...</p>
        </div>
      </div>
    )
  }

  // ── IN_ROOM state ────────────────────────────────────────────────────────
  return <LobbyShell />
}
