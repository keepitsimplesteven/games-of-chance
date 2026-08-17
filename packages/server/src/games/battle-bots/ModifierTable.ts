// ─── Modifier Table ───────────────────────────────────────────────────────────
// Maps star counts (1-7) to combat multipliers.
// Server-side constant — NOT exposed in settings UI.

/** A single row in the modifier table for a given star count */
export interface ModifierEntry {
  damageMultiplier: number // applied to BASE_MAX_HIT
  accuracyMultiplier: number // applied to BASE_ACCURACY, result capped at 90
  attackEnergyPerTick: number // energy gained per tick (replaces ticksPerAttack)
}

/**
 * Modifier table mapping star counts 1–7 to combat multipliers.
 * Tuned via simulation to achieve 49-51% win rate for all 28 builds.
 * Speed uses geometric progression: 12–50 energyPerTick.
 * Damage uses convex scaling to compensate for high-maxHit variance.
 * Accuracy cap: floor(56 × mult) ≤ 90.
 */
export const MODIFIER_TABLE: Record<number, ModifierEntry> = {
  1: { damageMultiplier: 4.41, accuracyMultiplier: 0.3225, attackEnergyPerTick: 12 },
  2: { damageMultiplier: 5.81, accuracyMultiplier: 0.4117, attackEnergyPerTick: 15 },
  3: { damageMultiplier: 7.61, accuracyMultiplier: 0.5189, attackEnergyPerTick: 19 },
  4: { damageMultiplier: 10.01, accuracyMultiplier: 0.6617, attackEnergyPerTick: 24 },
  5: { damageMultiplier: 13.01, accuracyMultiplier: 0.8582, attackEnergyPerTick: 31 },
  6: { damageMultiplier: 16.81, accuracyMultiplier: 1.1082, attackEnergyPerTick: 39 },
  7: { damageMultiplier: 21.81, accuracyMultiplier: 1.4117, attackEnergyPerTick: 50 },
}

// ─── Combat Base Constants ────────────────────────────────────────────────────

/** Base HP for all robots (Req 12.1) */
export const BASE_HP = 100

/**
 * Base maximum hit value before modifiers.
 * At 7 Damage stars: floor(5 * 21.81) = 109 max hit
 */
export const BASE_MAX_HIT = 5

/**
 * Base accuracy percentage before modifiers.
 * At 7 Accuracy stars: floor(56 * 1.4117) = 79
 */
export const BASE_ACCURACY = 56

// ─── Stat Derivation ──────────────────────────────────────────────────────────

/**
 * Derives final combat stats from a robot's star distribution.
 *
 * - maxHit: floor(BASE_MAX_HIT * damageMultiplier), minimum 1 (Req 3.3, 3.6)
 * - accuracy: min(floor(BASE_ACCURACY * accuracyMultiplier), 90) (Req 3.4)
 * - energyPerTick: attackEnergyPerTick from modifier table (Req 5.4)
 * - hp: BASE_HP constant for all robots (Req 12.1)
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
  const maxHit = Math.max(1, rawMaxHit)

  const rawAccuracy = Math.floor(BASE_ACCURACY * accuracyEntry.accuracyMultiplier)
  const accuracy = Math.min(rawAccuracy, 90)

  const energyPerTick = speedEntry.attackEnergyPerTick

  return {
    maxHit,
    accuracy,
    energyPerTick,
    hp: BASE_HP,
  }
}
