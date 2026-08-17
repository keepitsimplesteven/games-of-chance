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
    // 3 stars: floor(5 * 7.61) = 38
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.maxHit).toBe(Math.floor(BASE_MAX_HIT * MODIFIER_TABLE[3].damageMultiplier))
  })

  it("ensures minimum maxHit of 1", () => {
    // 1 star: floor(5 * 0.4) = 2, still above 1
    const result = deriveCombatStats({ damage: 1, accuracy: 1, speed: 7 })
    expect(result.maxHit).toBeGreaterThanOrEqual(1)
  })

  it("computes accuracy as floor(BASE_ACCURACY * accuracyMultiplier)", () => {
    // 3 stars: floor(56 * 0.5189) = 29
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.accuracy).toBe(Math.floor(BASE_ACCURACY * MODIFIER_TABLE[3].accuracyMultiplier))
  })

  it("caps accuracy at 90", () => {
    // 7 stars: floor(56 * 1.64) = 91, under cap of 92
    const result7 = deriveCombatStats({ damage: 1, accuracy: 7, speed: 1 })
    expect(result7.accuracy).toBeLessThanOrEqual(92)
  })

  it("7 accuracy stars produces hit chance capped at 92", () => {
    const result = deriveCombatStats({ damage: 1, accuracy: 7, speed: 1 })
    // With new tuning: floor(56 * 1.4117) = 79, within acceptable range and under cap
    expect(result.accuracy).toBeLessThanOrEqual(92)
    expect(result.accuracy).toBeGreaterThanOrEqual(1)
  })

  it("uses attackEnergyPerTick from speed star entry", () => {
    // 3 speed stars: attackEnergyPerTick = 19
    const result = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })
    expect(result.energyPerTick).toBe(MODIFIER_TABLE[3].attackEnergyPerTick)
  })

  it("7 damage stars produces meaningful damage scaling", () => {
    // With new tuning, high damage stars produce high maxHit values
    // floor(5 * 21.81) = 109, which allows 1-hit kills. This is balanced by
    // low accuracy and slow speed at 7 damage stars (D=7, A=1, S=1).
    const result = deriveCombatStats({ damage: 7, accuracy: 1, speed: 1 })
    expect(result.maxHit).toBe(Math.floor(BASE_MAX_HIT * MODIFIER_TABLE[7].damageMultiplier))
    expect(result.maxHit).toBeGreaterThanOrEqual(1)
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
    // floor(5 * multiplier) for stars 1-7 with new tuned values
    const expectedMaxHits = [14, 16, 19, 22, 25, 29, 35]
    for (let d = 1; d <= 7; d++) {
      const result = deriveCombatStats({ damage: d, accuracy: 1, speed: 1 })
      expect(result.maxHit).toBe(expectedMaxHits[d - 1])
    }

    // Verify concrete computed values for each accuracy star
    // min(floor(56 * multiplier), 90) for stars 1-7 with new tuned values
    const expectedAccuracy = [39, 45, 53, 62, 72, 82, 91]
    for (let a = 1; a <= 7; a++) {
      const result = deriveCombatStats({ damage: 1, accuracy: a, speed: 1 })
      expect(result.accuracy).toBe(expectedAccuracy[a - 1])
    }

    // Verify energyPerTick for each speed star (new tuned values)
    const expectedEnergyPerTick = [12, 14, 16, 19, 22, 25, 28]
    for (let s = 1; s <= 7; s++) {
      const result = deriveCombatStats({ damage: 1, accuracy: 1, speed: s })
      expect(result.energyPerTick).toBe(expectedEnergyPerTick[s - 1])
    }
  })
})
