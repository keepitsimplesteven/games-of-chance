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
 * Tuned via simulation to achieve 48-52% win rate for all 48 builds.
 * Higher damage multipliers at 6-7 include overkill budget buff per Req 3.8.
 */
export const MODIFIER_TABLE: Record<number, ModifierEntry> = {
  1: { damageMultiplier: 0.4, accuracyMultiplier: 0.4, attackEnergyPerTick: 10.5 },
  2: { damageMultiplier: 0.6, accuracyMultiplier: 0.6, attackEnergyPerTick: 15.0 },
  3: { damageMultiplier: 0.8, accuracyMultiplier: 0.8, attackEnergyPerTick: 20.0 },
  4: { damageMultiplier: 1.0, accuracyMultiplier: 1.0, attackEnergyPerTick: 25.0 },
  5: { damageMultiplier: 1.3, accuracyMultiplier: 1.2, attackEnergyPerTick: 31.5 },
  6: { damageMultiplier: 1.7, accuracyMultiplier: 1.4, attackEnergyPerTick: 37.0 },
  7: { damageMultiplier: 2.2, accuracyMultiplier: 1.6, attackEnergyPerTick: 44.2 },
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
