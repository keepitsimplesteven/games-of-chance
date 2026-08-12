/**
 * Property-based tests for BattleEngine (1v1 and FFA simulations)
 *
 * Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 7.5
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { simulateBattle1v1, simulateFFA } from "./BattleEngine"
import type { RobotInstance } from "../types"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generates a valid RobotInstance with constrained stats */
function robotInstanceArb(ownerId: string): fc.Arbitrary<RobotInstance> {
  return fc
    .record({
      hp: fc.integer({ min: 10, max: 500 }),
      accuracy: fc.integer({ min: 10, max: 100 }),
      damageMin: fc.integer({ min: 1, max: 50 }),
      damageMaxOffset: fc.integer({ min: 1, max: 50 }),
    })
    .map(({ hp, accuracy, damageMin, damageMaxOffset }) => ({
      templateId: "template-1",
      ownerId,
      currentHp: hp,
      maxHp: hp,
      accuracy,
      damageMin,
      damageMax: damageMin + damageMaxOffset,
    }))
}

/** Generates a pair of robot instances for 1v1 */
const robot1v1PairArb = fc
  .tuple(robotInstanceArb("player-1"), robotInstanceArb("player-2"))

/** Generates a list of 3-8 robot instances for FFA */
const ffaParticipantsArb = fc
  .integer({ min: 3, max: 8 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) =>
        robotInstanceArb(`player-${i}`)
      )
    )
  )
  .map((tuple) => tuple as RobotInstance[])

// ── Helper: clone robot instances to avoid mutation issues ──────────────────

function cloneRobot(r: RobotInstance): RobotInstance {
  return { ...r }
}

// ── Property: HP Monotonicity ──────────────────────────────────────────────

describe("Property: HP Monotonicity", () => {
  /**
   * Robot HP is monotonically non-increasing across ticks.
   * For each robot, HP at tick N+1 <= HP at tick N.
   *
   * **Validates: Requirements 5.1**
   */
  it("1v1: robot HP never increases between ticks", () => {
    fc.assert(
      fc.property(robot1v1PairArb, ([r1, r2]) => {
        const robot1 = cloneRobot(r1)
        const robot2 = cloneRobot(r2)
        const result = simulateBattle1v1(robot1, robot2)

        // Track HP for each robot across ticks
        let hp1 = r1.currentHp
        let hp2 = r2.currentHp

        for (const tick of result.tickLog) {
          for (const attack of tick.attacks) {
            if (attack.targetId === "player-1") {
              expect(attack.targetHpAfter).toBeLessThanOrEqual(hp1)
              hp1 = attack.targetHpAfter
            } else if (attack.targetId === "player-2") {
              expect(attack.targetHpAfter).toBeLessThanOrEqual(hp2)
              hp2 = attack.targetHpAfter
            }
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it("FFA: robot HP never increases between ticks", () => {
    fc.assert(
      fc.property(ffaParticipantsArb, (participants) => {
        const cloned = participants.map(cloneRobot)
        const result = simulateFFA(cloned)

        // Track HP per player across ticks
        const hpMap: Record<string, number> = {}
        for (const p of participants) {
          hpMap[p.ownerId] = p.currentHp
        }

        for (const tick of result.tickLog) {
          for (const attack of tick.attacks) {
            expect(attack.targetHpAfter).toBeLessThanOrEqual(
              hpMap[attack.targetId]
            )
            hpMap[attack.targetId] = attack.targetHpAfter
          }
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ── Property: Battle Termination ───────────────────────────────────────────

describe("Property: Battle Termination", () => {
  /**
   * Every battle terminates — at least one robot reaches 0 HP (1v1)
   * or only one robot remains alive (FFA).
   *
   * **Validates: Requirements 5.3**
   */
  it("1v1: battle always terminates with a winner and loser", () => {
    fc.assert(
      fc.property(robot1v1PairArb, ([r1, r2]) => {
        const robot1 = cloneRobot(r1)
        const robot2 = cloneRobot(r2)
        const result = simulateBattle1v1(robot1, robot2)

        // Must have a winner and loser
        expect(result.winnerId).toBeTruthy()
        expect(result.loserId).toBeTruthy()
        expect(result.winnerId).not.toBe(result.loserId)

        // Winner and loser must be from the two participants
        expect([r1.ownerId, r2.ownerId]).toContain(result.winnerId)
        expect([r1.ownerId, r2.ownerId]).toContain(result.loserId)

        // Tick log must be non-empty (at least one tick happened)
        expect(result.tickLog.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })

  it("FFA: battle always terminates with exactly one survivor", () => {
    fc.assert(
      fc.property(ffaParticipantsArb, (participants) => {
        const cloned = participants.map(cloneRobot)
        const result = simulateFFA(cloned)

        // Elimination order includes all participants (eliminated + survivor at end)
        expect(result.eliminationOrder.length).toBe(participants.length)

        // Last entry in eliminationOrder is the survivor (winner)
        const survivor = result.eliminationOrder[result.eliminationOrder.length - 1]
        expect(participants.map((p) => p.ownerId)).toContain(survivor)
        expect(result.survivorId).toBe(survivor)

        // Tick log must be non-empty
        expect(result.tickLog.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })
})

// ── Property: Damage Bounds ────────────────────────────────────────────────

describe("Property: Damage Bounds", () => {
  /**
   * All damage values in the tick log fall within the attacker's [damageMin, damageMax].
   *
   * **Validates: Requirements 5.4, 5.5**
   */
  it("1v1: all damage values are within attacker's [1, damageMax] or 0 (GSR negation)", () => {
    fc.assert(
      fc.property(robot1v1PairArb, ([r1, r2]) => {
        const robot1 = cloneRobot(r1)
        const robot2 = cloneRobot(r2)
        const result = simulateBattle1v1(robot1, robot2)

        for (const tick of result.tickLog) {
          for (const attack of tick.attacks) {
            if (attack.hit) {
              // Damage can be 0 if GSR negated it, otherwise in [1, damageMax]
              if (attack.damage > 0) {
                expect(attack.damage).toBeGreaterThanOrEqual(1)
                expect(attack.damage).toBeLessThanOrEqual(attack.attackerId === r1.ownerId ? r1.damageMax : r2.damageMax)
              }
            } else {
              expect(attack.damage).toBe(0)
            }
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it("FFA: all damage values are within attacker's [1, damageMax] or 0 (GSR negation)", () => {
    fc.assert(
      fc.property(ffaParticipantsArb, (participants) => {
        const cloned = participants.map(cloneRobot)
        const result = simulateFFA(cloned)

        // Build a lookup from ownerId to original stats
        const statsMap: Record<string, { damageMin: number; damageMax: number }> = {}
        for (const p of participants) {
          statsMap[p.ownerId] = { damageMin: p.damageMin, damageMax: p.damageMax }
        }

        for (const tick of result.tickLog) {
          for (const attack of tick.attacks) {
            if (attack.hit) {
              // Damage can be 0 if GSR negated it, otherwise in [1, damageMax]
              if (attack.damage > 0) {
                const stats = statsMap[attack.attackerId]
                expect(attack.damage).toBeGreaterThanOrEqual(1)
                expect(attack.damage).toBeLessThanOrEqual(stats.damageMax)
              }
            } else {
              expect(attack.damage).toBe(0)
            }
          }
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ── Property: Elimination Finality (FFA) ───────────────────────────────────

describe("Property: Elimination Finality", () => {
  /**
   * Once eliminated, a robot never appears as attacker or target in subsequent ticks.
   *
   * **Validates: Requirements 5.6, 7.5**
   */
  it("FFA: eliminated robots never appear as attacker or target in subsequent ticks", () => {
    fc.assert(
      fc.property(ffaParticipantsArb, (participants) => {
        const cloned = participants.map(cloneRobot)
        const result = simulateFFA(cloned)

        const eliminated = new Set<string>()

        for (const tick of result.tickLog) {
          // Check that no eliminated robot participates in this tick
          for (const attack of tick.attacks) {
            expect(eliminated.has(attack.attackerId)).toBe(false)
            expect(eliminated.has(attack.targetId)).toBe(false)
          }

          // After processing attacks for this tick, determine who got eliminated
          // A robot is eliminated if targetHpAfter reaches 0 for it in this tick
          const eliminatedThisTick = new Set<string>()
          for (const attack of tick.attacks) {
            if (attack.targetHpAfter <= 0) {
              eliminatedThisTick.add(attack.targetId)
            }
          }
          for (const id of eliminatedThisTick) {
            eliminated.add(id)
          }
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ── Property: Simultaneous KO Resolution ───────────────────────────────────

describe("Property: Simultaneous KO Resolution", () => {
  /**
   * When both robots reach 0 HP in the same tick, exactly one winner is always
   * produced (never a tie result).
   *
   * We use high-accuracy, high-damage, low-HP robots to increase the probability
   * of simultaneous KOs.
   *
   * **Validates: Requirements 5.6, 5.7**
   */
  it("1v1: simultaneous KO always produces exactly one winner (never a tie)", () => {
    // Use robots tuned to maximize chances of simultaneous KO:
    // high accuracy + high damage relative to HP
    const simultaneousKOArb = fc
      .record({
        hp: fc.integer({ min: 10, max: 30 }),
        accuracy: fc.integer({ min: 80, max: 100 }),
        damageMin: fc.integer({ min: 5, max: 20 }),
        damageMaxOffset: fc.integer({ min: 1, max: 15 }),
      })
      .map(({ hp, accuracy, damageMin, damageMaxOffset }) => ({
        robot1: {
          templateId: "template-1",
          ownerId: "player-1",
          currentHp: hp,
          maxHp: hp,
          accuracy,
          damageMin,
          damageMax: damageMin + damageMaxOffset,
        } as RobotInstance,
        robot2: {
          templateId: "template-2",
          ownerId: "player-2",
          currentHp: hp,
          maxHp: hp,
          accuracy,
          damageMin,
          damageMax: damageMin + damageMaxOffset,
        } as RobotInstance,
      }))

    fc.assert(
      fc.property(simultaneousKOArb, ({ robot1, robot2 }) => {
        const r1 = cloneRobot(robot1)
        const r2 = cloneRobot(robot2)
        const result = simulateBattle1v1(r1, r2)

        // Must always produce exactly one winner and one loser
        expect(result.winnerId).toBeTruthy()
        expect(result.loserId).toBeTruthy()
        expect(result.winnerId).not.toBe(result.loserId)
        expect(new Set([result.winnerId, result.loserId])).toEqual(
          new Set(["player-1", "player-2"])
        )
      }),
      { numRuns: 500 }
    )
  })
})
