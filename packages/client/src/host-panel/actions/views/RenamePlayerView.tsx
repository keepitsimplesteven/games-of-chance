import { useState } from "react"
import { useGameStore } from "../../../store/useGameStore"

export default function RenamePlayerView() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const _socketSend = useGameStore((s) => s._socketSend)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [renamed, setRenamed] = useState<string | null>(null)

  // All non-host players (connected or disconnected)
  const targets = (roomState?.players ?? []).filter(
    (p) => p.id !== playerId && p.role !== "host"
  )

  const selectedPlayer = targets.find((p) => p.id === selectedTarget)

  function handleSubmit() {
    if (!selectedTarget || !newName.trim()) return
    if (_socketSend) {
      _socketSend({
        type: "RENAME_PLAYER",
        payload: { playerId: selectedTarget, newName: newName.trim() },
      })
    }
    setRenamed(newName.trim())
    setSelectedTarget(null)
    setNewName("")
  }

  // Brief success message after renaming
  if (renamed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-green-700 font-medium">
          Player has been renamed to {renamed}.
        </p>
        <button
          type="button"
          onClick={() => setRenamed(null)}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Rename another player
        </button>
      </div>
    )
  }

  // Name input + confirm dialog
  if (selectedTarget && selectedPlayer) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <p className="text-center text-gray-700">
          Rename <span className="font-bold">{selectedPlayer.name}</span>
        </p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New name"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          autoFocus
        />
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedTarget(null)
              setNewName("")
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!newName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Rename
          </button>
        </div>
      </div>
    )
  }

  // Target picker
  if (targets.length === 0) {
    return (
      <p className="py-4 text-center text-gray-500">
        No players available to rename.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="mb-2 font-semibold text-gray-800">Select a player to rename</h3>
      <ul className="space-y-2">
        {targets.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => setSelectedTarget(player.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{player.name}</span>
              {!player.connected && (
                <span className="text-xs text-gray-400">(disconnected)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
