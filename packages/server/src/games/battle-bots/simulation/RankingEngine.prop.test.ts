/**
 * Feature: battle-bots-combat-overhaul, Properties for ranking engine
 *
 * - Property 14: FFA Ranking Correctness — survivor rank 1, later elimination = higher rank, same-tick = same rank
 * - Property 15: Bracket Position Mapping — winners ranks ≤ N/2, losers ranks > N/2
 * - Property: Ranking Completeness — finalRankings.length = participants.length
 * - Property: Ranking Bounds — all ranks between 1 and participants.length inclusive
 * - Property: Bracket Partition — winners + losers participants = total participants
 *
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { computeFinalRankings, type ParticipantInfo } from "./RankingEngine"
import type { FFABracketState } from "../types"

// ── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Build a valid FFABracketState from a list of player IDs.
 * The eliminationOrder contains all players except the survivor (last one).
 * Each eliminated player gets a unique or shared tick number.
 */
function buildBracket(id: string, playerIds: string[]): FFABracketState {
  const survivorId = playerIds[playerIds.length - 1]
  const eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }> = []

  // Eliminate one player per tick (sequential eliminations, no ties)
  for (let i = 0; i < playerIds.length - 1; i++) {
    eliminationOrder.push({
      ownerId: playerIds[i],
      eliminatedOnTick: i + 1,
    })
  }

  return {
    id,
    participantIds: playerIds,
    eliminationOrder,
    survivorId,
    tickLog: [],
  }
}

/**
 * Build brackets with simultaneous eliminations (tied eliminations on same tick).
 * Groups players into chunks that are eliminated together on the same tick.
 */
function buildBracketWithTies(
  id: string,
  playerIds: string[],
  groupSizes: number[]
): FFABracketState {
  const survivorId = playerIds[playerIds.length - 1]
  const eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }> = []

  let playerIndex = 0
  let tick = 0

  for (const groupSize of groupSizes) {
    tick++
    for (let j = 0; j < groupSize && playerIndex < playerIds.length - 1; j++) {
      eliminationOrder.push({
        ownerId: playerIds[playerIndex],
        eliminatedOnTick: tick,
      })
      playerIndex++
    }
  }

  return {
    id,
    participantIds: playerIds,
    eliminationOrder,
    survivorId,
    tickLog: [],
  }
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

describe("Feature: battle-bots-combat-overhaul, Property-based tests for ranking engine", () => {
  /**
   * Property: Ranking Completeness
   * finalRankings.length = participants.length (total from both brackets)
   *
   * **Validates: Requirements 17.4, 17.5**
   */
  it("Ranking Completeness — finalRankings.length equals total participants", () => {
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

        expect(rankings.length).toBe(total)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Ranking Bounds
   * All ranks are between 1 and participants.length inclusive
   *
   * **Validates: Requirements 17.4, 17.5**
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
   * **Validates: Requirements 17.4, 17.5**
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

  /**
   * Property 15: Score-based Ranking
   * When gameScores are provided, players are ranked by score descending.
   * A player with a higher score always has a rank ≤ any player with a lower score.
   *
   * **Validates: Requirements 17.4 (score-based ranking after bugfix)**
   */
  it("Property 15: Score-based Ranking — higher score = better (lower) rank", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 20 }).filter((n) => n % 2 === 0),
        (total) => {
          const winnersCount = total / 2

          const allIds: string[] = []
          for (let i = 0; i < total; i++) {
            allIds.push(`player_${i}`)
          }

          const winnersIds = allIds.slice(0, winnersCount)
          const losersIds = allIds.slice(winnersCount)

          const winnersBracket = buildBracket("winners", winnersIds)
          const losersBracket = buildBracket("losers", losersIds)
          const participantInfo = buildParticipantInfo(allIds)

          // Generate distinct scores for each player
          const gameScores: Record<string, number> = {}
          for (let i = 0; i < total; i++) {
            gameScores[allIds[i]] = (i + 1) * 10 // 10, 20, 30, ...
          }

          const rankings = computeFinalRankings(
            winnersBracket,
            losersBracket,
            participantInfo,
            gameScores
          )

          // For any two players: higher score → lower (better) rank number
          for (let i = 0; i < rankings.length; i++) {
            for (let j = i + 1; j < rankings.length; j++) {
              if (rankings[i].score > rankings[j].score) {
                expect(rankings[i].rank).toBeLessThan(rankings[j].rank)
              } else if (rankings[i].score < rankings[j].score) {
                expect(rankings[i].rank).toBeGreaterThan(rankings[j].rank)
              } else {
                expect(rankings[i].rank).toBe(rankings[j].rank)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14: FFA Ranking Correctness
   * When gameScores reflect survival-tick-based scoring, survivors get highest scores
   * and are ranked first; later elimination = higher score = better rank.
   *
   * **Validates: Requirements 17.1, 17.2, 17.3**
   */
  it("Property 14: FFA Ranking Correctness — survivor rank 1, later elim = higher rank, same tick = same rank", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 12 }).chain((total) => {
          const winnersCount = Math.ceil(total / 2)
          const losersCount = total - winnersCount
          // Generate group sizes for tied eliminations
          return fc.tuple(
            fc.constant(total),
            fc.constant(winnersCount),
            fc.constant(losersCount),
            // group sizes for winners (sum must equal winnersCount - 1 for eliminated players)
            fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: winnersCount - 1 }),
            // group sizes for losers
            fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: losersCount - 1 })
          )
        }),
        ([total, winnersCount, losersCount, winnersGroups, losersGroups]) => {
          const allIds: string[] = []
          for (let i = 0; i < total; i++) {
            allIds.push(`player_${i}`)
          }

          const winnersIds = allIds.slice(0, winnersCount)
          const losersIds = allIds.slice(winnersCount)

          const winnersBracket = buildBracketWithTies("winners", winnersIds, winnersGroups)
          const losersBracket = buildBracketWithTies("losers", losersIds, losersGroups)
          const participantInfo = buildParticipantInfo(allIds)

          // Simulate realistic scores:
          // Winners bracket: winner of Round 2 gets WIN_BONUS (25) + survival score
          // Losers bracket: loser of Round 2 gets 0 + survival score
          // Survivor gets 125, eliminated get ceil(eliminatedTick / (totalTicks * 1.1) * 100)
          const gameScores: Record<string, number> = {}

          // Winners bracket scoring
          const winnersTotalTicks = winnersBracket.eliminationOrder.length > 0
            ? winnersBracket.eliminationOrder[winnersBracket.eliminationOrder.length - 1].eliminatedOnTick
            : 0
          for (const elim of winnersBracket.eliminationOrder) {
            const survivalScore = Math.ceil((elim.eliminatedOnTick / (winnersTotalTicks * 1.1)) * 100)
            gameScores[elim.ownerId] = 25 + survivalScore // WIN_BONUS + survival
          }
          if (winnersBracket.survivorId) {
            gameScores[winnersBracket.survivorId] = 25 + 125 // WIN_BONUS + SURVIVOR_POINTS + WIN_BONUS
          }

          // Losers bracket scoring
          const losersTotalTicks = losersBracket.eliminationOrder.length > 0
            ? losersBracket.eliminationOrder[losersBracket.eliminationOrder.length - 1].eliminatedOnTick
            : 0
          for (const elim of losersBracket.eliminationOrder) {
            const survivalScore = Math.ceil((elim.eliminatedOnTick / (losersTotalTicks * 1.1)) * 100)
            gameScores[elim.ownerId] = survivalScore // 0 (Round 2 loser) + survival
          }
          if (losersBracket.survivorId) {
            gameScores[losersBracket.survivorId] = 125 // 0 + SURVIVOR_POINTS + WIN_BONUS
          }

          const rankings = computeFinalRankings(
            winnersBracket,
            losersBracket,
            participantInfo,
            gameScores
          )

          // Winners bracket survivor (25+125=150) should be rank 1
          const survivorRanking = rankings.find((r) => r.playerId === winnersBracket.survivorId)
          expect(survivorRanking?.rank).toBe(1)

          // Higher scores should have lower (better) rank
          for (let i = 0; i < rankings.length; i++) {
            for (let j = i + 1; j < rankings.length; j++) {
              if (rankings[i].score > rankings[j].score) {
                expect(rankings[i].rank).toBeLessThanOrEqual(rankings[j].rank)
              } else if (rankings[i].score < rankings[j].score) {
                expect(rankings[i].rank).toBeGreaterThanOrEqual(rankings[j].rank)
              } else {
                expect(rankings[i].rank).toBe(rankings[j].rank)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
