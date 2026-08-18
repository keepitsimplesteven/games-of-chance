/**
 * Global bot decision timing configuration.
 *
 * All bot "thinking" delays across every game plugin should source their
 * timing from here so there's a single knob to tune for testing vs.
 * human-like simulation.
 */
export const BOT_TIMING = {
  /** Minimum delay before a bot submits a decision (ms) */
  DECISION_MIN_MS: 1_000,
  /** Maximum delay before a bot submits a decision (ms) */
  DECISION_MAX_MS: 5_000,
} as const

/**
 * Returns a random delay (in ms) within the configured bot decision range.
 * Use this anywhere a bot needs to "think" before acting.
 */
export function getBotDecisionDelay(): number {
  return (
    BOT_TIMING.DECISION_MIN_MS +
    Math.random() * (BOT_TIMING.DECISION_MAX_MS - BOT_TIMING.DECISION_MIN_MS)
  )
}
