import { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "../../../theme"
import { useGameStore } from "../../../store/useGameStore"
import { CompositeRobot, type WeaponType, type HeadType, type BodyType } from "../assets/RobotParts"
import { StarDisplay } from "./StarDisplay"

// ── Part option arrays (order matters: first item = default selection) ──

const WEAPONS: WeaponType[] = ["drill", "blaster", "bazooka"]
const HEADS: HeadType[] = ["square", "rounded", "triangular", "hexagonal"]
const BODIES: BodyType[] = ["square", "rounded", "triangular", "hexagonal"]

/** Color palette for robot customization */
const COLORS = [
  "#e53935", // red
  "#1e88e5", // blue
  "#43a047", // green
  "#fb8c00", // orange
  "#8e24aa", // purple
  "#00acc1", // cyan
  "#f4511e", // deep orange
  "#7cb342", // light green
]

const COLOR_DISPLAY_NAMES: Record<string, string> = {
  "#e53935": "Red",
  "#1e88e5": "Blue",
  "#43a047": "Green",
  "#fb8c00": "Orange",
  "#8e24aa": "Purple",
  "#00acc1": "Cyan",
  "#f4511e": "Deep Orange",
  "#7cb342": "Lime",
}

const WEAPON_DISPLAY_NAMES: Record<WeaponType, string> = {
  drill: "Drill",
  blaster: "Blaster",
  bazooka: "Bazooka",
}

// ── Star contribution mappings (mirrors server PartDefinitions) ──

const WEAPON_STARS: Record<WeaponType, { damage: number; accuracy: number; speed: number }> = {
  drill: { damage: 1, accuracy: 0, speed: 2 },
  blaster: { damage: 1, accuracy: 2, speed: 0 },
  bazooka: { damage: 3, accuracy: 0, speed: 0 },
}

const HEAD_STARS: Record<HeadType, { damage: number; accuracy: number; speed: number }> = {
  square: { damage: 1, accuracy: 1, speed: 1 },
  rounded: { damage: 0, accuracy: 1, speed: 2 },
  triangular: { damage: 0, accuracy: 3, speed: 0 },
  hexagonal: { damage: 2, accuracy: 1, speed: 0 },
}

const BODY_STARS: Record<BodyType, { damage: number; accuracy: number; speed: number }> = {
  square: { damage: 1, accuracy: 1, speed: 1 },
  rounded: { damage: 0, accuracy: 0, speed: 3 },
  triangular: { damage: 0, accuracy: 2, speed: 1 },
  hexagonal: { damage: 2, accuracy: 0, speed: 1 },
}

// ── Props ──

export interface PartCarouselProps {
  pickDeadlineMs: number | null
}

/**
 * PartCarousel — Three-row carousel for building a robot (weapon, head, body).
 *
 * Each row has left/right arrow navigation with wrap-around.
 * Only the weapon row displays the part name (chip style); head and body
 * are shown as visual changes to the robot SVG preview.
 *
 * Includes countdown timer, Lock In, Randomize, and auto-submit on timer expiry.
 *
 * Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6, 9.7, 9.8
 */
export function PartCarousel({ pickDeadlineMs }: PartCarouselProps) {
  const theme = useTheme()
  const submitPick = useGameStore((s) => s.submitPick)
  const pickSubmitted = useGameStore((s) => s.pickSubmitted)

  const [weaponIndex, setWeaponIndex] = useState(() => Math.floor(Math.random() * WEAPONS.length))
  const [headIndex, setHeadIndex] = useState(() => Math.floor(Math.random() * HEADS.length))
  const [bodyIndex, setBodyIndex] = useState(() => Math.floor(Math.random() * BODIES.length))
  const [colorIndex, setColorIndex] = useState(() => Math.floor(Math.random() * COLORS.length))
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const selectedWeapon = WEAPONS[weaponIndex]
  const selectedHead = HEADS[headIndex]
  const selectedBody = BODIES[bodyIndex]
  const selectedColor = COLORS[colorIndex]

  // Compute star totals from current selection
  const stars = {
    damage: WEAPON_STARS[selectedWeapon].damage + HEAD_STARS[selectedHead].damage + BODY_STARS[selectedBody].damage,
    accuracy: WEAPON_STARS[selectedWeapon].accuracy + HEAD_STARS[selectedHead].accuracy + BODY_STARS[selectedBody].accuracy,
    speed: WEAPON_STARS[selectedWeapon].speed + HEAD_STARS[selectedHead].speed + BODY_STARS[selectedBody].speed,
  }

  // ── Countdown timer — updates every 100ms for smooth display ──

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    pickDeadlineMs ? Math.max(0, Math.ceil((pickDeadlineMs - Date.now()) / 1000)) : 0
  )

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

  // ── Wrap-around navigation helpers ──

  const cycleIndex = (current: number, total: number, direction: 1 | -1): number => {
    return (current + direction + total) % total
  }

  // ── Lock In handler ──

  const hasAutoSubmitted = useRef(false)

  const handleLockIn = useCallback(() => {
    if (locked) return
    setShowConfirmModal(true)
  }, [locked])

  const handleConfirmLockIn = useCallback(() => {
    if (locked) return
    setShowConfirmModal(false)
    setLocked(true)
    setError(null)

    try {
      submitPick({ weapon: selectedWeapon, head: selectedHead, body: selectedBody, color: selectedColor })
    } catch {
      // Re-enable controls on failure
      setLocked(false)
      setError("Failed to submit. Please try again.")
    }
  }, [locked, submitPick, selectedWeapon, selectedHead, selectedBody, selectedColor])

  const handleCancelLockIn = useCallback(() => {
    setShowConfirmModal(false)
  }, [])

  // ── Timer expiry: auto-submit current configuration (bypasses modal) ──

  useEffect(() => {
    if (secondsLeft <= 0 && !locked && !hasAutoSubmitted.current && pickDeadlineMs !== null) {
      hasAutoSubmitted.current = true
      setShowConfirmModal(false)
      setLocked(true)
      try {
        submitPick({ weapon: selectedWeapon, head: selectedHead, body: selectedBody, color: selectedColor })
      } catch {
        setLocked(false)
      }
    }
  }, [secondsLeft, locked, pickDeadlineMs, submitPick, selectedWeapon, selectedHead, selectedBody, selectedColor])

  // ── Randomize handler ──

  const handleRandomize = () => {
    if (locked) return
    setWeaponIndex(Math.floor(Math.random() * WEAPONS.length))
    setHeadIndex(Math.floor(Math.random() * HEADS.length))
    setBodyIndex(Math.floor(Math.random() * BODIES.length))
    setColorIndex(Math.floor(Math.random() * COLORS.length))
  }

  // ── Confirmed state after pick is acknowledged ──

  if (pickSubmitted) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 px-4 py-4 ${theme.font}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#2a7a3a] bg-[#0f3d18]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-[#3a9a4a]"
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
        <h2 className={`text-lg font-bold ${theme.headingText}`}>Robot Locked In! ✓</h2>
        <div className="flex items-center justify-center">
          <CompositeRobot
            config={{
              headType: selectedHead,
              bodyType: selectedBody,
              weaponType: selectedWeapon,
              color: selectedColor,
            }}
            size={80}
          />
        </div>
        <StarDisplay damage={stars.damage} accuracy={stars.accuracy} speed={stars.speed} />
        <p className={`text-sm ${theme.mutedText}`}>Waiting for other players…</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-4 w-full px-4 py-4 lg:gap-6 lg:py-8 ${theme.font}`}>
      {/* Countdown timer */}
      <div className="text-center">
        <p className={`text-xs lg:text-sm uppercase tracking-wide ${theme.mutedText}`}>
          Build your robot
        </p>
        <p
          className={`text-2xl lg:text-3xl font-bold tabular-nums ${
            secondsLeft <= 5 ? theme.statusDanger : theme.accentText
          }`}
        >
          {secondsLeft}s
        </p>
      </div>

      {/* Robot preview */}
      <div className="flex items-center justify-center">
        <CompositeRobot
          config={{
            headType: selectedHead,
            bodyType: selectedBody,
            weaponType: selectedWeapon,
            color: selectedColor,
          }}
          size={96}
          className="lg:hidden"
        />
        <CompositeRobot
          config={{
            headType: selectedHead,
            bodyType: selectedBody,
            weaponType: selectedWeapon,
            color: selectedColor,
          }}
          size={128}
          className="hidden lg:block"
        />
      </div>

      {/* Star display */}
      <StarDisplay damage={stars.damage} accuracy={stars.accuracy} speed={stars.speed} />

      {/* Carousel rows */}
      <div className="flex flex-col gap-3 w-full max-w-xs lg:gap-4">
        {/* Weapon row */}
        <CarouselRow
          label="Weapon"
          displayValue={WEAPON_DISPLAY_NAMES[selectedWeapon]}
          onLeft={() => setWeaponIndex(cycleIndex(weaponIndex, WEAPONS.length, -1))}
          onRight={() => setWeaponIndex(cycleIndex(weaponIndex, WEAPONS.length, 1))}
          disabled={locked}
        />

        {/* Head row */}
        <CarouselRow
          label="Head"
          displayValue={null}
          onLeft={() => setHeadIndex(cycleIndex(headIndex, HEADS.length, -1))}
          onRight={() => setHeadIndex(cycleIndex(headIndex, HEADS.length, 1))}
          disabled={locked}
        />

        {/* Body row */}
        <CarouselRow
          label="Body"
          displayValue={null}
          onLeft={() => setBodyIndex(cycleIndex(bodyIndex, BODIES.length, -1))}
          onRight={() => setBodyIndex(cycleIndex(bodyIndex, BODIES.length, 1))}
          disabled={locked}
        />

        {/* Color row */}
        <CarouselRow
          label="Color"
          displayValue={COLOR_DISPLAY_NAMES[selectedColor] ?? "Custom"}
          onLeft={() => setColorIndex(cycleIndex(colorIndex, COLORS.length, -1))}
          onRight={() => setColorIndex(cycleIndex(colorIndex, COLORS.length, 1))}
          disabled={locked}
          colorSwatch={selectedColor}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleRandomize}
          disabled={locked}
          className={`min-h-[48px] min-w-[120px] rounded-md font-bold text-base ${
            locked
              ? "bg-[#0f3d18] text-[#3a9a4a]/40 border-4 border-[#2a7a3a]/40 cursor-not-allowed"
              : theme.btnSecondary
          }`}
        >
          Randomize
        </button>

        <button
          type="button"
          onClick={handleLockIn}
          disabled={locked}
          className={`min-h-[48px] min-w-[120px] rounded-md font-bold text-base ${
            locked
              ? "bg-[#0f3d18] text-[#3a9a4a]/40 border-4 border-[#2a7a3a]/40 cursor-not-allowed"
              : theme.btnPrimary
          }`}
        >
          Lock In
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <p className={`text-sm ${theme.statusDanger}`} role="alert">
          {error}
        </p>
      )}

      {/* Hint */}
      <p className={`text-xs text-center ${theme.mutedText}`}>
        Choose your parts and lock in before time runs out!
      </p>

      {/* Lock-in confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl px-6 py-6 shadow-lg ${theme.listItem}`}>
            <span className="text-4xl" aria-hidden="true">🤖</span>
            <h2 className={`text-lg font-bold text-center ${theme.titleText}`}>
              Are you sure you want to LOCK IN?
            </h2>
            <p className={`text-sm text-center ${theme.mutedText}`}>
              You cannot modify your robot once it's built.
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={handleCancelLockIn}
                className={`flex-1 min-h-[48px] rounded-md font-bold text-base ${theme.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLockIn}
                className={`flex-1 min-h-[48px] rounded-md font-bold text-base ${theme.btnPrimary}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CarouselRow sub-component ──

interface CarouselRowProps {
  label: string
  /** If non-null, show as a chip-style badge. Null = visual-only (no text name). */
  displayValue: string | null
  onLeft: () => void
  onRight: () => void
  disabled?: boolean
  /** Optional color hex to show as a swatch next to the label */
  colorSwatch?: string
}

function CarouselRow({ label, displayValue, onLeft, onRight, disabled = false, colorSwatch }: CarouselRowProps) {
  const theme = useTheme()

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Left arrow */}
      <button
        type="button"
        onClick={onLeft}
        disabled={disabled}
        aria-label={`Previous ${label}`}
        className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-md ${
          disabled ? "opacity-40 cursor-not-allowed" : theme.btnGhost
        }`}
      >
        <ChevronLeft />
      </button>

      {/* Label + optional chip value */}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <span className={`text-xs uppercase tracking-wide ${theme.mutedText}`}>
          {label}
        </span>
        {displayValue !== null && (
          <span
            className={`text-xs px-2 py-0.5 rounded border-2 border-[#2a7a3a] ${theme.mutedText} font-semibold uppercase tracking-wide flex items-center gap-1.5`}
          >
            {colorSwatch && (
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/30"
                style={{ backgroundColor: colorSwatch }}
              />
            )}
            {displayValue}
          </span>
        )}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={onRight}
        disabled={disabled}
        aria-label={`Next ${label}`}
        className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-md ${
          disabled ? "opacity-40 cursor-not-allowed" : theme.btnGhost
        }`}
      >
        <ChevronRight />
      </button>
    </div>
  )
}

// ── Chevron SVG icons ──

function ChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}
