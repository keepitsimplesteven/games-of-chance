import { useState } from "react"
import { Reorder } from "framer-motion"
import { useGameStore } from "../../../store/useGameStore"
import { buildSeedsRecord } from "../utils/seedUtils"

export default function SetSeedsView() {
  const roomState = useGameStore((s) => s.roomState)
  const _socketSend = useGameStore((s) => s._socketSend)
  const players = roomState?.players ?? []

  const [orderedIds, setOrderedIds] = useState<string[]>(
    () => players.map((p) => p.id)
  )
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (!_socketSend) return
    const seeds = buildSeedsRecord(orderedIds)
    _socketSend({ type: "SET_PLAYER_SEEDS", payload: { seeds } })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-green-400 font-medium">Seeds assigned successfully.</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
        >
          Reassign seeds
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-zinc-200">Assign Seed Order</h3>
      <p className="text-sm text-zinc-400">
        Drag to reorder. Seed 1 gets the best lottery odds.
      </p>

      <Reorder.Group
        axis="y"
        values={orderedIds}
        onReorder={setOrderedIds}
        className="space-y-2"
      >
        {orderedIds.map((id, index) => {
          const player = players.find((p) => p.id === id)
          return (
            <Reorder.Item
              key={id}
              value={id}
              className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 cursor-grab active:cursor-grabbing hover:bg-zinc-700 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="font-medium text-zinc-200">
                {player?.name ?? id}
              </span>
              {player && !player.connected && (
                <span className="text-xs text-zinc-500">(disconnected)</span>
              )}
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Set Seeds
      </button>
    </div>
  )
}
