import type { SettingsSchema } from "@games-of-chance/shared"

/** All tunable values for the Big Wheel plugin */
export const BIG_WHEEL = {
  /** Duration of the pick window in milliseconds (per spin) */
  PICK_WINDOW_MS: 15_000,

  /** Default reel strip — 20 values from 5 to 100 in increments of 5 */
  DEFAULT_REEL_STRIP: [15, 80, 35, 60, 20, 75, 40, 55, 95, 50, 85, 30, 65, 10, 45, 70, 25, 90, 5, 100],

  /** Minimum reel strip length */
  REEL_STRIP_MIN_LENGTH: 2,

  /** Maximum reel strip length */
  REEL_STRIP_MAX_LENGTH: 100,

  /** Minimum reel strip value */
  REEL_VALUE_MIN: 1,

  /** Maximum reel strip value */
  REEL_VALUE_MAX: 10_000,

  /** Number of spins per player turn */
  SPINS_PER_TURN: 2,

  /** Delay in ms for bot auto-advance (must exceed max wheel animation duration of ~5s) */
  BOT_SPIN_DELAY_MS: 5_500,
} as const

export const BIG_WHEEL_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: "REEL_STRIP",
    label: "Wheel values (comma-separated)",
    type: "number",
    defaultValue: 0,
    constraints: { min: BIG_WHEEL.REEL_STRIP_MIN_LENGTH, max: BIG_WHEEL.REEL_STRIP_MAX_LENGTH },
  },
]
