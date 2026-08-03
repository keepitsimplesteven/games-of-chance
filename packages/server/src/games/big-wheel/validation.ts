import { BIG_WHEEL } from "./constants"

export interface ReelStripValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a candidate reel strip array.
 * Checks that the strip has between 2 and 100 values,
 * and that all values are positive integers in [1, 10000].
 */
export function validateReelStrip(strip: number[]): ReelStripValidationResult {
  if (
    strip.length < BIG_WHEEL.REEL_STRIP_MIN_LENGTH ||
    strip.length > BIG_WHEEL.REEL_STRIP_MAX_LENGTH
  ) {
    return {
      valid: false,
      error: `Reel strip must have ${BIG_WHEEL.REEL_STRIP_MIN_LENGTH}\u2013${BIG_WHEEL.REEL_STRIP_MAX_LENGTH} values`,
    }
  }

  for (const value of strip) {
    if (
      !Number.isInteger(value) ||
      value < BIG_WHEEL.REEL_VALUE_MIN ||
      value > BIG_WHEEL.REEL_VALUE_MAX
    ) {
      return {
        valid: false,
        error: `All values must be integers between ${BIG_WHEEL.REEL_VALUE_MIN} and ${BIG_WHEEL.REEL_VALUE_MAX.toLocaleString()}`,
      }
    }
  }

  return { valid: true }
}
