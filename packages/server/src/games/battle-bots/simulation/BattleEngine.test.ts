import { describe, it, expect } from "vitest"
import { simulateBattle1v1, simulateFFA } from "./BattleEngine"
import type { RobotInstance } from "../types"

function makeRobot(overrides: Partial<RobotInstance> = {}): RobotInstance {
  return {
    templateId: "bot-alpha",
    ownerId: overrides.ownerId ?? "player-1",
    currentHp: 100,
    maxHp: 100,
    accuracy: 80,
    damageMin: 5,
    damageMax: 10,
    ...overrides,
  }
}

describe("simulateBattle1v1", () => {
  it("produces a winner and a loser", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    expect(result.winnerId).toBeDefined()
    expect(result.loserId).toBeDefined()
    expect(result.winnerId).not.toBe(result.loserId)
    expect([robot1.ownerId, robot2.ownerId]).toContain(result.winnerId)
    expect([robot1.ownerId, robot2.ownerId]).toContain(result.loserId)
  })

  it("generates a non-empty tick log", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    expect(result.tickLog.length).toBeGreaterThan(0)
  })

  it("tick numbers are sequential starting from 1", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    for (let i = 0; i < result.tickLog.length; i++) {
      expect(result.tickLog[i].tick).toBe(i + 1)
    }
  })

  it("each tick has exactly 2 attack results", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    for (const tick of result.tickLog) {
      expect(tick.attacks).toHaveLength(2)
    }
  })

  it("robot1 always attacks first in each tick", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    for (const tick of result.tickLog) {
      expect(tick.attacks[0].attackerId).toBe("p1")
      expect(tick.attacks[1].attackerId).toBe("p2")
    }
  })

  it("damage values fall within configured range when hit", () => {
    const robot1 = makeRobot({ ownerId: "p1", damageMin: 3, damageMax: 7 })
    const robot2 = makeRobot({ ownerId: "p2", damageMin: 3, damageMax: 7 })

    const result = simulateBattle1v1(robot1, robot2)

    for (const tick of result.tickLog) {
      for (const attack of tick.attacks) {
        if (attack.hit) {
          expect(attack.damage).toBeGreaterThanOrEqual(3)
          expect(attack.damage).toBeLessThanOrEqual(7)
        } else {
          expect(attack.damage).toBe(0)
        }
      }
    }
  })

  it("HP never goes below 0", () => {
    const robot1 = makeRobot({ ownerId: "p1" })
    const robot2 = makeRobot({ ownerId: "p2" })

    const result = simulateBattle1v1(robot1, robot2)

    for (const tick of result.tickLog) {
      for (const attack of tick.attacks) {
        expect(attack.targetHpAfter).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("100% accuracy robots always hit", () => {
    const robot1 = makeRobot({ ownerId: "p1", accuracy: 100 })
    const robot2 = makeRobot({ ownerId: "p2", accuracy: 100 })

    const result = simulateBattle1v1(robot1, robot2)

    for (const tick of result.tickLog) {
      for (const attack of tick.attacks) {
        expect(attack.hit).toBe(true)
      }
    }
  })

  it("terminates even with low accuracy robots", () => {
    const robot1 = makeRobot({ ownerId: "p1", accuracy: 10 })
    const robot2 = makeRobot({ ownerId: "p2", accuracy: 10 })

    const result = simulateBattle1v1(robot1, robot2)

    expect(result.winnerId).toBeDefined()
    expect(result.loserId).toBeDefined()
  })

  it("one-shot scenario: high damage, low HP", () => {
    const robot1 = makeRobot({
      ownerId: "p1",
      currentHp: 5,
      maxHp: 5,
      accuracy: 100,
      damageMin: 10,
      damageMax: 10,
    })
    const robot2 = makeRobot({
      ownerId: "p2",
      currentHp: 5,
      maxHp: 5,
      accuracy: 100,
      damageMin: 10,
      damageMax: 10,
    })

    const result = simulateBattle1v1(robot1, robot2)

    // Both KO in tick 1 — tiebreaker resolves it
    expect(result.tickLog).toHaveLength(1)
    expect(result.winnerId).toBeDefined()
    expect(result.loserId).toBeDefined()
    expect(result.winnerId).not.toBe(result.loserId)
  })
})


describe("simulateFFA", () => {
  it("produces an elimination order containing all participants", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
      makeRobot({ ownerId: "p4" }),
    ]

    const result = simulateFFA(participants)

    expect(result.eliminationOrder).toHaveLength(4)
    expect(new Set(result.eliminationOrder)).toEqual(
      new Set(["p1", "p2", "p3", "p4"])
    )
  })

  it("last entry in elimination order is the winner (last standing)", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
    ]

    const result = simulateFFA(participants)

    // The last entry is the survivor
    const winner = result.eliminationOrder[result.eliminationOrder.length - 1]
    expect(["p1", "p2", "p3"]).toContain(winner)
  })

  it("generates a non-empty tick log", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
    ]

    const result = simulateFFA(participants)

    expect(result.tickLog.length).toBeGreaterThan(0)
  })

  it("tick numbers are sequential starting from 1", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
    ]

    const result = simulateFFA(participants)

    for (let i = 0; i < result.tickLog.length; i++) {
      expect(result.tickLog[i].tick).toBe(i + 1)
    }
  })

  it("HP never goes below 0 in attack results", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
      makeRobot({ ownerId: "p4" }),
    ]

    const result = simulateFFA(participants)

    for (const tick of result.tickLog) {
      for (const attack of tick.attacks) {
        expect(attack.targetHpAfter).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("with 2 participants behaves like a 1v1 (one winner, one loser)", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
    ]

    const result = simulateFFA(participants)

    expect(result.eliminationOrder).toHaveLength(2)
    expect(result.eliminationOrder[0]).not.toBe(result.eliminationOrder[1])
  })

  it("damage values fall within configured range when hit", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1", damageMin: 2, damageMax: 6 }),
      makeRobot({ ownerId: "p2", damageMin: 2, damageMax: 6 }),
      makeRobot({ ownerId: "p3", damageMin: 2, damageMax: 6 }),
    ]

    const result = simulateFFA(participants)

    for (const tick of result.tickLog) {
      for (const attack of tick.attacks) {
        if (attack.hit) {
          expect(attack.damage).toBeGreaterThanOrEqual(2)
          expect(attack.damage).toBeLessThanOrEqual(6)
        } else {
          expect(attack.damage).toBe(0)
        }
      }
    }
  })

  it("eliminated robots do not attack in subsequent ticks", () => {
    const participants: RobotInstance[] = [
      makeRobot({ ownerId: "p1" }),
      makeRobot({ ownerId: "p2" }),
      makeRobot({ ownerId: "p3" }),
      makeRobot({ ownerId: "p4" }),
    ]

    const result = simulateFFA(participants)

    const eliminatedByTick = new Set<string>()
    for (const tick of result.tickLog) {
      // Check no eliminated robot is an attacker this tick
      for (const attack of tick.attacks) {
        expect(eliminatedByTick.has(attack.attackerId)).toBe(false)
      }
      // After processing attacks, mark newly eliminated
      // Find robots whose HP reached 0 in this tick's attacks
      const hpAfter = new Map<string, number>()
      for (const attack of tick.attacks) {
        hpAfter.set(attack.targetId, attack.targetHpAfter)
      }
      for (const [id, hp] of hpAfter) {
        if (hp <= 0) {
          eliminatedByTick.add(id)
        }
      }
    }
  })
})
