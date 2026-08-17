import type { SettingsSchema } from "@games-of-chance/shared"

/** All tunable values for the Battle Bots plugin */
export const BATTLE_BOTS = {
  /** Duration of the prep/pick window in milliseconds */
  PICK_WINDOW_MS: 60_000,

  /** Fixed number of rounds for this game */
  ROUND_COUNT: 3,

  /** Chips-per-position multiplier (for Chips scoring mode) */
  CHIPS_MULTIPLIER: 10,

  /** Maximum number of ticks before a battle is force-terminated */
  TICK_LIMIT: 1000,

  /** Duration of the VS screen before replay begins (milliseconds) */
  VS_SCREEN_DURATION_MS: 4000,

  // Legacy constants (used by pre-overhaul plugin code until task 4 migration)
  BOT_HP: 100,
  ACCURACY: 80,
  DAMAGE_MIN: 1,
  DAMAGE_MAX: 10,
} as const

export const BATTLE_BOTS_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: "PREP_TIMER_MS",
    label: "Prep timer (seconds)",
    type: "number",
    defaultValue: 60,
    constraints: { min: 10, max: 300, step: 5 },
  },
  {
    key: "CHIPS_MULTIPLIER",
    label: "Chips multiplier",
    type: "number",
    defaultValue: 10,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "GAME_SPEED",
    label: "Game speed (ms per tick)",
    type: "number",
    defaultValue: 500,
    constraints: { min: 50, max: 500, step: 10 },
  },
]
