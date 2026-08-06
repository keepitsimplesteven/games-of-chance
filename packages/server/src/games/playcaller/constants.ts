import type { SettingsSchema } from "@games-of-chance/shared"

/** All tunable values for the Playcaller plugin */
export const PLAYCALLER = {
  /** Duration of the play clock per down (20 seconds for interactive play) */
  PICK_WINDOW_MS: 5_000,

  /** Brief delay after both picks are in before starting next down (shows result) */
  PLAY_RESULT_DELAY_MS: 500,

  /** Default score table: placement position → points */
  DEFAULT_SCORE_TABLE: [250, 125, 75, 50, 35, 25, 15, 10, 5, 5] as const,

  /** Minimum players for a valid bracket */
  MIN_PLAYERS: 2,

  /** Maximum players (matches room limit) */
  MAX_PLAYERS: 10,

  /** Minimum score table entries */
  SCORE_TABLE_MIN_ENTRIES: 2,

  /** Maximum score table entries */
  SCORE_TABLE_MAX_ENTRIES: 10,
} as const

export const PLAYCALLER_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: "SKIP_GAMEPLAY",
    label: "Skip Gameplay (random resolution)",
    type: "boolean",
    defaultValue: false,
  },
]
