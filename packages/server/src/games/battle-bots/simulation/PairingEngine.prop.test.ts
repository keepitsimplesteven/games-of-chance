/**
 * Feature: battle-bots, Property: Pairing Completeness & Pairing Count
 *
 * Validates: Requirements 4.1, 4.2
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { createPairings } from "./PairingEngine"
import type { RobotInstance } from "../types"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generates an even-length array of unique participant IDs (2 to 20 participants) */
const evenParticipantsArb = fc
  .integer({ min: 1, max: 10 })
  .chain((halfCount) =>
    fc
      .uniqueArray(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        { minLength: halfCount * 2, maxLength: halfCount * 2 }
      )
  )

/** Creates a selectedRobots map for a given list of participant IDs */
function buildSelectedRobots(
  participants: string[]
): Record<string, RobotInstance> {
  const robots: Record<string, RobotInstance> = {}
  for (const id of participants) {
    robots[id] = {
      templateId: "bot-alpha",
      ownerId: id,
      currentHp: 100,
      maxHp: 100,
      accuracy: 80,
      damageMin: 1,
      damageMax: 10,
    }
  }
  return robots
}

// ── Property: Pairing Completeness ─────────────────────────────────────────

describe("Feature: battle-bots, Property: Pairing Completeness", () => {
  /**
   * Property: Pairing Completeness
   *
   * Every participant appears in exactly one pairing (as either player1 or player2).
   * No participant is left out and no participant appears in multiple pairings.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it("every participant appears in exactly one pairing", () => {
    fc.assert(
      fc.property(evenParticipantsArb, (participants) => {
        const selectedRobots = buildSelectedRobots(participants)
        const pairings = createPairings(participants, selectedRobots)

        // Collect all participant IDs from pairings
        const pairedIds: string[] = []
        for (const pairing of pairings) {
          pairedIds.push(pairing.player1Id)
          pairedIds.push(pairing.player2Id)
        }

        // Every participant must appear exactly once across all pairings
        const sortedParticipants = [...participants].sort()
        const sortedPairedIds = [...pairedIds].sort()

        expect(sortedPairedIds).toEqual(sortedParticipants)
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property: Pairing Count ────────────────────────────────────────────────

describe("Feature: battle-bots, Property: Pairing Count", () => {
  /**
   * Property: Pairing Count
   *
   * The number of pairings multiplied by 2 equals the number of participants.
   * This ensures no participants are dropped or duplicated during pairing.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it("pairings.length * 2 equals participants.length", () => {
    fc.assert(
      fc.property(evenParticipantsArb, (participants) => {
        const selectedRobots = buildSelectedRobots(participants)
        const pairings = createPairings(participants, selectedRobots)

        expect(pairings.length * 2).toBe(participants.length)
      }),
      { numRuns: 100 }
    )
  })
})
