import type { DamageNumberEffect } from './types'
import { ANIMATION_CONSTANTS } from './constants'

const {
  DAMAGE_FLOAT_MIN_PX,
  FAST_SPEED_THRESHOLD_MS,
  FAST_SPEED_CLAMP_FACTOR,
} = ANIMATION_CONSTANTS

/**
 * Compute vertical offset for stacked damage numbers.
 * Returns distinct offsets so multiple damage numbers don't overlap.
 * Each index gets a different vertical offset based on the minimum float distance.
 */
export function computeDamageNumberOffset(index: number, totalInTick: number): number {
  // Each stacked number gets offset by at least DAMAGE_FLOAT_MIN_PX
  // so they don't overlap when multiple hits land in the same tick
  return index * DAMAGE_FLOAT_MIN_PX
}

/**
 * Build damage number effect from hit event.
 * Returns null if hit === false.
 * Position starts at top-center of target bounds.
 * Duration uses gameSpeed directly when >= 150ms, else 0.9 * gameSpeed.
 */
export function buildDamageNumber(
  event: { hit: boolean; damage: number },
  targetBounds: { width: number; height: number },
  gameSpeed: number,
  stackIndex: number
): DamageNumberEffect | null {
  // No damage number for misses
  if (!event.hit) return null

  // Compute duration: gameSpeed if >= threshold, else clamped
  const durationMs = gameSpeed >= FAST_SPEED_THRESHOLD_MS
    ? gameSpeed
    : FAST_SPEED_CLAMP_FACTOR * gameSpeed

  return {
    value: event.damage,
    startPosition: { x: targetBounds.width / 2, y: 0 },
    color: 'var(--color-titleText)',
    durationMs,
    offsetIndex: stackIndex,
  }
}
