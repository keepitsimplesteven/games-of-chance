import { useState } from "react"
import { useGameStore } from "../../../store/useGameStore"

export default function ReassignHostView() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const reassignHost = useGameStore((s) => s.reassignHost)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [reassigned, setReassigned] = useState<string | null>(null)

  // Filter to connected non-host players
  const targets = (roomState?.players ?? []).filter(
    (p) => p.id !== playerId && p.connected && p.role !== "host"
  )

  const selectedPlayer = targets.find((p) => p.id === selectedTarget)

  function handleConfirm() {
    if (!selectedTarget) return
    reassignHost(selectedTarget)
    setReassigned(selectedTarget)
    setSelectedTarget(null)
  }

  // Brief success message after reassignment
  if (reassigned) {
    const reassignedName =
      roomState?.players.find((p) => p.id === reassigned)?.name ?? "Player"
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-green-700 font-medium">
          {reassignedName} is now the host.
        </p>
      </div>
    )
  }

  // Confirmation dialog
  if (selectedTarget && selectedPlayer) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <p className="text-center text-gray-700">
          Are you sure you want to make{" "}
          <span className="font-bold">{selectedPlayer.name}</span> the new host?
          You will lose host privileges.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedTarget(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    )
  }

  // Target picker
  if (targets.length === 0) {
    return (
      <p className="py-4 text-center text-gray-500">
        No players available to reassign host to.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="mb-2 font-semibold text-gray-800">
        Select a player to make host
      </h3>
      <ul className="space-y-2">
        {targets.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => setSelectedTarget(player.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{player.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
