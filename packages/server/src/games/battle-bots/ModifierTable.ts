// ─── Modifier Table ───────────────────────────────────────────────────────────
// Maps star counts (1-7) to combat multipliers.
// Server-side constant — NOT exposed in settings UI.

/** A single row in the modifier table for a given star count */
export interface ModifierEntry {
  damageMultiplier: number // applied to BASE_MAX_HIT
  accuracyMultiplier: number // applied to BASE_ACCURACY, result capped at 90
  ticksPerAttack: number // tick interval between attacks (positive integer, min 1)
}

/**
 * Modifier table mapping star counts 1–7 to combat multipliers.
 * Tuned via simulation to achieve 48-52% win rate for all 48 builds.
 * Higher damage multipliers at 6-7 include overkill budget buff per Req 3.8.
 */
export const MODIFIER_TABLE: Record<number, ModifierEntry> = {
  1: { damageMultiplier: 0.4, accuracyMultiplier: 0.4, ticksPerAttack: 8 },
  2: { damageMultiplier: 0.6, accuracyMultiplier: 0.6, ticksPerAttack: 6 },
  3: { damageMultiplier: 0.8, accuracyMultiplier: 0.8, ticksPerAttack: 5 },
  4: { damageMultiplier: 1.0, accuracyMultiplier: 1.0, ticksPerAttack: 4 },
  5: { damageMultiplier: 1.3, accuracyMultiplier: 1.2, ticksPerAttack: 3 },
  6: { damageMultiplier: 1.7, accuracyMultiplier: 1.4, ticksPerAttack: 2 },
  7: { damageMultiplier: 2.2, accuracyMultiplier: 1.6, ticksPerAttack: 1 },
}

// ─── Combat Base Constants ────────────────────────────────────────────────────

/** Base HP for all robots (Req 12.1) */
export const BASE_HP = 100

/**
 * Base maximum hit value before modifiers.
 * At 7 Damage stars: floor(5 * 2.2) = 11 max hit → requires 10 hits to kill from 100 HP (Req 12.5)
 */
export const BASE_MAX_HIT = 5

/**
 * Base accuracy percentage before modifiers.
 * At 7 Accuracy stars: floor(56 * 1.6) = 89 → capped at 90 (Req 12.4)
 */
export const BASE_ACCURACY = 56

// ─── Stat Derivation ──────────────────────────────────────────────────────────

/**
 * Derives final combat stats from a robot's star distribution.
 *
 * - maxHit: floor(BASE_MAX_HIT * damageMultiplier), minimum 1 (Req 3.3, 3.6)
 * - accuracy: min(floor(BASE_ACCURACY * accuracyMultiplier), 90) (Req 3.4)
 * - tickInterval: ticksPerAttack from modifier table (Req 3.5)
 * - hp: BASE_HP constant for all robots (Req 12.1)
 */
export function deriveCombatStats(stars: {
  damage: number
  accuracy: number
  speed: number
}): {
  maxHit: number
  accuracy: number
  tickInterval: number
  hp: number
} {
  const damageEntry = MODIFIER_TABLE[stars.damage]
  const accuracyEntry = MODIFIER_TABLE[stars.accuracy]
  const speedEntry = MODIFIER_TABLE[stars.speed]

  const rawMaxHit = Math.floor(BASE_MAX_HIT * damageEntry.damageMultiplier)
  const maxHit = Math.max(1, rawMaxHit)

  const rawAccuracy = Math.floor(BASE_ACCURACY * accuracyEntry.accuracyMultiplier)
  const accuracy = Math.min(rawAccuracy, 90)

  const tickInterval = speedEntry.ticksPerAttack

  return {
    maxHit,
    accuracy,
    tickInterval,
    hp: BASE_HP,
  }
}
