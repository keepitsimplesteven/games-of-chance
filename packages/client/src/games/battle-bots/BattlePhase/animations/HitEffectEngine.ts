import type { WeaponHitType, HitEffect } from './types'
import { ANIMATION_CONSTANTS } from './constants'

const { WEAPON_SIZE_LIMITS, HIT_SVG_DURATION_MS, MISS_OPACITY } = ANIMATION_CONSTANTS

/**
 * Get max size percentage for a weapon type.
 * Returns the configured weapon size limit from WEAPON_SIZE_LIMITS.
 */
export function getWeaponSizeLimit(weaponType: WeaponHitType): number {
  return WEAPON_SIZE_LIMITS[weaponType]
}

/**
 * Compute randomized position within target bounds.
 * Returns { x, y } where x ∈ [0, targetWidth] and y ∈ [0, targetHeight].
 */
export function computeHitPosition(
  targetWidth: number,
  targetHeight: number,
  _index: number
): { x: number; y: number } {
  return {
    x: Math.random() * targetWidth,
    y: Math.random() * targetHeight,
  }
}

/**
 * Resolve a weapon string to a valid WeaponHitType.
 * Unknown weapon types default to 'drill'.
 */
function resolveWeaponType(weapon: string): WeaponHitType {
  if (weapon === 'blaster' || weapon === 'bazooka' || weapon === 'drill') {
    return weapon
  }
  return 'drill'
}

/**
 * Build a hit effect descriptor from an AttackEvent.
 * - Resolves weapon type (unknown → 'drill')
 * - Miss → opacity 0.3, Hit → opacity 1.0
 * - sizePct = weaponSizeLimit (from constants)
 * - durationMs = HIT_SVG_DURATION_MS (always 150)
 */
export function buildHitEffect(
  event: { hit: boolean; damage: number },
  attackerWeapon: string,
  attackerColor: string,
  targetBounds: { width: number; height: number },
  effectIndex: number
): HitEffect {
  const weaponType = resolveWeaponType(attackerWeapon)
  const position = computeHitPosition(targetBounds.width, targetBounds.height, effectIndex)
  const opacity = event.hit ? 1.0 : MISS_OPACITY
  const sizePct = getWeaponSizeLimit(weaponType)

  return {
    weaponType,
    color: attackerColor,
    position,
    opacity,
    sizePct,
    durationMs: HIT_SVG_DURATION_MS,
  }
}
