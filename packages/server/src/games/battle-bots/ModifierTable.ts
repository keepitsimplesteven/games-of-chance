// ─── Modifier Table ───────────────────────────────────────────────────────────
// Maps star counts (1-7) to combat multipliers.
// Server-side constant — NOT exposed in settings UI.

/** A single row in the modifier table for a given star count */
export interface ModifierEntry {
  damageMultiplier: number // applied to BASE_MAX_HIT
  accuracyMultiplier: number // applied to BASE_ACCURACY, result capped at MAX_ACCURACY
  attackEnergyPerTick: number // energy gained per tick
}

/**
 * Modifier table mapping star counts 1-7 to combat multipliers.
 * Table E5: equal ~2.5x ratios across all axes for tight raw balance.
 *   Speed: 12-28 EPT (2.33x ratio)
 *   Damage: 14-35 maxHit (2.5x ratio)
 *   Accuracy: 39-91% (2.3x ratio)
 * Per-matchup scalars handle precision balancing on top of these base values.
 */
export const MODIFIER_TABLE: Record<number, ModifierEntry> = {
  1: { damageMultiplier: 2.8, accuracyMultiplier: 0.70, attackEnergyPerTick: 12 },
  2: { damageMultiplier: 3.3, accuracyMultiplier: 0.82, attackEnergyPerTick: 14 },
  3: { damageMultiplier: 3.8, accuracyMultiplier: 0.96, attackEnergyPerTick: 16 },
  4: { damageMultiplier: 4.4, accuracyMultiplier: 1.12, attackEnergyPerTick: 19 },
  5: { damageMultiplier: 5.1, accuracyMultiplier: 1.30, attackEnergyPerTick: 22 },
  6: { damageMultiplier: 5.9, accuracyMultiplier: 1.48, attackEnergyPerTick: 25 },
  7: { damageMultiplier: 7.0, accuracyMultiplier: 1.64, attackEnergyPerTick: 28 },
}

// ─── Combat Base Constants ────────────────────────────────────────────────────

/** Base HP for all robots */
export const BASE_HP = 100

/** Base maximum hit value before modifiers. */
export const BASE_MAX_HIT = 5

/** Base accuracy percentage before modifiers. */
export const BASE_ACCURACY = 56

/** Maximum hit cap - no single hit can exceed this (minimum ~3-4 hits to kill) */
export const MAX_HIT_CAP = 35

/** Maximum accuracy percentage */
export const MAX_ACCURACY = 92

// ─── Stat Derivation ──────────────────────────────────────────────────────────

/**
 * Derives final combat stats from a robot's star distribution.
 *
 * - maxHit: min(floor(BASE_MAX_HIT * damageMultiplier), MAX_HIT_CAP), minimum 1
 * - accuracy: min(floor(BASE_ACCURACY * accuracyMultiplier), MAX_ACCURACY)
 * - energyPerTick: attackEnergyPerTick from modifier table
 * - hp: BASE_HP constant for all robots
 */
export function deriveCombatStats(stars: {
  damage: number
  accuracy: number
  speed: number
}): {
  maxHit: number
  accuracy: number
  energyPerTick: number
  hp: number
} {
  const damageEntry = MODIFIER_TABLE[stars.damage]
  const accuracyEntry = MODIFIER_TABLE[stars.accuracy]
  const speedEntry = MODIFIER_TABLE[stars.speed]

  const rawMaxHit = Math.floor(BASE_MAX_HIT * damageEntry.damageMultiplier)
  const maxHit = Math.min(Math.max(1, rawMaxHit), MAX_HIT_CAP)

  const rawAccuracy = Math.floor(BASE_ACCURACY * accuracyEntry.accuracyMultiplier)
  const accuracy = Math.min(rawAccuracy, MAX_ACCURACY)

  const energyPerTick = speedEntry.attackEnergyPerTick

  return {
    maxHit,
    accuracy,
    energyPerTick,
    hp: BASE_HP,
  }
}
