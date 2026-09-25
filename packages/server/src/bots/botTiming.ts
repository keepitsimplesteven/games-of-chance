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

/** Optional per-game override for bot decision timing */
export interface BotDelayRange {
  minMs: number
  maxMs: number
}

/**
 * Returns a random delay (in ms) within the configured bot decision range.
 * Use this anywhere a bot needs to "think" before acting.
 *
 * @param override - Optional game-specific delay range. Falls back to global BOT_TIMING if omitted.
 */
export function getBotDecisionDelay(override?: BotDelayRange): number {
  const min = override?.minMs ?? BOT_TIMING.DECISION_MIN_MS
  const max = override?.maxMs ?? BOT_TIMING.DECISION_MAX_MS
  return min + Math.random() * (max - min)
}
