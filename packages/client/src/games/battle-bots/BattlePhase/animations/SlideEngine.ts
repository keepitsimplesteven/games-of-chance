import type { SlideDecision, SlideEngineConfig } from './types'
import { ANIMATION_CONSTANTS } from './constants'

const {
  SLIDE_INTERVAL_TICKS,
  SLIDE_MIN_OFFSET_PCT,
  SLIDE_MAX_OFFSET_PCT,
  FFA_MAX_OFFSET_PCT,
  FAST_SPEED_THRESHOLD_MS,
  FAST_SPEED_CLAMP_FACTOR,
} = ANIMATION_CONSTANTS

/**
 * Compute slide trigger probability based on attacks per tick.
 * Returns min(1, attackCount / SLIDE_INTERVAL_TICKS) so that a robot
 * attacking once per tick slides on average once every 3 ticks.
 */
export function computeSlideProbability(attacksInTick: number): number {
  return Math.min(1, attacksInTick / SLIDE_INTERVAL_TICKS)
}

/**
 * Determine slide direction based on mode and position.
 * 1v1 left → 'right' (toward opponent), 1v1 right → 'left', FFA → 'down'.
 */
export function computeSlideDirection(
  mode: '1v1' | 'ffa',
  position: 'left' | 'right'
): 'left' | 'right' | 'down' {
  if (mode === 'ffa') return 'down'
  return position === 'left' ? 'right' : 'left'
}

/**
 * Compute slide offset within configured bounds.
 * 1v1: random between SLIDE_MIN_OFFSET_PCT and SLIDE_MAX_OFFSET_PCT of robotWidth
 * FFA: random between 0 (exclusive) and FFA_MAX_OFFSET_PCT of robotWidth (cell dimension)
 */
export function computeSlideOffset(robotWidth: number, mode: '1v1' | 'ffa'): number {
  if (mode === '1v1') {
    const min = SLIDE_MIN_OFFSET_PCT * robotWidth
    const max = SLIDE_MAX_OFFSET_PCT * robotWidth
    return min + Math.random() * (max - min)
  }
  // FFA: (0, FFA_MAX_OFFSET_PCT * robotWidth]
  const maxOffset = FFA_MAX_OFFSET_PCT * robotWidth
  // Generate value in (0, maxOffset] by using (1 - random) to avoid 0
  return maxOffset * (1 - Math.random() * (1 - Number.EPSILON))
}

/**
 * Compute animation duration with clamping.
 * If gameSpeed >= 150: return gameSpeed
 * If gameSpeed < 150: return 0.9 * gameSpeed
 */
export function computeAnimationDuration(gameSpeed: number): number {
  if (gameSpeed >= FAST_SPEED_THRESHOLD_MS) return gameSpeed
  return FAST_SPEED_CLAMP_FACTOR * gameSpeed
}

/**
 * Full slide decision for a given tick.
 * Returns { shouldSlide: false } for eliminated robots or when slides are disabled.
 * Otherwise uses random chance based on computeSlideProbability.
 */
export function evaluateSlide(
  attackerId: string,
  attacksInTick: number,
  config: SlideEngineConfig,
  isEliminated: boolean,
  position?: 'left' | 'right'
): SlideDecision {
  const noSlide: SlideDecision = {
    shouldSlide: false,
    direction: 'down',
    offsetPx: 0,
    durationMs: 0,
  }

  // Eliminated robots never slide
  if (isEliminated) return noSlide

  // Disabled slide flag prevents all slides
  if (!config.slideEnabled) return noSlide

  // Probabilistic trigger
  const probability = computeSlideProbability(attacksInTick)
  if (Math.random() >= probability) return noSlide

  const resolvedPosition = position ?? 'left'
  const direction = computeSlideDirection(config.mode, resolvedPosition)
  const offsetPx = computeSlideOffset(config.robotWidth, config.mode)
  const durationMs = computeAnimationDuration(config.gameSpeed)

  return {
    shouldSlide: true,
    direction,
    offsetPx,
    durationMs,
  }
}
