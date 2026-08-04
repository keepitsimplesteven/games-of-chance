import type { MatchResolver, Bracket, BracketRound, Matchup } from "@games-of-chance/shared"
import { PLAYCALLER } from "./constants"

/**
 * Resolves all matchups in the current (active) bracket round.
 * Advances winners to the next round. Advances bye players automatically.
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
    // Collect advancers: all winners from matchups + all bye players from this round
    const advancers: string[] = []
    for (const matchup of currentRound.matchups) {
      advancers.push(matchup.winner!)
    }
    for (const byePlayer of currentRound.byes) {
      advancers.push(byePlayer)
    }

    // Place advancers into next round's matchup slots in order:
    // first → first matchup playerA, second → first matchup playerB,
    // third → second matchup playerA, etc.
    const nextRound = bracket.rounds[bracket.currentRoundIndex + 1]
    for (let i = 0; i < advancers.length; i++) {
      const matchupIndex = Math.floor(i / 2)
      if (i % 2 === 0) {
        nextRound.matchups[matchupIndex].playerA = advancers[i]
      } else {
        nextRound.matchups[matchupIndex].playerB = advancers[i]
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

  // Pair non-bye players: highest remaining vs lowest remaining, inward
  const firstRoundMatchups: Matchup[] = []
  const half = nonByePlayers.length / 2
  for (let i = 0; i < half; i++) {
    const higher = nonByePlayers[i] // highest remaining seed
    const lower = nonByePlayers[nonByePlayers.length - 1 - i] // lowest remaining seed
    firstRoundMatchups.push({
      matchupId: `r0-m${i}`,
      playerA: higher,
      playerB: lower,
      winner: null,
    })
  }

  // Build all rounds
  const rounds: BracketRound[] = []

  // Round 0 (first round): the actual matchups among non-bye players
  rounds.push({
    roundIndex: 0,
    matchups: firstRoundMatchups,
    byes: byePlayers,
    resolved: false,
  })

  // Pre-compute subsequent rounds with empty matchup slots
  let participantsInNextRound = firstRoundMatchups.length + byeCount
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
