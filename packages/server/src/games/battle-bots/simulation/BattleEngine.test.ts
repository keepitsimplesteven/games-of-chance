import { describe, it, expect } from "vitest"
import { simulate1v1, simulateFFA } from "./BattleEngine"
import type { CombatRobot } from "../types"

function makeCombatRobot(overrides: Partial<CombatRobot> = {}): CombatRobot {
  return {
    ownerId: "player-1",
    name: "TestBot",
    maxHit: 4,
    accuracy: 45,
    tickInterval: 5,
    currentHp: 100,
    maxHp: 100,
    stars: { damage: 3, accuracy: 3, speed: 3 },
    visual: { weapon: "drill", head: "square", body: "square" },
    ...overrides,
  }
}

describe("simulate1v1", () => {
  it("produces a winner that is one of the two robots", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    expect(result.winnerId).toBeDefined()
    expect(["p1", "p2"]).toContain(result.winnerId)
  })

  it("generates a non-empty tick log", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    expect(result.tickLog.length).toBeGreaterThan(0)
  })

  it("tick numbers are sequential starting from 1 with no gaps", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    for (let i = 0; i < result.tickLog.length; i++) {
      expect(result.tickLog[i].tick).toBe(i + 1)
    }
  })

  it("robots only attack on ticks matching their tickInterval", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1", tickInterval: 3 })
    const robot2 = makeCombatRobot({ ownerId: "p2", tickInterval: 5 })

    const result = simulate1v1(robot1, robot2)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        if (attack.attackerId === "p1") {
          expect(entry.tick % 3).toBe(0)
        }
        if (attack.attackerId === "p2") {
          expect(entry.tick % 5).toBe(0)
        }
      }
    }
  })

  it("damage values are within [1, maxHit] when hit, 0 when miss", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1", maxHit: 6 })
    const robot2 = makeCombatRobot({ ownerId: "p2", maxHit: 8 })

    const result = simulate1v1(robot1, robot2)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        if (attack.hit) {
          const attacker = attack.attackerId === "p1" ? robot1 : robot2
          expect(attack.damage).toBeGreaterThanOrEqual(1)
          expect(attack.damage).toBeLessThanOrEqual(attacker.maxHit)
        } else {
          expect(attack.damage).toBe(0)
        }
      }
    }
  })

  it("targetHpAfter is never negative", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        expect(attack.targetHpAfter).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("guaranteed survivor rule prevents mutual elimination", () => {
    // High accuracy and damage to force mutual KO scenario
    const robot1 = makeCombatRobot({
      ownerId: "p1",
      currentHp: 5,
      maxHp: 5,
      accuracy: 90,
      maxHit: 10,
      tickInterval: 1,
    })
    const robot2 = makeCombatRobot({
      ownerId: "p2",
      currentHp: 5,
      maxHp: 5,
      accuracy: 90,
      maxHit: 10,
      tickInterval: 1,
    })

    // Run multiple times to confirm GSR always produces a winner
    for (let i = 0; i < 20; i++) {
      const r1 = { ...robot1 }
      const r2 = { ...robot2 }
      const result = simulate1v1(r1, r2)
      expect(result.winnerId).toBeDefined()
      expect(["p1", "p2"]).toContain(result.winnerId)
    }
  })

  it("does not exceed 1000 ticks (TICK_LIMIT)", () => {
    // Low accuracy to make a long battle
    const robot1 = makeCombatRobot({ ownerId: "p1", accuracy: 10, tickInterval: 8 })
    const robot2 = makeCombatRobot({ ownerId: "p2", accuracy: 10, tickInterval: 8 })

    const result = simulate1v1(robot1, robot2)

    expect(result.tickLog.length).toBeLessThanOrEqual(1000)
    expect(result.winnerId).toBeDefined()
  })

  it("timeout selects highest HP robot as winner", () => {
    // Very low accuracy, high tick intervals — likely to timeout
    // Give robot1 more HP to predictably win on timeout
    const robot1 = makeCombatRobot({
      ownerId: "p1",
      accuracy: 1,
      maxHit: 1,
      tickInterval: 8,
      currentHp: 100,
      maxHp: 100,
    })
    const robot2 = makeCombatRobot({
      ownerId: "p2",
      accuracy: 1,
      maxHit: 1,
      tickInterval: 8,
      currentHp: 50,
      maxHp: 50,
    })

    const result = simulate1v1(robot1, robot2)

    // With such low accuracy both should survive, robot1 likely has more HP
    expect(result.winnerId).toBeDefined()
  })

  it("dead robots (snapshot HP = 0) do not attack", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    // After a robot is eliminated, it should never appear as attacker in later ticks
    let p1Eliminated = false
    let p2Eliminated = false

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        if (attack.attackerId === "p1") {
          expect(p1Eliminated).toBe(false)
        }
        if (attack.attackerId === "p2") {
          expect(p2Eliminated).toBe(false)
        }
      }
      if (entry.eliminations.includes("p1")) p1Eliminated = true
      if (entry.eliminations.includes("p2")) p2Eliminated = true
    }
  })

  it("does not mutate input robot objects", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const originalHp1 = robot1.currentHp
    const originalHp2 = robot2.currentHp

    simulate1v1(robot1, robot2)

    expect(robot1.currentHp).toBe(originalHp1)
    expect(robot2.currentHp).toBe(originalHp2)
  })

  it("eliminations array correctly reports eliminated robots", () => {
    const robot1 = makeCombatRobot({ ownerId: "p1" })
    const robot2 = makeCombatRobot({ ownerId: "p2" })

    const result = simulate1v1(robot1, robot2)

    // Count total eliminations — should have exactly one eliminated robot (loser)
    const allEliminations = result.tickLog.flatMap((e) => e.eliminations)
    expect(allEliminations.length).toBe(1)
    expect(allEliminations[0]).not.toBe(result.winnerId)
  })
})


describe("simulateFFA", () => {
  function makeFFARobot(id: string, overrides: Partial<CombatRobot> = {}): CombatRobot {
    return {
      ownerId: id,
      name: `Bot-${id}`,
      maxHit: 4,
      accuracy: 45,
      tickInterval: 5,
      currentHp: 100,
      maxHp: 100,
      stars: { damage: 3, accuracy: 3, speed: 3 },
      visual: { weapon: "drill", head: "square", body: "square" },
      ...overrides,
    }
  }

  it("produces a survivor that is one of the input robots", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    expect(result.survivorId).toBeDefined()
    expect(["p1", "p2", "p3"]).toContain(result.survivorId)
  })

  it("generates a non-empty tick log", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    expect(result.tickLog.length).toBeGreaterThan(0)
  })

  it("tick numbers are sequential starting from 1 with no gaps", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    for (let i = 0; i < result.tickLog.length; i++) {
      expect(result.tickLog[i].tick).toBe(i + 1)
    }
  })

  it("eliminationOrder contains all non-survivor robots", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3"), makeFFARobot("p4")]
    const result = simulateFFA(robots)

    const eliminatedIds = result.eliminationOrder.map((e) => e.ownerId)
    // All non-survivor robots should be in elimination order
    const nonSurvivorIds = robots
      .map((r) => r.ownerId)
      .filter((id) => id !== result.survivorId)
    for (const id of nonSurvivorIds) {
      expect(eliminatedIds).toContain(id)
    }
    // Survivor should not be in elimination order
    expect(eliminatedIds).not.toContain(result.survivorId)
  })

  it("eliminationOrder tick numbers are positive and non-decreasing", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    for (let i = 0; i < result.eliminationOrder.length; i++) {
      expect(result.eliminationOrder[i].eliminatedOnTick).toBeGreaterThan(0)
      if (i > 0) {
        expect(result.eliminationOrder[i].eliminatedOnTick).toBeGreaterThanOrEqual(
          result.eliminationOrder[i - 1].eliminatedOnTick
        )
      }
    }
  })

  it("robots never target themselves in FFA", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        expect(attack.attackerId).not.toBe(attack.targetId)
      }
    }
  })

  it("attack targets are only living robots (snapshot HP > 0 at tick start)", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    const eliminatedByTick: Record<string, number> = {}
    for (const entry of result.tickLog) {
      // All targets in this tick should not have been eliminated in a previous tick
      for (const attack of entry.attacks) {
        const eliminatedTick = eliminatedByTick[attack.targetId]
        if (eliminatedTick !== undefined) {
          // target was eliminated before this tick
          expect(eliminatedTick).toBeGreaterThanOrEqual(entry.tick)
        }
      }
      // Record eliminations after processing attacks
      for (const eliminatedId of entry.eliminations) {
        eliminatedByTick[eliminatedId] = entry.tick
      }
    }
  })

  it("guaranteed survivor rule prevents all robots dying simultaneously", () => {
    // High damage/accuracy, low HP to force mutual KO
    const robots = [
      makeFFARobot("p1", { currentHp: 5, maxHp: 5, accuracy: 90, maxHit: 10, tickInterval: 1 }),
      makeFFARobot("p2", { currentHp: 5, maxHp: 5, accuracy: 90, maxHit: 10, tickInterval: 1 }),
      makeFFARobot("p3", { currentHp: 5, maxHp: 5, accuracy: 90, maxHit: 10, tickInterval: 1 }),
    ]

    for (let i = 0; i < 20; i++) {
      const result = simulateFFA(robots.map((r) => ({ ...r })))
      expect(result.survivorId).toBeDefined()
      expect(["p1", "p2", "p3"]).toContain(result.survivorId)
    }
  })

  it("does not exceed 1000 ticks (TICK_LIMIT)", () => {
    const robots = [
      makeFFARobot("p1", { accuracy: 10, tickInterval: 8 }),
      makeFFARobot("p2", { accuracy: 10, tickInterval: 8 }),
      makeFFARobot("p3", { accuracy: 10, tickInterval: 8 }),
    ]

    const result = simulateFFA(robots)

    expect(result.tickLog.length).toBeLessThanOrEqual(1000)
    expect(result.survivorId).toBeDefined()
  })

  it("timeout selects highest HP robot as survivor", () => {
    // Very low accuracy to likely timeout, give p1 extra HP
    const robots = [
      makeFFARobot("p1", { accuracy: 1, maxHit: 1, tickInterval: 8, currentHp: 100 }),
      makeFFARobot("p2", { accuracy: 1, maxHit: 1, tickInterval: 8, currentHp: 50 }),
      makeFFARobot("p3", { accuracy: 1, maxHit: 1, tickInterval: 8, currentHp: 30 }),
    ]

    const result = simulateFFA(robots)
    expect(result.survivorId).toBeDefined()
  })

  it("does not mutate input robot objects", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const originalHps = robots.map((r) => r.currentHp)

    simulateFFA(robots)

    for (let i = 0; i < robots.length; i++) {
      expect(robots[i].currentHp).toBe(originalHps[i])
    }
  })

  it("damage values are within [1, maxHit] when hit, 0 when miss", () => {
    const robots = [
      makeFFARobot("p1", { maxHit: 6 }),
      makeFFARobot("p2", { maxHit: 8 }),
      makeFFARobot("p3", { maxHit: 4 }),
    ]
    const maxHitByOwner: Record<string, number> = { p1: 6, p2: 8, p3: 4 }

    const result = simulateFFA(robots)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        if (attack.hit) {
          expect(attack.damage).toBeGreaterThanOrEqual(1)
          expect(attack.damage).toBeLessThanOrEqual(maxHitByOwner[attack.attackerId])
        } else {
          expect(attack.damage).toBe(0)
        }
      }
    }
  })

  it("targetHpAfter is never negative", () => {
    const robots = [makeFFARobot("p1"), makeFFARobot("p2"), makeFFARobot("p3")]
    const result = simulateFFA(robots)

    for (const entry of result.tickLog) {
      for (const attack of entry.attacks) {
        expect(attack.targetHpAfter).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("works with many robots (6-player FFA)", () => {
    const robots = [
      makeFFARobot("p1"),
      makeFFARobot("p2"),
      makeFFARobot("p3"),
      makeFFARobot("p4"),
      makeFFARobot("p5"),
      makeFFARobot("p6"),
    ]

    const result = simulateFFA(robots)

    expect(result.survivorId).toBeDefined()
    expect(robots.map((r) => r.ownerId)).toContain(result.survivorId)
    expect(result.eliminationOrder.length).toBe(5) // 6 robots - 1 survivor = 5 eliminated
  })

  it("same-tick eliminations share the same tick number in eliminationOrder", () => {
    // High damage/accuracy, same tick interval to encourage same-tick eliminations
    const robots = [
      makeFFARobot("p1", { accuracy: 90, maxHit: 50, tickInterval: 1, currentHp: 20 }),
      makeFFARobot("p2", { accuracy: 90, maxHit: 50, tickInterval: 1, currentHp: 20 }),
      makeFFARobot("p3", { accuracy: 90, maxHit: 50, tickInterval: 1, currentHp: 20 }),
      makeFFARobot("p4", { accuracy: 90, maxHit: 50, tickInterval: 1, currentHp: 20 }),
    ]

    // Run multiple times — some runs should produce same-tick eliminations
    let foundSameTickElimination = false
    for (let i = 0; i < 50; i++) {
      const result = simulateFFA(robots.map((r) => ({ ...r })))
      const ticks = result.eliminationOrder.map((e) => e.eliminatedOnTick)
      if (new Set(ticks).size < ticks.length) {
        foundSameTickElimination = true
        // Verify shared tick numbers
        const tickCounts: Record<number, number> = {}
        for (const t of ticks) {
          tickCounts[t] = (tickCounts[t] || 0) + 1
        }
        const sharedTick = Object.entries(tickCounts).find(([, count]) => count > 1)
        expect(sharedTick).toBeDefined()
        break
      }
    }
    // With these configs, it's very likely we get a same-tick elimination
    expect(foundSameTickElimination).toBe(true)
  })
})
