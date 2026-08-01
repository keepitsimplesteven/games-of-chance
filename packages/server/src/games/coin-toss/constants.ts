import type { SettingsSchema } from "@games-of-chance/shared"

/** All tunable values for the Coin Toss plugin */
export const COIN_TOSS = {
  /** Points awarded per correct guess */
  CORRECT_GUESS_CHIPS: 10,

  /** Duration of the pick window in milliseconds */
  PICK_WINDOW_MS: 10_000,

  /** Default number of rounds per game */
  MAX_ROUNDS: 10,

  /** Multiplier applied for consecutive correct guesses (future) */
  STREAK_MULTIPLIER: 2,

  /** Number of consecutive correct guesses needed to trigger streak bonus (future) */
  STREAK_THRESHOLD: 3,

  /** Maximum multiplier cap (future) */
  MAX_MULTIPLIER: 5,
} as const

export const COIN_TOSS_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: "CORRECT_GUESS_CHIPS",
    label: "Points per correct guess",
    type: "number",
    defaultValue: COIN_TOSS.CORRECT_GUESS_CHIPS,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "STREAK_MULTIPLIER",
    label: "Streak multiplier",
    type: "number",
    defaultValue: COIN_TOSS.STREAK_MULTIPLIER,
    constraints: { min: 1, max: 10, step: 0.5 },
  },
  {
    key: "STREAK_THRESHOLD",
    label: "Streak threshold",
    type: "number",
    defaultValue: COIN_TOSS.STREAK_THRESHOLD,
    constraints: { min: 2, max: 10, step: 1 },
  },
]
