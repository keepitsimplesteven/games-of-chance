import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { ScoringMode } from "@games-of-chance/shared"

export default function LandingPage() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState("")
  const [scoringMode, setScoringMode] = useState<ScoringMode>("grand-prix")
  const [roomSize, setRoomSize] = useState(4)

  function handleCreateRoom() {
    const roomId = crypto.randomUUID()
    navigate(`/${roomId}`, { state: { scoringMode, roomSize } })
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = roomCode.trim()
    if (trimmed) {
      navigate(`/${trimmed}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Games of Chance</h1>
          <p className="mt-2 text-gray-400">Create or join a room to play</p>
        </div>

        {/* Scoring mode selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Scoring Mode
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScoringMode("grand-prix")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                scoringMode === "grand-prix"
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              🏆 Grand Prix
            </button>
            <button
              type="button"
              onClick={() => setScoringMode("chips")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                scoringMode === "chips"
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              🪙 Chips
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {scoringMode === "grand-prix"
              ? "Points awarded by placement each game"
              : "Raw scores accumulate across games"}
          </p>
        </div>

        {/* Room size selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Room Size
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRoomSize((s) => Math.max(2, s - 1))}
              disabled={roomSize <= 2}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="w-8 text-center text-lg font-semibold text-white">
              {roomSize}
            </span>
            <button
              type="button"
              onClick={() => setRoomSize((s) => Math.min(10, s + 1))}
              disabled={roomSize >= 10}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Total player slots (empty slots filled by bots)
          </p>
        </div>

        <button
          onClick={handleCreateRoom}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-lg font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
        >
          Create Room
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-sm text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        <form onSubmit={handleJoinRoom} className="space-y-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter room code"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!roomCode.trim()}
            className="w-full rounded-lg bg-gray-700 px-4 py-3 text-lg font-semibold text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  )
}
