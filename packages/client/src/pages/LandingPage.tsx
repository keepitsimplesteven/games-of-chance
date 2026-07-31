import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function LandingPage() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState("")

  function handleCreateRoom() {
    const roomId = crypto.randomUUID()
    navigate(`/${roomId}`)
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
