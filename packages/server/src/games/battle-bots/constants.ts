import type { SettingsSchema } from "@games-of-chance/shared"

/** All tunable values for the Battle Bots plugin */
export const BATTLE_BOTS = {
  /** Duration of the prep/pick window in milliseconds */
  PICK_WINDOW_MS: 60_000,

  /** Default robot hit points */
  BOT_HP: 100,

  /** Default accuracy percentage (1-100 scale) */
  ACCURACY: 80,

  /** Default minimum damage per hit */
  DAMAGE_MIN: 1,

  /** Default maximum damage per hit */
  DAMAGE_MAX: 10,

  /** Battle tick interval in milliseconds (server-side, not player-visible) */
  TICK_RATE_MS: 250,

  /** Fixed number of rounds for this game */
  ROUND_COUNT: 3,

  /** Number of robot options presented per player in prep phase */
  ROBOT_OPTIONS_COUNT: 3,

  /** Chips-per-position multiplier (for Chips scoring mode) */
  CHIPS_MULTIPLIER: 10,
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
    key: "BOT_HP",
    label: "Robot HP",
    type: "number",
    defaultValue: BATTLE_BOTS.BOT_HP,
    constraints: { min: 10, max: 500, step: 10 },
  },
  {
    key: "DAMAGE_MIN",
    label: "Min damage",
    type: "number",
    defaultValue: BATTLE_BOTS.DAMAGE_MIN,
    constraints: { min: 1, max: 50, step: 1 },
  },
  {
    key: "DAMAGE_MAX",
    label: "Max damage",
    type: "number",
    defaultValue: BATTLE_BOTS.DAMAGE_MAX,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "ACCURACY",
    label: "Accuracy %",
    type: "number",
    defaultValue: BATTLE_BOTS.ACCURACY,
    constraints: { min: 10, max: 100, step: 5 },
  },
  {
    key: "CHIPS_MULTIPLIER",
    label: "Chips multiplier",
    type: "number",
    defaultValue: BATTLE_BOTS.CHIPS_MULTIPLIER,
    constraints: { min: 1, max: 100, step: 1 },
  },
]
