import { useState } from "react"
import { useGameStore } from "../../../store/useGameStore"

type ScoreType = "game" | "session"

interface AdjustmentForm {
  targetId: string
  targetName: string
  scoreType: ScoreType
  delta: number
  reason: string
}

export default function AdjustScoreView() {
  const roomState = useGameStore((s) => s.roomState)
  const adjustScore = useGameStore((s) => s.adjustScore)

  const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string } | null>(null)
  const [scoreType, setScoreType] = useState<ScoreType>("game")
  const [delta, setDelta] = useState<string>("")
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState<AdjustmentForm | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const players = roomState?.players ?? []

  // After successful submission
  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="font-medium text-green-700">Score adjustment applied.</p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setSelectedTarget(null)
            setScoreType("game")
            setDelta("")
            setReason("")
          }}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Make another adjustment
        </button>
      </div>
    )
  }

  // Step 4: Confirmation dialog
  if (confirming) {
    const sign = confirming.delta >= 0 ? "+" : ""
    return (
      <div className="flex flex-col gap-4 py-4">
        <h3 className="text-center font-semibold text-gray-800">Confirm Score Adjustment</h3>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Player</dt>
              <dd className="font-medium text-gray-800">{confirming.targetName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Score Type</dt>
              <dd className="font-medium text-gray-800 capitalize">{confirming.scoreType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Adjustment</dt>
              <dd className="font-bold text-gray-800">
                {sign}{confirming.delta}
              </dd>
            </div>
            {confirming.reason && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Reason</dt>
                <dd className="font-medium text-gray-800">{confirming.reason}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              adjustScore(
                confirming.targetId,
                confirming.delta,
                confirming.scoreType,
                confirming.reason || undefined
              )
              setConfirming(null)
              setSubmitted(true)
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    )
  }

  // Step 1: Target selection
  if (!selectedTarget) {
    if (players.length === 0) {
      return (
        <p className="py-4 text-center text-gray-500">
          No players available.
        </p>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <h3 className="mb-2 font-semibold text-gray-800">Select a player</h3>
        <ul className="space-y-2">
          {players.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => setSelectedTarget({ id: player.id, name: player.name })}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="font-medium text-gray-800">{player.name}</span>
                {player.role === "host" && (
                  <span className="ml-auto text-xs text-gray-400">Host</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Steps 2-3-4: Score type, delta, reason form
  const parsedDelta = parseInt(delta, 10)
  const isDeltaValid = delta !== "" && !isNaN(parsedDelta) && parsedDelta !== 0

  function handleSubmit() {
    if (!selectedTarget || !isDeltaValid) return
    setConfirming({
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      scoreType,
      delta: parsedDelta,
      reason: reason.trim(),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selected target display */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
        <span className="text-sm text-gray-600">
          Adjusting score for <span className="font-bold text-gray-800">{selectedTarget.name}</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedTarget(null)}
          className="text-xs text-blue-600 hover:underline"
        >
          Change
        </button>
      </div>

      {/* Score type picker */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">Score Type</legend>
        <div className="flex gap-3">
          <label
            className={`flex-1 cursor-pointer rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors ${
              scoreType === "game"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="scoreType"
              value="game"
              checked={scoreType === "game"}
              onChange={() => setScoreType("game")}
              className="sr-only"
            />
            Game
          </label>
          <label
            className={`flex-1 cursor-pointer rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors ${
              scoreType === "session"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="scoreType"
              value="session"
              checked={scoreType === "session"}
              onChange={() => setScoreType("session")}
              className="sr-only"
            />
            Session
          </label>
        </div>
      </fieldset>

      {/* Delta input */}
      <div>
        <label htmlFor="score-delta" className="mb-1 block text-sm font-medium text-gray-700">
          Points (positive or negative)
        </label>
        <input
          id="score-delta"
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="e.g. +5 or -3"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {delta !== "" && !isDeltaValid && (
          <p className="mt-1 text-xs text-red-500">Enter a non-zero integer.</p>
        )}
      </div>

      {/* Optional reason */}
      <div>
        <label htmlFor="score-reason" className="mb-1 block text-sm font-medium text-gray-700">
          Reason <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="score-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Bonus for winning streak"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Submit button */}
      <button
        type="button"
        disabled={!isDeltaValid}
        onClick={handleSubmit}
        className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        Review Adjustment
      </button>
    </div>
  )
}
