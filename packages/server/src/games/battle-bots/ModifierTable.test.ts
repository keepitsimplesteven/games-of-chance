import { describe, it, expect } from "vitest"
import {
  MODIFIER_TABLE,
  BASE_HP,
  BASE_MAX_HIT,
  BASE_ACCURACY,
  deriveCombatStats,
} from "./ModifierTable"
import type { ModifierEntry } from "./ModifierTable"

describe("ModifierTable constants", () => {
  it("BASE_HP is 100", () => {
    expect(BASE_HP).toBe(100)
  })

  it("BASE_MAX_HIT is 5", () => {
    expect(BASE_MAX_HIT).toBe(5)
  })

  it("BASE_ACCURACY is 56", () => {
    expect(BASE_ACCURACY).toBe(56)
  })
})

describe("MODIFIER_TABLE structure", () => {
  it("has entries for star counts 1 through 7", () => {
    for (let stars = 1; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars]).toBeDefined()
    }
  })

  it("does not have entries outside 1-7", () => {
    expect(MODIFIER_TABLE[0]).toBeUndefined()
    expect(MODIFIER_TABLE[8]).toBeUndefined()
  })

  it("all damage multipliers are at least 0.1", () => {
    for (let stars = 1; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars].damageMultiplier).toBeGreaterThanOrEqual(0.1)
    }
  })

  it("all accuracy multipliers are at least 0.1", () => {
    for (let stars = 1; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars].accuracyMultiplier).toBeGreaterThanOrEqual(0.1)
    }
  })

  it("all attackEnergyPerTick values are positive numbers > 0", () => {
    for (let stars = 1; stars <= 7; stars++) {
      const ept = MODIFIER_TABLE[stars].attackEnergyPerTick
      expect(ept).toBeGreaterThan(0)
    }
  })

  it("damage multipliers increase with star count", () => {
    for (let stars = 2; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars].damageMultiplier).toBeGreaterThan(
        MODIFIER_TABLE[stars - 1].damageMultiplier
      )
    }
  })

  it("accuracy multipliers increase with star count", () => {
    for (let stars = 2; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars].accuracyMultiplier).toBeGreaterThan(
        MODIFIER_TABLE[stars - 1].accuracyMultiplier
      )
    }
  })

  it("attackEnergyPerTick increases with star count (faster attacks)", () => {
    for (let stars = 2; stars <= 7; stars++) {
      expect(MODIFIER_TABLE[stars].attackEnergyPerTick).toBeGreaterThan(
        MODIFIER_TABLE[stars - 1].attackEnergyPerTick
      )
    }
  })
})

describe("deriveCombatStats", () => {
  it("returns hp equal to BASE_HP for any star distribution", () => {
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.hp).toBe(100)
  })

  it("computes maxHit as floor(BASE_MAX_HIT * damageMultiplier)", () => {
    // 3 stars: floor(5 * 0.8) = 4
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.maxHit).toBe(4)
  })

  it("ensures minimum maxHit of 1", () => {
    // 1 star: floor(5 * 0.4) = 2, still above 1
    const result = deriveCombatStats({ damage: 1, accuracy: 1, speed: 7 })
    expect(result.maxHit).toBeGreaterThanOrEqual(1)
  })

  it("computes accuracy as floor(BASE_ACCURACY * accuracyMultiplier)", () => {
    // 3 stars: floor(56 * 0.8) = 44
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.accuracy).toBe(44)
  })

  it("caps accuracy at 90", () => {
    // 7 stars: floor(56 * 1.6) = 89, under cap
    const result7 = deriveCombatStats({ damage: 1, accuracy: 7, speed: 1 })
    expect(result7.accuracy).toBeLessThanOrEqual(90)
  })

  it("7 accuracy stars produces hit chance in 80-90% range", () => {
    const result = deriveCombatStats({ damage: 1, accuracy: 7, speed: 1 })
    expect(result.accuracy).toBeGreaterThanOrEqual(80)
    expect(result.accuracy).toBeLessThanOrEqual(90)
  })

  it("uses attackEnergyPerTick from speed star entry", () => {
    // 3 speed stars: attackEnergyPerTick = 20.0
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.energyPerTick).toBe(20.0)
  })

  it("7 damage stars cannot kill from full HP in fewer than 10 max hits", () => {
    const result = deriveCombatStats({ damage: 7, accuracy: 1, speed: 1 })
    const hitsToKill = Math.ceil(BASE_HP / result.maxHit)
    expect(hitsToKill).toBeGreaterThanOrEqual(10)
  })

  it("all derived values are valid", () => {
    for (let d = 1; d <= 7; d++) {
      for (let a = 1; a <= 7; a++) {
        for (let s = 1; s <= 7; s++) {
          const result = deriveCombatStats({ damage: d, accuracy: a, speed: s })
          expect(result.maxHit).toBeGreaterThanOrEqual(1)
          expect(Number.isInteger(result.maxHit)).toBe(true)
          expect(result.accuracy).toBeGreaterThanOrEqual(1)
          expect(Number.isInteger(result.accuracy)).toBe(true)
          expect(result.energyPerTick).toBeGreaterThan(0)
          expect(result.hp).toBe(100)
        }
      }
    }
  })

  it("specific values for all star counts", () => {
    // Verify concrete computed values for each damage star
    const expectedMaxHits = [2, 3, 4, 5, 6, 8, 11] // floor(5 * multiplier) for stars 1-7
    for (let d = 1; d <= 7; d++) {
      const result = deriveCombatStats({ damage: d, accuracy: 1, speed: 1 })
      expect(result.maxHit).toBe(expectedMaxHits[d - 1])
    }

    // Verify concrete computed values for each accuracy star
    const expectedAccuracy = [22, 33, 44, 56, 67, 78, 89] // floor(56 * multiplier) for stars 1-7
    for (let a = 1; a <= 7; a++) {
      const result = deriveCombatStats({ damage: 1, accuracy: a, speed: 1 })
      expect(result.accuracy).toBe(expectedAccuracy[a - 1])
    }

    // Verify energyPerTick for each speed star
    const expectedEnergyPerTick = [10.5, 15.0, 20.0, 25.0, 31.5, 37.0, 44.2]
    for (let s = 1; s <= 7; s++) {
      const result = deriveCombatStats({ damage: 1, accuracy: 1, speed: s })
      expect(result.energyPerTick).toBe(expectedEnergyPerTick[s - 1])
    }
  })
})
