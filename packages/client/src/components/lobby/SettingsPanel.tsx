import { useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import SchemaField from "./SchemaField"
import type { SettingsSchema, GameType } from "@games-of-chance/shared"

// ── Client-side settings schema lookup (hardcoded for now) ─────────────────

const COIN_TOSS_SCHEMA: SettingsSchema = [
  {
    key: "CORRECT_GUESS_CHIPS",
    label: "Points per correct guess",
    type: "number",
    defaultValue: 10,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "STREAK_MULTIPLIER",
    label: "Streak multiplier",
    type: "number",
    defaultValue: 2,
    constraints: { min: 1, max: 10, step: 0.5 },
  },
  {
    key: "STREAK_THRESHOLD",
    label: "Streak threshold",
    type: "number",
    defaultValue: 3,
    constraints: { min: 2, max: 10, step: 1 },
  },
]

function getSettingsSchema(gameType: GameType): SettingsSchema | undefined {
  switch (gameType) {
    case "coin-toss":
      return COIN_TOSS_SCHEMA
    default:
      return undefined
  }
}

// ── SettingsPanel Component ────────────────────────────────────────────────

/**
 * Schema-driven settings panel rendered inline in the lobby.
 * Only rendered for the host. Displays read-only with lock
 * indicator when settingsLocked is true.
 */
export default function SettingsPanel(): JSX.Element | null {
  const role = useGameStore((s) => s.role)
  const roomState = useGameStore((s) => s.roomState)
  const updateSettings = useGameStore((s) => s.updateSettings)
  const _socketSend = useGameStore((s) => s._socketSend)
  const theme = useTheme()

  const [tuningOpen, setTuningOpen] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  // Host-only access control
  if (role !== "host") return null
  if (!roomState) return null

  const { gameSettings, settingsLocked } = roomState
  const { room } = roomState
  const schema = getSettingsSchema(room.gameType)

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleRoundCountChange(value: number) {
    const clamped = Math.round(Math.min(50, Math.max(1, value)))
    updateSettings({ roundCount: clamped })
  }

  function handlePickWindowChange(valueInSeconds: number) {
    // Clamp between 3s and 60s, store in ms
    const clampedSeconds = Math.min(60, Math.max(3, valueInSeconds))
    updateSettings({ pickWindowMs: Math.round(clampedSeconds * 1000) })
  }

  function handleAutoModeToggle(enabled: boolean) {
    // Auto-mode lives on RoomConfig, use SET_AUTO_MODE message
    if (_socketSend) {
      _socketSend({
        type: "SET_AUTO_MODE",
        payload: { enabled, intervalMs: room.autoRoundIntervalMs },
      })
    }
  }

  function handleAutoIntervalChange(valueInSeconds: number) {
    // Clamp between 1s and 30s, store in ms
    const clampedSeconds = Math.min(30, Math.max(1, valueInSeconds))
    if (_socketSend) {
      _socketSend({
        type: "SET_AUTO_MODE",
        payload: { enabled: room.autoMode, intervalMs: Math.round(clampedSeconds * 1000) },
      })
    }
  }

  function handleTuningChange(key: string, value: number | boolean | string) {
    updateSettings({ tuning: { [key]: value } })
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Game Settings"
      className={`rounded-xl shadow-sm ${theme.card}`}
    >
      {/* Accordion header — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${isExpanded ? "" : ""}`}
      >
        <div className="flex items-center gap-2">
          <h2 className={`text-base font-bold ${theme.headingText}`}>Settings</h2>
          {settingsLocked && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${theme.statusNeutral}`}
              aria-label="Settings locked"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
              Locked
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${theme.mutedText} ${
            isExpanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex flex-col gap-4">
        {/* Round count */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="settings-round-count"
            className={`text-sm font-medium ${theme.bodyText}`}
          >
            Rounds per game
          </label>
          <input
            id="settings-round-count"
            type="number"
            value={gameSettings.roundCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val)) handleRoundCountChange(val)
            }}
            min={1}
            max={50}
            step={1}
            disabled={settingsLocked}
            className={`min-h-[44px] w-full rounded-lg border-2 bg-transparent px-3 py-2 text-base shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${theme.bodyText} ${theme.listItem}`}
          />
        </div>

        {/* Pick window duration (display in seconds) */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="settings-pick-window"
            className={`text-sm font-medium ${theme.bodyText}`}
          >
            Pick window (seconds)
          </label>
          <input
            id="settings-pick-window"
            type="number"
            value={Math.round(gameSettings.pickWindowMs / 1000)}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val)) handlePickWindowChange(val)
            }}
            min={3}
            max={60}
            step={1}
            disabled={settingsLocked}
            className={`min-h-[44px] w-full rounded-lg border-2 bg-transparent px-3 py-2 text-base shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${theme.bodyText} ${theme.listItem}`}
          />
        </div>

        {/* Auto-mode toggle */}
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="settings-auto-mode"
            className={`text-sm font-medium ${theme.bodyText}`}
          >
            Auto-mode
          </label>
          <button
            id="settings-auto-mode"
            type="button"
            role="switch"
            aria-checked={room.autoMode}
            onClick={() => handleAutoModeToggle(!room.autoMode)}
            disabled={settingsLocked}
            className={`relative inline-flex h-[28px] min-w-[44px] items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
              room.autoMode ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                room.autoMode ? "translate-x-[20px]" : "translate-x-[4px]"
              }`}
            />
          </button>
        </div>

        {/* Auto-mode interval (revealed when auto-mode is on) */}
        {room.autoMode && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="settings-auto-interval"
              className={`text-sm font-medium ${theme.bodyText}`}
            >
              Auto-round interval (seconds)
            </label>
            <input
              id="settings-auto-interval"
              type="number"
              value={Math.round(room.autoRoundIntervalMs / 1000)}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) handleAutoIntervalChange(val)
              }}
              min={1}
              max={30}
              step={1}
              disabled={settingsLocked}
              className={`min-h-[44px] w-full rounded-lg border-2 bg-transparent px-3 py-2 text-base shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${theme.bodyText} ${theme.listItem}`}
            />
          </div>
        )}

        {/* Collapsible "Game Tuning" section */}
        {schema && schema.length > 0 && (
          <div className="border-t border-current/10 pt-3">
            <button
              type="button"
              onClick={() => setTuningOpen(!tuningOpen)}
              aria-expanded={tuningOpen}
              className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 py-2 text-left text-sm font-bold transition ${theme.headingText}`}
            >
              <span>Game Tuning</span>
              <svg
                className={`h-4 w-4 transition-transform ${theme.mutedText} ${
                  tuningOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {tuningOpen && (
              <div className="mt-2 flex flex-col gap-4">
                {schema.map((field) => {
                  const val = gameSettings.tuning[field.key] ?? field.defaultValue
                  if (Array.isArray(val)) return null
                  return (
                    <SchemaField
                      key={field.key}
                      field={field}
                      value={val}
                      onChange={handleTuningChange}
                      disabled={settingsLocked}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      )}
    </section>
  )
}
