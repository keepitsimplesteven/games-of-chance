import { describe, it, expect } from "vitest"
import { createPairings } from "./PairingEngine"
import type { RobotInstance } from "../types"

function makeRobotInstance(ownerId: string): RobotInstance {
  return {
    templateId: "bot-alpha",
    ownerId,
    currentHp: 100,
    maxHp: 100,
    accuracy: 80,
    damageMin: 1,
    damageMax: 10,
  }
}

describe("createPairings", () => {
  it("creates correct number of pairings for 4 participants", () => {
    const participants = ["p1", "p2", "p3", "p4"]
    const selectedRobots: Record<string, RobotInstance> = {}
    for (const id of participants) {
      selectedRobots[id] = makeRobotInstance(id)
    }

    const pairings = createPairings(participants, selectedRobots)

    expect(pairings).toHaveLength(2)
  })

  it("ensures every participant appears in exactly one pairing", () => {
    const participants = ["p1", "p2", "p3", "p4", "p5", "p6"]
    const selectedRobots: Record<string, RobotInstance> = {}
    for (const id of participants) {
      selectedRobots[id] = makeRobotInstance(id)
    }

    const pairings = createPairings(participants, selectedRobots)

    const allPlayerIds = pairings.flatMap((p) => [p.player1Id, p.player2Id])
    expect(allPlayerIds.sort()).toEqual([...participants].sort())
  })

  it("assigns correct robot instances to each pairing", () => {
    const participants = ["p1", "p2"]
    const selectedRobots: Record<string, RobotInstance> = {
      p1: makeRobotInstance("p1"),
      p2: makeRobotInstance("p2"),
    }

    const pairings = createPairings(participants, selectedRobots)

    expect(pairings).toHaveLength(1)
    const pairing = pairings[0]
    expect(pairing.robot1.ownerId).toBe(pairing.player1Id)
    expect(pairing.robot2.ownerId).toBe(pairing.player2Id)
  })

  it("generates unique pairing IDs", () => {
    const participants = ["p1", "p2", "p3", "p4"]
    const selectedRobots: Record<string, RobotInstance> = {}
    for (const id of participants) {
      selectedRobots[id] = makeRobotInstance(id)
    }

    const pairings = createPairings(participants, selectedRobots)

    const ids = pairings.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("initializes winnerId, loserId as null and tickLog as empty", () => {
    const participants = ["p1", "p2"]
    const selectedRobots: Record<string, RobotInstance> = {
      p1: makeRobotInstance("p1"),
      p2: makeRobotInstance("p2"),
    }

    const pairings = createPairings(participants, selectedRobots)

    for (const pairing of pairings) {
      expect(pairing.winnerId).toBeNull()
      expect(pairing.loserId).toBeNull()
      expect(pairing.tickLog).toEqual([])
    }
  })

  it("handles 2 participants (minimum valid input)", () => {
    const participants = ["a", "b"]
    const selectedRobots: Record<string, RobotInstance> = {
      a: makeRobotInstance("a"),
      b: makeRobotInstance("b"),
    }

    const pairings = createPairings(participants, selectedRobots)

    expect(pairings).toHaveLength(1)
    expect(new Set([pairings[0].player1Id, pairings[0].player2Id])).toEqual(new Set(["a", "b"]))
  })
})
