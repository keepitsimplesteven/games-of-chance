import type { MatchResolver, Bracket, BracketRound, Matchup } from "@games-of-chance/shared"
import { PLAYCALLER } from "./constants"

/**
 * Resolves all matchups in the current (active) bracket round.
 * Advances winners to the next round. Advances bye players automatically.
 *
 * When the play-in round (round with byes) resolves, advancers are placed
 * into the next round using standard bracket seeding order based on their
 * effective seed position.
 *
 * @param bracket - Current bracket state
 * @param resolver - Match resolution function
 * @returns Updated bracket with current round resolved and winners placed
 */
export function resolveCurrentRound(
  bracket: Bracket,
  resolver: MatchResolver
): Bracket {
  const currentRound = bracket.rounds[bracket.currentRoundIndex]

  // Resolve each matchup by invoking the resolver
  for (const matchup of currentRound.matchups) {
    const winner = resolver(matchup.playerA, matchup.playerB)

    // Validate that resolver returned one of the two input IDs
    if (winner !== matchup.playerA && winner !== matchup.playerB) {
      throw new Error("Match resolver returned an invalid player ID")
    }

    matchup.winner = winner

    // Record the loser as eliminated in this round
    const loser = winner === matchup.playerA ? matchup.playerB : matchup.playerA
    bracket.eliminated[loser] = bracket.currentRoundIndex
  }

  // Mark current round as resolved
  currentRound.resolved = true

  // Advance winners + bye players to the next round (if not the last round)
  const isLastRound = bracket.currentRoundIndex >= bracket.totalRounds - 1

  if (!isLastRound) {
    const nextRound = bracket.rounds[bracket.currentRoundIndex + 1]

    if (currentRound.byes.length > 0) {
      // ── Play-in round resolved: use standard bracket seeding ──────────
      // Collect all advancers with their effective seed positions.
      // Bye players keep their seed. Play-in winners take the position they
      // played for (the higher seed in the pair they won).
      const advancers: { playerId: string; effectiveSeed: number }[] = []

      // Bye players advance with their original seed
      for (const byePlayer of currentRound.byes) {
        advancers.push({ playerId: byePlayer, effectiveSeed: bracket.seeds[byePlayer] })
      }

      // Play-in winners: their effective seed = the higher seed of the matchup pair
      // (i.e., the seed of playerA, who is always the higher seed in play-in)
      for (const matchup of currentRound.matchups) {
        const effectiveSeed = bracket.seeds[matchup.playerA] // higher seed in play-in pair
        advancers.push({ playerId: matchup.winner!, effectiveSeed })
      }

      // Sort by effective seed
      advancers.sort((a, b) => a.effectiveSeed - b.effectiveSeed)

      // Apply standard bracket seeding order
      const mainBracketSize = advancers.length
      const order = standardBracketOrder(mainBracketSize)

      // Place into next round matchups using the bracket order
      for (let i = 0; i < order.length; i += 2) {
        const matchupIndex = Math.floor(i / 2)
        const seedPositionA = order[i] - 1   // 0-indexed into sorted advancers
        const seedPositionB = order[i + 1] - 1
        nextRound.matchups[matchupIndex].playerA = advancers[seedPositionA].playerId
        nextRound.matchups[matchupIndex].playerB = advancers[seedPositionB].playerId
      }
    } else {
      // ── Normal round (no byes): place winners sequentially into next round ──
      // Winners from adjacent matchups feed into the same next-round matchup.
      // Match 0 winner + Match 1 winner → next match 0, etc.
      const winners: string[] = []
      for (const matchup of currentRound.matchups) {
        winners.push(matchup.winner!)
      }

      for (let i = 0; i < winners.length; i++) {
        const matchupIndex = Math.floor(i / 2)
        if (i % 2 === 0) {
          nextRound.matchups[matchupIndex].playerA = winners[i]
        } else {
          nextRound.matchups[matchupIndex].playerB = winners[i]
        }
      }
    }
  }

  // Increment currentRoundIndex
  bracket.currentRoundIndex++

  return bracket
}

/**
 * Returns the next power of 2 >= n.
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1
  let power = 1
  while (power < n) {
    power *= 2
  }
  return power
}

/**
 * Computes the number of byes needed for a given player count.
 * Byes = nextPowerOf2(playerCount) - playerCount
 */
export function computeByeCount(playerCount: number): number {
  return nextPowerOfTwo(playerCount) - playerCount
}

/**
 * Generates standard bracket seeding order for a given bracket size.
 * For an 8-team bracket, returns: [1, 8, 4, 5, 3, 6, 2, 7]
 * This places seeds so that:
 *  - Seed 1 is at the top, seed 2 at the bottom of the bracket
 *  - If all higher seeds win, seed 1 meets seed 2 in the final
 *  - The bracket is "mirrored" — opposing halves are reflections
 *
 * The result represents matchup slots: positions 0,1 = match 1; positions 2,3 = match 2; etc.
 */
export function standardBracketOrder(bracketSize: number): number[] {
  // Get the favored (top) seed for each match position from top to bottom
  const matchTopSeeds = getMatchPositionSeeds(bracketSize / 2)
  // Each match pairs the top seed with its complement (sum = bracketSize + 1)
  const result: number[] = []
  for (const s of matchTopSeeds) {
    result.push(s, bracketSize + 1 - s)
  }
  return result
}

/**
 * Returns the "favored seed" for each match position (top to bottom) in a bracket.
 * For 4 matches (8-team bracket): [1, 4, 3, 2]
 * For 2 matches (4-team bracket): [1, 2]
 * For 1 match  (2-team bracket): [1]
 *
 * Algorithm: recursively expand by pairing each existing seed with its complement,
 * then mirror the bottom half so seed 2 ends up at the very bottom of the bracket.
 */
function getMatchPositionSeeds(matchCount: number): number[] {
  if (matchCount === 1) return [1]
  if (matchCount === 2) return [1, 2]

  const smaller = getMatchPositionSeeds(matchCount / 2)
  const result: number[] = new Array(matchCount)
  const halfSmaller = smaller.length / 2

  // Top half: take the first half of `smaller`, expand each seed s into [s, matchCount+1-s]
  let pos = 0
  for (let i = 0; i < halfSmaller; i++) {
    const s = smaller[i]
    result[pos++] = s
    result[pos++] = matchCount + 1 - s
  }

  // Bottom half: take the second half of `smaller` in REVERSE order,
  // expand each seed s into [matchCount+1-s, s] (complement first, then seed — mirrored)
  for (let i = smaller.length - 1; i >= halfSmaller; i--) {
    const s = smaller[i]
    result[pos++] = matchCount + 1 - s
    result[pos++] = s
  }

  return result
}

/**
 * Generates a seeded single-elimination bracket.
 *
 * @param playerSeeds - Ordered array of player IDs by seed (index 0 = seed 1)
 * @param tiebreaker - Function to shuffle tied players (injected for testability)
 * @returns Complete bracket structure with all rounds pre-computed
 */
export function generateBracket(
  playerSeeds: string[],
  tiebreaker?: (tied: string[]) => string[]
): Bracket {
  const playerCount = playerSeeds.length

  if (playerCount < PLAYCALLER.MIN_PLAYERS) {
    throw new Error("Playcaller requires at least 2 players")
  }

  // Assign seeds (index 0 = seed 1, etc.)
  const seeds: Record<string, number> = {}
  for (let i = 0; i < playerSeeds.length; i++) {
    seeds[playerSeeds[i]] = i + 1
  }

  // Compute bracket size and rounds
  const bracketSize = nextPowerOfTwo(playerCount)
  const totalRounds = Math.ceil(Math.log2(playerCount))
  const byeCount = computeByeCount(playerCount)

  // Byes go to highest-seeded players (seeds 1 through byeCount)
  const byePlayers = playerSeeds.slice(0, byeCount)
  const nonByePlayers = playerSeeds.slice(byeCount)

  // Build all rounds
  const rounds: BracketRound[] = []

  if (byeCount > 0) {
    // ── Play-in round (bye round) ──────────────────────────────────────
    // Pair adjacent seeds: the two highest remaining play for the top play-in spot,
    // next two play for the next spot, etc.
    // For 10 players (byeCount=6, nonByePlayers = seeds 7-10):
    //   Match 0: 7v8 (playing for 7th position)
    //   Match 1: 9v10 (playing for 8th position)
    const playInMatchups: Matchup[] = []
    for (let i = 0; i < nonByePlayers.length; i += 2) {
      const higher = nonByePlayers[i]     // higher seed in the pair
      const lower = nonByePlayers[i + 1]  // lower seed in the pair
      playInMatchups.push({
        matchupId: `r0-m${Math.floor(i / 2)}`,
        playerA: higher,
        playerB: lower,
        winner: null,
      })
    }

    rounds.push({
      roundIndex: 0,
      matchups: playInMatchups,
      byes: byePlayers,
      resolved: false,
    })

    // ── Main bracket rounds (after play-in) ────────────────────────────
    // The main bracket has bracketSize / 2 matchups in its first round,
    // seeded using standard bracket order.
    let participantsInNextRound = bracketSize / 2
    for (let r = 1; r < totalRounds; r++) {
      const matchupCount = Math.floor(participantsInNextRound / 2)
      const emptyMatchups: Matchup[] = []
      for (let m = 0; m < matchupCount; m++) {
        emptyMatchups.push({
          matchupId: `r${r}-m${m}`,
          playerA: "",
          playerB: "",
          winner: null,
        })
      }
      rounds.push({
        roundIndex: r,
        matchups: emptyMatchups,
        byes: [],
        resolved: false,
      })
      participantsInNextRound = matchupCount
    }
  } else {
    // ── No byes: all players play in round 0, seeded using standard bracket order ──
    const order = standardBracketOrder(bracketSize)
    const firstRoundMatchups: Matchup[] = []
    for (let i = 0; i < order.length; i += 2) {
      const seedA = order[i]     // e.g., 1
      const seedB = order[i + 1] // e.g., 8
      firstRoundMatchups.push({
        matchupId: `r0-m${Math.floor(i / 2)}`,
        playerA: playerSeeds[seedA - 1],
        playerB: playerSeeds[seedB - 1],
        winner: null,
      })
    }

    rounds.push({
      roundIndex: 0,
      matchups: firstRoundMatchups,
      byes: [],
      resolved: false,
    })

    // Pre-compute subsequent rounds with empty matchup slots
    let participantsInNextRound = firstRoundMatchups.length
    for (let r = 1; r < totalRounds; r++) {
      const matchupCount = Math.floor(participantsInNextRound / 2)
      const emptyMatchups: Matchup[] = []
      for (let m = 0; m < matchupCount; m++) {
        emptyMatchups.push({
          matchupId: `r${r}-m${m}`,
          playerA: "",
          playerB: "",
          winner: null,
        })
      }
      rounds.push({
        roundIndex: r,
        matchups: emptyMatchups,
        byes: [],
        resolved: false,
      })
      participantsInNextRound = matchupCount
    }
  }

  return {
    rounds,
    currentRoundIndex: 0,
    totalRounds,
    seeds,
    eliminated: {},
  }
}

/**
 * Checks if the bracket is complete (champion determined).
 * The bracket is complete when all rounds have been resolved.
 */
export function isComplete(bracket: Bracket): boolean {
  return bracket.currentRoundIndex >= bracket.totalRounds
}

/**
 * Returns the final placements from a completed bracket.
 * Champion = 1st, runner-up = 2nd, semi-final losers = 3rd (tied), etc.
 *
 * Players eliminated in the same round share the numerically lowest
 * placement position in their range.
 */
export function computePlacements(bracket: Bracket): Map<string, number> {
  const placements = new Map<string, number>()

  // Find the champion: the winner of the final round's matchup
  const finalRound = bracket.rounds[bracket.totalRounds - 1]
  const champion = finalRound.matchups[0]?.winner

  if (!champion) {
    // Bracket not complete — return empty placements
    return placements
  }

  // Champion gets placement 1
  placements.set(champion, 1)

  // Group eliminated players by the round they were eliminated in
  const eliminatedByRound = new Map<number, string[]>()
  for (const [playerId, roundIndex] of Object.entries(bracket.eliminated)) {
    if (!eliminatedByRound.has(roundIndex)) {
      eliminatedByRound.set(roundIndex, [])
    }
    eliminatedByRound.get(roundIndex)!.push(playerId)
  }

  // Sort rounds in descending order (latest round = best placement)
  const sortedRounds = Array.from(eliminatedByRound.keys()).sort((a, b) => b - a)

  // Assign placements: start at position 2 (champion has 1)
  let currentPosition = 2
  for (const roundIndex of sortedRounds) {
    const players = eliminatedByRound.get(roundIndex)!
    // All players in this round share the same placement
    for (const playerId of players) {
      placements.set(playerId, currentPosition)
    }
    // Advance position by the group size
    currentPosition += players.length
  }

  return placements
}
