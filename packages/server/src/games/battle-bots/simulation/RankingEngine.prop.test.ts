/**
 * Feature: battle-bots, Properties for ranking engine
 *
 * - Property: Ranking Completeness — finalRankings.length = participants.length
 * - Property: Ranking Bounds — all ranks between 1 and participants.length inclusive
 * - Property: Bracket Partition — winners + losers participants = total participants
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { computeFinalRankings, type ParticipantInfo } from "./RankingEngine"
import type { FFABracket, RobotInstance, TickEvent } from "../types"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a unique list of player IDs of a given size */
function uniquePlayerIds(count: number): fc.Arbitrary<string[]> {
  return fc.uniqueArray(
    fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0),
    { minLength: count, maxLength: count }
  )
}

/** Create a RobotInstance for a given owner */
function makeRobot(ownerId: string): RobotInstance {
  return {
    templateId: "bot-alpha",
    ownerId,
    currentHp: 0,
    maxHp: 100,
    accuracy: 80,
    damageMin: 1,
    damageMax: 10,
  }
}

/**
 * Build a valid FFABracket from a list of player IDs with a plausible tick log.
 * The eliminationOrder contains all players — last entry is the last standing.
 * The tick log records one elimination per tick to keep things simple and valid.
 */
function buildBracket(id: string, playerIds: string[]): FFABracket {
  const participants = playerIds.map(makeRobot)
  // eliminationOrder: first eliminated first, last standing is last
  const eliminationOrder = [...playerIds]
  const tickLog: TickEvent[] = []

  // Generate a tick log where each player is eliminated one tick at a time
  for (let i = 0; i < playerIds.length - 1; i++) {
    const eliminatedId = eliminationOrder[i]
    const attackerId = eliminationOrder[playerIds.length - 1] // last standing attacks
    tickLog.push({
      tick: i + 1,
      attacks: [
        {
          attackerId,
          targetId: eliminatedId,
          hit: true,
          damage: 100,
          targetHpAfter: 0,
        },
      ],
    })
  }

  return { id, participants, eliminationOrder, tickLog }
}

/**
 * Build brackets with simultaneous eliminations (tied eliminations on same tick).
 * Groups players into chunks that are eliminated together on the same tick.
 */
function buildBracketWithTies(
  id: string,
  playerIds: string[],
  groupSizes: number[]
): FFABracket {
  const participants = playerIds.map(makeRobot)
  const eliminationOrder = [...playerIds]
  const tickLog: TickEvent[] = []

  let playerIndex = 0
  let tick = 0
  const survivorId = eliminationOrder[playerIds.length - 1]

  for (const groupSize of groupSizes) {
    tick++
    const attacks: TickEvent["attacks"] = []
    for (let j = 0; j < groupSize && playerIndex < playerIds.length - 1; j++) {
      const eliminatedId = eliminationOrder[playerIndex]
      attacks.push({
        attackerId: survivorId,
        targetId: eliminatedId,
        hit: true,
        damage: 100,
        targetHpAfter: 0,
      })
      playerIndex++
    }
    if (attacks.length > 0) {
      tickLog.push({ tick, attacks })
    }
  }

  return { id, participants, eliminationOrder, tickLog }
}

/** Build a participantInfo map from player IDs */
function buildParticipantInfo(playerIds: string[]): Map<string, ParticipantInfo> {
  const info = new Map<string, ParticipantInfo>()
  for (const id of playerIds) {
    info.set(id, { name: `Player_${id}`, isBot: id.startsWith("bot_") })
  }
  return info
}

/**
 * Arbitrary for generating a split of total participants into winners and losers.
 * Both brackets must have at least 2 participants (minimum for FFA to make sense).
 */
const bracketSplitArb = fc
  .integer({ min: 4, max: 20 })
  .chain((total) => {
    const minWinners = 2
    const maxWinners = total - 2
    return fc.tuple(
      fc.constant(total),
      fc.integer({ min: minWinners, max: maxWinners })
    )
  })

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: battle-bots, Property-based tests for ranking engine", () => {
  /**
   * Property: Ranking Completeness
   * finalRankings.length = participants.length (total from both brackets)
   *
   * **Validates: Requirements 8.1, 8.2, 8.3**
   */
  it("Ranking Completeness — finalRankings.length equals total participants", () => {
    fc.assert(
      fc.property(bracketSplitArb, ([total, winnersCount]) => {
        const losersCount = total - winnersCount

        // Generate unique player IDs for all participants
        const allIds: string[] = []
        for (let i = 0; i < total; i++) {
          allIds.push(`player_${i}`)
        }

        const winnersIds = allIds.slice(0, winnersCount)
        const losersIds = allIds.slice(winnersCount)

        const winnersBracket = buildBracket("winners", winnersIds)
        const losersBracket = buildBracket("losers", losersIds)
        const participantInfo = buildParticipantInfo(allIds)

        const rankings = computeFinalRankings(
          winnersBracket,
          losersBracket,
          participantInfo
        )

        expect(rankings.length).toBe(total)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Ranking Bounds
   * All ranks are between 1 and participants.length inclusive
   *
   * **Validates: Requirements 8.1, 8.2, 8.3**
   */
  it("Ranking Bounds — all ranks between 1 and participants.length inclusive", () => {
    fc.assert(
      fc.property(bracketSplitArb, ([total, winnersCount]) => {
        const allIds: string[] = []
        for (let i = 0; i < total; i++) {
          allIds.push(`player_${i}`)
        }

        const winnersIds = allIds.slice(0, winnersCount)
        const losersIds = allIds.slice(winnersCount)

        const winnersBracket = buildBracket("winners", winnersIds)
        const losersBracket = buildBracket("losers", losersIds)
        const participantInfo = buildParticipantInfo(allIds)

        const rankings = computeFinalRankings(
          winnersBracket,
          losersBracket,
          participantInfo
        )

        for (const ranking of rankings) {
          expect(ranking.rank).toBeGreaterThanOrEqual(1)
          expect(ranking.rank).toBeLessThanOrEqual(total)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Bracket Partition
   * winners + losers participants = total participants
   *
   * **Validates: Requirements 8.1, 8.3, 8.4**
   */
  it("Bracket Partition — winners + losers participants in rankings equals total", () => {
    fc.assert(
      fc.property(bracketSplitArb, ([total, winnersCount]) => {
        const losersCount = total - winnersCount

        const allIds: string[] = []
        for (let i = 0; i < total; i++) {
          allIds.push(`player_${i}`)
        }

        const winnersIds = allIds.slice(0, winnersCount)
        const losersIds = allIds.slice(winnersCount)

        const winnersBracket = buildBracket("winners", winnersIds)
        const losersBracket = buildBracket("losers", losersIds)
        const participantInfo = buildParticipantInfo(allIds)

        const rankings = computeFinalRankings(
          winnersBracket,
          losersBracket,
          participantInfo
        )

        const winnersRankings = rankings.filter((r) => r.bracket === "winners")
        const losersRankings = rankings.filter((r) => r.bracket === "losers")

        expect(winnersRankings.length).toBe(winnersCount)
        expect(losersRankings.length).toBe(losersCount)
        expect(winnersRankings.length + losersRankings.length).toBe(total)
      }),
      { numRuns: 100 }
    )
  })
})
