import { useState, useEffect } from "react"
import { RobotCard } from "./RobotCard"
import { useGameStore } from "../../../store/useGameStore"

export interface RobotOption {
  id: string
  name: string
  visualId: string
  hp: number
  accuracy: number
  damageMin: number
  damageMax: number
}

export interface RobotSelectorProps {
  options: RobotOption[]
  pickDeadlineMs: number | null
}

/**
 * RobotSelector — Displays 3 robot options for selection during Prep Phase (Round 1).
 *
 * Shows a countdown timer, 3 RobotCards in a row, and a "Lock In" button.
 * After the pick is submitted and acknowledged, shows a confirmed state.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */
export function RobotSelector({ options, pickDeadlineMs }: RobotSelectorProps) {
  const submitPick = useGameStore((s) => s.submitPick)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    pickDeadlineMs ? Math.max(0, Math.ceil((pickDeadlineMs - Date.now()) / 1000)) : 0
  )

  // Countdown timer — updates every 100ms for smooth display
  useEffect(() => {
    if (pickDeadlineMs === null) return

    const tick = () => {
      const remaining = Math.max(0, (pickDeadlineMs - Date.now()) / 1000)
      setSecondsLeft(Math.ceil(remaining))
    }

    tick()

    const intervalId = setInterval(tick, 100)
    return () => clearInterval(intervalId)
  }, [pickDeadlineMs])

  const handleLockIn = () => {
    if (!selectedId) return
    submitPick({ robotTemplateId: selectedId })
  }

  // Confirmed state after pick is acknowledged
  if (pickSubmitted) {
    const chosenRobot = options.find((r) => r.id === selectedId)
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Robot Locked In! ✓</h2>
        {chosenRobot && (
          <p className="text-gray-600">
            You chose <span className="font-semibold">{chosenRobot.name}</span>
          </p>
        )}
        <p className="text-sm text-gray-400">Waiting for other players…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full px-4 py-8">
      {/* Countdown timer */}
      <div className="text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">
          Choose your robot
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            secondsLeft <= 5 ? "text-red-500" : "text-gray-900"
          }`}
        >
          {secondsLeft}s
        </p>
      </div>

      {/* Robot cards — 3 side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {options.map((robot) => (
          <RobotCard
            key={robot.id}
            id={robot.id}
            name={robot.name}
            visualId={robot.visualId}
            hp={robot.hp}
            accuracy={robot.accuracy}
            damageMin={robot.damageMin}
            damageMax={robot.damageMax}
            isSelected={selectedId === robot.id}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {/* Lock In button */}
      <button
        type="button"
        onClick={handleLockIn}
        disabled={!selectedId}
        className={`min-h-[48px] min-w-[160px] rounded-xl font-bold text-lg transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          selectedId
            ? "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white focus:ring-green-400"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        Lock In
      </button>

      {/* Hint */}
      <p className="text-xs text-gray-400 text-center">
        Select a robot and lock in before time runs out!
      </p>
    </div>
  )
}
