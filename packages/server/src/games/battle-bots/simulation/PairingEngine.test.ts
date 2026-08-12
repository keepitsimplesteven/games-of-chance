import { describe, it, expect } from "vitest"
import { createPairings } from "./PairingEngine"

describe("createPairings", () => {
  it("creates correct number of pairings for 4 participants", () => {
    const participants = ["p1", "p2", "p3", "p4"]

    const pairings = createPairings(participants)

    expect(pairings).toHaveLength(2)
  })

  it("ensures every participant appears in exactly one pairing", () => {
    const participants = ["p1", "p2", "p3", "p4", "p5", "p6"]

    const pairings = createPairings(participants)

    const allPlayerIds = pairings.flatMap((p) => [p.player1Id, p.player2Id])
    expect(allPlayerIds.sort()).toEqual([...participants].sort())
  })

  it("assigns player IDs correctly to each pairing", () => {
    const participants = ["p1", "p2"]

    const pairings = createPairings(participants)

    expect(pairings).toHaveLength(1)
    const pairing = pairings[0]
    expect(new Set([pairing.player1Id, pairing.player2Id])).toEqual(new Set(["p1", "p2"]))
  })

  it("generates unique pairing IDs", () => {
    const participants = ["p1", "p2", "p3", "p4"]

    const pairings = createPairings(participants)

    const ids = pairings.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("initializes winnerId as null and tickLog as empty", () => {
    const participants = ["p1", "p2"]

    const pairings = createPairings(participants)

    for (const pairing of pairings) {
      expect(pairing.winnerId).toBeNull()
      expect(pairing.tickLog).toEqual([])
    }
  })

  it("handles 2 participants (minimum valid input)", () => {
    const participants = ["a", "b"]

    const pairings = createPairings(participants)

    expect(pairings).toHaveLength(1)
    expect(new Set([pairings[0].player1Id, pairings[0].player2Id])).toEqual(new Set(["a", "b"]))
  })
})
