import { useState, useEffect } from "react"
import { RobotCard } from "./RobotCard"
import { useGameStore } from "../../../store/useGameStore"
import { useTheme } from "../../../theme"
import type { RobotVisualConfig } from "../assets/RobotParts"

export interface RobotOption {
  id: string
  name: string
  visualId: string
  visual?: RobotVisualConfig
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
  const theme = useTheme()
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
      <div className={`flex flex-col items-center gap-4 px-4 py-8 ${theme.font}`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#2a7a3a] bg-[#0f3d18]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-[#3a9a4a]"
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
        <h2 className={`text-xl font-bold ${theme.headingText}`}>Robot Locked In! ✓</h2>
        {chosenRobot && (
          <p className={theme.bodyText}>
            You chose <span className="font-semibold">{chosenRobot.name}</span>
          </p>
        )}
        <p className={`text-sm ${theme.mutedText}`}>Waiting for other players…</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-6 w-full px-4 py-8 ${theme.font}`}>
      {/* Countdown timer */}
      <div className="text-center">
        <p className={`text-sm uppercase tracking-wide ${theme.mutedText}`}>
          Choose your robot
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            secondsLeft <= 5 ? theme.statusDanger : theme.accentText
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
            visual={robot.visual}
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
        className={`min-h-[48px] min-w-[160px] rounded-md font-bold text-lg ${
          selectedId
            ? theme.btnPrimary
            : "bg-[#0f3d18] text-[#3a9a4a]/40 border-4 border-[#2a7a3a]/40 cursor-not-allowed"
        }`}
      >
        Lock In
      </button>

      {/* Hint */}
      <p className={`text-xs text-center ${theme.mutedText}`}>
        Select a robot and lock in before time runs out!
      </p>
    </div>
  )
}
