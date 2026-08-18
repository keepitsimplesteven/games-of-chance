import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { ScoringMode, ProgressionMode } from "@games-of-chance/shared"
import { useTheme } from "../theme"

export default function LandingPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [roomCode, setRoomCode] = useState("")
  const [scoringMode, setScoringMode] = useState<ScoringMode>("chips")
  const [progressionMode, setProgressionMode] = useState<ProgressionMode>("tournament")
  const [roomSize, setRoomSize] = useState(4)
  const [draftPickEnabled, setDraftPickEnabled] = useState(false)
  const [skipGameplay, setSkipGameplay] = useState(true)

  function handleCreateRoom() {
    const roomId = crypto.randomUUID()
    navigate(`/${roomId}`, { state: { scoringMode, progressionMode, roomSize, draftPickEnabled: progressionMode === "lottery" ? draftPickEnabled : undefined, skipGameplay: progressionMode === "lottery" ? skipGameplay : undefined } })
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = roomCode.trim()
    if (trimmed) {
      navigate(`/${trimmed}`)
    }
  }

  const toggleActive = theme.btnPrimary
  const toggleInactive = theme.btnGhost

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className={`text-3xl font-bold uppercase tracking-widest ${theme.titleText}`}>
            Games of Chance
          </h1>
          <p className={`mt-2 text-sm ${theme.mutedText}`}>Create or join a room to play</p>
        </div>

        {/* Scoring mode selector */}
        <div className="space-y-2">
          <label className={`block text-sm font-bold uppercase tracking-wider ${theme.headingText}`}>
            Scoring Mode
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScoringMode("chips")}
              className={`flex-1 px-3 py-2 text-sm font-bold uppercase transition ${
                scoringMode === "chips" ? toggleActive : toggleInactive
              }`}
            >
              🪙 Chips
            </button>
            <button
              type="button"
              onClick={() => setScoringMode("grand-prix")}
              className={`flex-1 px-3 py-2 text-sm font-bold uppercase transition ${
                scoringMode === "grand-prix" ? toggleActive : toggleInactive
              }`}
            >
              🏆 Grand Prix
            </button>
          </div>
          <p className={`text-xs ${theme.mutedText}`}>
            {scoringMode === "grand-prix"
              ? "Points awarded by placement each game"
              : "Raw scores accumulate across games"}
          </p>
        </div>

        {/* Progression mode selector */}
        <div className="space-y-2">
          <label className={`block text-sm font-bold uppercase tracking-wider ${theme.headingText}`}>
            Progression Mode
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProgressionMode("endless")}
              className={`flex-1 px-3 py-2 text-sm font-bold uppercase transition ${
                progressionMode === "endless" ? toggleActive : toggleInactive
              }`}
            >
              ♾️ Endless
            </button>
            <button
              type="button"
              onClick={() => setProgressionMode("tournament")}
              className={`flex-1 px-3 py-2 text-sm font-bold uppercase transition ${
                progressionMode === "tournament" ? toggleActive : toggleInactive
              }`}
            >
              🏆 Tournament
            </button>
            <button
              type="button"
              onClick={() => setProgressionMode("lottery")}
              className={`flex-1 px-3 py-2 text-sm font-bold uppercase transition ${
                progressionMode === "lottery" ? toggleActive : toggleInactive
              }`}
            >
              🎰 Lottery
            </button>
          </div>
          <p className={`text-xs ${theme.mutedText}`}>
            {progressionMode === "tournament"
              ? "Each game played once, building to a finale"
              : progressionMode === "lottery"
              ? "Lottery determines final placement, play to earn draft picks"
              : "Play any game as many times as you want"}
          </p>
          {progressionMode === "lottery" && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraftPickEnabled(!draftPickEnabled)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase transition ${
                    draftPickEnabled ? toggleActive : toggleInactive
                  }`}
                >
                  Draft Pick {draftPickEnabled ? "ON" : "OFF"}
                </button>
                <span className={`text-xs ${theme.mutedText}`}>
                  {draftPickEnabled
                    ? "Players draft their bracket position after lottery"
                    : "Lottery placement used directly"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSkipGameplay(!skipGameplay)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase transition ${
                    skipGameplay ? toggleActive : toggleInactive
                  }`}
                >
                  Auto-Play {skipGameplay ? "ON" : "OFF"}
                </button>
                <span className={`text-xs ${theme.mutedText}`}>
                  {skipGameplay
                    ? "Games resolve instantly (results only)"
                    : "Full interactive drive gameplay"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Room size selector */}
        <div className="space-y-2">
          <label className={`block text-sm font-bold uppercase tracking-wider ${theme.headingText}`}>
            Room Size
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRoomSize((s) => Math.max(2, s - 1))}
              disabled={roomSize <= 2}
              className={`flex h-10 w-10 items-center justify-center text-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${theme.btnGhost}`}
            >
              −
            </button>
            <span className={`w-8 text-center text-lg font-bold ${theme.accentText}`}>
              {roomSize}
            </span>
            <button
              type="button"
              onClick={() => setRoomSize((s) => Math.min(10, s + 1))}
              disabled={roomSize >= 10}
              className={`flex h-10 w-10 items-center justify-center text-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${theme.btnGhost}`}
            >
              +
            </button>
          </div>
          <p className={`text-xs ${theme.mutedText}`}>
            Total player slots (empty slots filled by bots)
          </p>
        </div>

        <button
          onClick={handleCreateRoom}
          className={`w-full px-4 py-3 text-lg font-bold uppercase tracking-wider ${theme.btnPrimary}`}
        >
          Create Room
        </button>

        <div className="flex items-center gap-3">
          <div className={`h-px flex-1 opacity-30 ${theme.mutedText} bg-current`} />
          <span className={`text-sm ${theme.mutedText}`}>or</span>
          <div className={`h-px flex-1 opacity-30 ${theme.mutedText} bg-current`} />
        </div>

        <form onSubmit={handleJoinRoom} className="space-y-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter room code"
            className={`w-full px-4 py-3 border-2 bg-transparent placeholder:opacity-50 focus:outline-none ${theme.bodyText} ${theme.listItem}`}
          />
          <button
            type="submit"
            disabled={!roomCode.trim()}
            className={`w-full px-4 py-3 text-lg font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${theme.btnSecondary}`}
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  )
}
