import type { FFABracket, FinalRanking } from "../types"

/** Participant info needed to populate ranking display fields */
export interface ParticipantInfo {
  name: string
  isBot: boolean
}

/**
 * Determines which tick a player was eliminated on by scanning the tick log.
 * A player is eliminated when their HP reaches 0 as a target in an attack.
 * Returns a Map of playerId → tick number they were eliminated on.
 */
function getEliminationTicks(bracket: FFABracket): Map<string, number> {
  const eliminationTicks = new Map<string, number>()

  for (const tickEvent of bracket.tickLog) {
    for (const attack of tickEvent.attacks) {
      if (attack.targetHpAfter <= 0 && !eliminationTicks.has(attack.targetId)) {
        eliminationTicks.set(attack.targetId, tickEvent.tick)
      }
    }
  }

  return eliminationTicks
}

/**
 * Adjusts rankings so that robots eliminated on the same tick share the same rank.
 * When tied, all tied robots get the best (lowest number) rank among them.
 */
function adjustForTies(
  rankings: FinalRanking[],
  bracket: FFABracket
): void {
  const eliminationTicks = getEliminationTicks(bracket)

  // Group rankings by elimination tick
  const tickGroups = new Map<number, FinalRanking[]>()

  for (const ranking of rankings) {
    const tick = eliminationTicks.get(ranking.playerId)
    if (tick === undefined) {
      // Last standing — not eliminated, no tie possible with other survivors
      continue
    }
    const group = tickGroups.get(tick) ?? []
    group.push(ranking)
    tickGroups.set(tick, group)
  }

  // For each group of robots eliminated on the same tick, assign them all the best rank
  for (const group of tickGroups.values()) {
    if (group.length > 1) {
      const bestRank = Math.min(...group.map((r) => r.rank))
      for (const ranking of group) {
        ranking.rank = bestRank
      }
    }
  }
}

/**
 * Computes final rankings from the FFA elimination order for both brackets.
 *
 * Winners bracket: last standing = rank 1, second-to-last = rank 2, etc.
 * Losers bracket: rankings start from winnersCount + 1.
 * Tied eliminations (same tick) share the same rank.
 */
export function computeFinalRankings(
  winnersBracket: FFABracket,
  losersBracket: FFABracket,
  participantInfo: Map<string, ParticipantInfo>
): FinalRanking[] {
  const rankings: FinalRanking[] = []
  const winnersCount = winnersBracket.participants.length

  // Winners bracket: elimination order is reversed for ranking
  // Last in eliminationOrder = last standing = rank 1
  for (let i = winnersBracket.eliminationOrder.length - 1; i >= 0; i--) {
    const playerId = winnersBracket.eliminationOrder[i]
    const rank = winnersCount - i // last = rank 1, second-to-last = rank 2, etc.
    const info = participantInfo.get(playerId)
    rankings.push({
      playerId,
      playerName: info?.name ?? playerId,
      rank,
      bracket: "winners",
      isBot: info?.isBot ?? false,
    })
  }

  // Handle tied eliminations in winners bracket
  adjustForTies(rankings, winnersBracket)

  // Losers bracket: rankings continue from winnersCount + 1
  const losersStartRank = winnersCount + 1
  const losersRankings: FinalRanking[] = []

  for (let i = losersBracket.eliminationOrder.length - 1; i >= 0; i--) {
    const playerId = losersBracket.eliminationOrder[i]
    const rank = losersStartRank + (losersBracket.participants.length - 1 - i)
    const info = participantInfo.get(playerId)
    losersRankings.push({
      playerId,
      playerName: info?.name ?? playerId,
      rank,
      bracket: "losers",
      isBot: info?.isBot ?? false,
    })
  }

  // Handle tied eliminations in losers bracket
  adjustForTies(losersRankings, losersBracket)

  rankings.push(...losersRankings)
  return rankings
}
