import type { MatchResolver, Bracket, BracketRound, Matchup, ConsolationRound, GameRoundSchedule } from "@games-of-chance/shared"
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
 * Returns a human-readable label for a bracket round based on its position relative to the final.
 * Used to populate GameRoundSchedule.description.
 */
export function getScheduleRoundLabel(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundIndex
  if (roundsFromEnd === 1) return "Finals"
  if (roundsFromEnd === 2) return "Semifinals"
  if (roundsFromEnd === 3) return "Quarterfinals"
  // Round 0 with byes is always the Play-in
  if (roundIndex === 0 && totalRounds > 3) return "Play-in"
  return `Round ${roundIndex + 1}`
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

  // Build the initial schedule entry for the first round
  const initialDescription = getScheduleRoundLabel(0, totalRounds)

  return {
    rounds,
    currentRoundIndex: 0,
    totalRounds,
    seeds,
    eliminated: {},
    consolationRounds: [],
    currentConsolationIndex: 0,
    schedule: [{ mainBracketRoundIndex: 0, consolationRoundIndices: [], description: initialDescription }],
    currentScheduleIndex: 0,
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
 * Checks if the bracket is fully complete — main bracket resolved AND all consolation rounds resolved.
 * Returns true when:
 * - Main bracket is complete (champion determined), AND
 * - Either no consolation rounds exist, OR all consolation rounds are resolved
 */
export function isFullyComplete(bracket: Bracket): boolean {
  if (!isComplete(bracket)) return false
  if (bracket.consolationRounds.length === 0) return true
  return bracket.consolationRounds.every((r) => r.resolved)
}

/**
 * Resolves the current consolation round's matchups, marks it resolved, and advances currentConsolationIndex.
 *
 * When the current consolation round is part of a mini-bracket (e.g., 5th-8th bracket),
 * the winners are placed into the next consolation round's matchup slots if that next round
 * shares the same `placementStart` (indicating it's the next round of the same mini-bracket).
 *
 * @param bracket - Current bracket state (main bracket must be complete)
 * @param resolver - Match resolution function
 * @returns Updated bracket with current consolation round resolved and winners placed
 */
export function resolveConsolationRound(
  bracket: Bracket,
  resolver: MatchResolver
): Bracket {
  if (bracket.currentConsolationIndex >= bracket.consolationRounds.length) {
    return bracket // No consolation rounds left to resolve
  }

  const currentRound = bracket.consolationRounds[bracket.currentConsolationIndex]

  // Resolve each matchup using the resolver
  for (const matchup of currentRound.matchups) {
    const winner = resolver(matchup.playerA, matchup.playerB)

    // Validate that resolver returned one of the two input IDs
    if (winner !== matchup.playerA && winner !== matchup.playerB) {
      throw new Error("Match resolver returned an invalid player ID")
    }

    matchup.winner = winner
  }

  // Mark current round as resolved
  currentRound.resolved = true

  // Check if the next consolation round is part of the same mini-bracket
  // (same placementStart indicates it's the final round of a mini-bracket whose semi-finals just resolved)
  const nextIndex = bracket.currentConsolationIndex + 1
  if (nextIndex < bracket.consolationRounds.length) {
    const nextRound = bracket.consolationRounds[nextIndex]
    if (nextRound.placementStart === currentRound.placementStart) {
      // Fill next round's matchup slots with the winners from the current round
      // Winners from adjacent matchups feed into the same next-round matchup (same as main bracket)
      const winners: string[] = currentRound.matchups.map((m) => m.winner!)

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

  // Advance consolation index
  bracket.currentConsolationIndex++

  return bracket
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

  // Check if consolation data exists and is fully resolved
  const hasResolvedConsolation =
    bracket.consolationRounds.length > 0 &&
    bracket.consolationRounds.every((r) => r.resolved)

  if (hasResolvedConsolation) {
    // Use consolation results for unique placements
    // Runner-up (final-round loser) gets 2nd
    const finalMatchup = finalRound.matchups[0]
    const runnerUp =
      finalMatchup.playerA === champion ? finalMatchup.playerB : finalMatchup.playerA
    placements.set(runnerUp, 2)

    // Group consolation rounds by placementStart to identify mini-brackets
    const groupedByPlacement = new Map<number, ConsolationRound[]>()
    for (const round of bracket.consolationRounds) {
      if (!groupedByPlacement.has(round.placementStart)) {
        groupedByPlacement.set(round.placementStart, [])
      }
      groupedByPlacement.get(round.placementStart)!.push(round)
    }

    // Process each consolation group
    for (const [placementStart, rounds] of groupedByPlacement) {
      if (rounds.length === 1) {
        // Single consolation round (2-player group)
        const matchup = rounds[0].matchups[0]
        const winner = matchup.winner!
        const loser = matchup.playerA === winner ? matchup.playerB : matchup.playerA
        placements.set(winner, placementStart)
        placements.set(loser, placementStart + 1)
      } else if (rounds.length === 2) {
        // Mini-bracket (4-player group): semi-finals + final
        // The second round is the final
        const semiFinalRound = rounds[0]
        const finalRoundConsolation = rounds[1]

        // Final winner gets placementStart, final loser gets placementStart + 1
        const finalMatchupConsolation = finalRoundConsolation.matchups[0]
        const finalWinner = finalMatchupConsolation.winner!
        const finalLoser =
          finalMatchupConsolation.playerA === finalWinner
            ? finalMatchupConsolation.playerB
            : finalMatchupConsolation.playerA
        placements.set(finalWinner, placementStart)
        placements.set(finalLoser, placementStart + 1)

        // Semi-final losers get placementStart + 2 and placementStart + 3
        // Ordered by their matchup order (first matchup loser gets better placement)
        let semiLoserPosition = placementStart + 2
        for (const matchup of semiFinalRound.matchups) {
          const semiWinner = matchup.winner!
          const semiLoser =
            matchup.playerA === semiWinner ? matchup.playerB : matchup.playerA
          placements.set(semiLoser, semiLoserPosition)
          semiLoserPosition++
        }
      } else {
        // Multiple consolation rounds for larger groups (pairwise matchups)
        for (const round of rounds) {
          for (let i = 0; i < round.matchups.length; i++) {
            const matchup = round.matchups[i]
            const winner = matchup.winner!
            const loser = matchup.playerA === winner ? matchup.playerB : matchup.playerA
            // Each pairwise matchup assigns two consecutive placements
            const basePos = round.placementStart + i * 2
            placements.set(winner, basePos)
            placements.set(loser, basePos + 1)
          }
        }
      }
    }
  } else {
    // Fallback: existing shared-placement behavior (backwards compatible)
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
  }

  return placements
}

/**
 * Generates consolation rounds for players eliminated in a SPECIFIC main-bracket round.
 *
 * This function enables incremental consolation generation — it can be called
 * immediately after a round resolves, rather than waiting for the entire main bracket
 * to complete. The generated rounds can then be scheduled concurrently with the
 * next main-bracket round.
 *
 * Placement computation:
 * - Players eliminated later in the tournament get better placements
 * - placementStart for round R = 2 + (total players eliminated in rounds > R)
 *
 * @param bracket - Current bracket state (must have elimination data for the specified round)
 * @param roundIndex - The main-bracket round whose eliminated players need consolation matchups
 * @param consolationIndexOffset - Starting index for consolation round numbering (defaults to bracket.consolationRounds.length)
 * @returns Array of ConsolationRound objects for the eliminated players in the specified round
 */
export function generateConsolationForRound(
  bracket: Bracket,
  roundIndex: number,
  consolationIndexOffset?: number
): ConsolationRound[] {
  const consolationRounds: ConsolationRound[] = []

  // Find players eliminated in the specified round
  const players: string[] = []
  for (const [playerId, eliminatedRound] of Object.entries(bracket.eliminated)) {
    if (eliminatedRound === roundIndex) {
      players.push(playerId)
    }
  }

  // Groups of 0 or 1 player don't need consolation matchups
  if (players.length < 2) {
    return consolationRounds
  }

  // Sort players by seed (lower seed = better) for consistent matchup ordering
  players.sort((a, b) => bracket.seeds[a] - bracket.seeds[b])

  // Compute placementStart for this group:
  // placementStart = (players remaining after this round) + 1
  // This works correctly for both incremental generation (right after round R resolves)
  // and batch generation (all rounds resolved). Players eliminated later get better placements.
  let eliminatedUpToThisRound = 0
  for (const [, eliminatedRound] of Object.entries(bracket.eliminated)) {
    if (eliminatedRound <= roundIndex) {
      eliminatedUpToThisRound++
    }
  }
  const totalPlayers = Object.keys(bracket.seeds).length
  const playersRemaining = totalPlayers - eliminatedUpToThisRound
  const placementStart = playersRemaining + 1

  // Determine starting consolation index
  let consolationIndex = consolationIndexOffset ?? bracket.consolationRounds.length

  if (players.length === 2) {
    // Single matchup: higher seed (lower number) as playerA
    consolationRounds.push({
      roundIndex: consolationIndex,
      matchups: [
        {
          matchupId: `c${consolationIndex}-m0`,
          playerA: players[0],
          playerB: players[1],
          winner: null,
        },
      ],
      resolved: false,
      sourceRoundIndex: roundIndex,
      placementStart,
    })
  } else if (players.length === 4) {
    // Two pairwise matchups: best vs worst seed, 2nd vs 3rd seed
    // First matchup determines placementStart / placementStart+1
    consolationRounds.push({
      roundIndex: consolationIndex,
      matchups: [{
        matchupId: `c${consolationIndex}-m0`,
        playerA: players[0], // best seed
        playerB: players[3], // worst seed
        winner: null,
      }],
      resolved: false,
      sourceRoundIndex: roundIndex,
      placementStart,
    })
    consolationIndex++

    // Second matchup determines placementStart+2 / placementStart+3
    consolationRounds.push({
      roundIndex: consolationIndex,
      matchups: [{
        matchupId: `c${consolationIndex}-m0`,
        playerA: players[1], // 2nd best seed
        playerB: players[2], // 3rd best seed
        winner: null,
      }],
      resolved: false,
      sourceRoundIndex: roundIndex,
      placementStart: placementStart + 2,
    })
  } else if (players.length > 4) {
    // For groups larger than 4, create pairwise matchups
    // This handles unusual cases (e.g., 6 or 8 players eliminated in same round)
    for (let i = 0; i < players.length; i += 2) {
      if (i + 1 < players.length) {
        consolationRounds.push({
          roundIndex: consolationIndex,
          matchups: [
            {
              matchupId: `c${consolationIndex}-m0`,
              playerA: players[i],
              playerB: players[i + 1],
              winner: null,
            },
          ],
          resolved: false,
          sourceRoundIndex: roundIndex,
          placementStart: placementStart + i,
        })
        consolationIndex++
      }
    }
  }

  return consolationRounds
}

/**
 * Generates consolation rounds for a completed bracket.
 *
 * Groups eliminated players by the round they were eliminated in, then generates
 * matchups for each group to determine unique placements:
 * - Groups of 2 players: 1 matchup (single placement game)
 * - Groups of 4 players: mini single-elimination bracket (2 semi-finals + 1 final = 3 matchups across 2 consolation rounds)
 *
 * Consolation rounds are ordered from best placement group to worst
 * (e.g., 3rd/4th game first, then 5th-8th bracket, then 9th/10th game).
 *
 * This function is a backward-compatible wrapper that calls `generateConsolationForRound`
 * for each elimination round, producing identical output to the original implementation.
 *
 * @param bracket - A completed bracket (all main rounds resolved)
 * @returns Array of ConsolationRound objects ready for resolution
 */
export function generateConsolationRounds(bracket: Bracket): ConsolationRound[] {
  const consolationRounds: ConsolationRound[] = []

  // Group eliminated players by the round they were eliminated in
  const eliminatedByRound = new Map<number, string[]>()
  for (const [playerId, roundIndex] of Object.entries(bracket.eliminated)) {
    if (!eliminatedByRound.has(roundIndex)) {
      eliminatedByRound.set(roundIndex, [])
    }
    eliminatedByRound.get(roundIndex)!.push(playerId)
  }

  // Sort rounds in descending order (latest round = best placement first)
  // This gives us resolution order: semi-final losers first, then quarter-final, etc.
  const sortedRounds = Array.from(eliminatedByRound.keys()).sort((a, b) => b - a)

  // Generate consolation for each round using the incremental function
  let consolationIndex = 0
  for (const roundIndex of sortedRounds) {
    const players = eliminatedByRound.get(roundIndex)!
    // Skip groups of 1 (no consolation needed, e.g., runner-up)
    if (players.length < 2) {
      continue
    }

    const roundConsolation = generateConsolationForRound(bracket, roundIndex, consolationIndex)
    consolationRounds.push(...roundConsolation)
    consolationIndex += roundConsolation.length
  }

  return consolationRounds
}


/**
 * Builds the game-round schedule for a bracket, consolidating ALL consolation
 * matchups into a single dedicated round between semifinals and finals.
 *
 * Schedule order: main-bracket rounds (Play-in through Semifinals) → Consolation → Finals
 *
 * @param bracket - Current bracket state
 * @returns Array of GameRoundSchedule entries defining the order of play
 */
export function buildSchedule(bracket: Bracket): GameRoundSchedule[] {
  const schedule: GameRoundSchedule[] = []
  const finalsRoundIndex = bracket.totalRounds - 1

  // 1. Add all main-bracket rounds EXCEPT finals
  for (let r = 0; r < finalsRoundIndex; r++) {
    schedule.push({
      mainBracketRoundIndex: r,
      consolationRoundIndices: [],
      description: getRoundDescription(r, bracket.totalRounds),
    })
  }

  // 2. Insert single consolation round (ALL consolation indices) before finals
  if (bracket.consolationRounds.length > 0) {
    const allConsolationIndices = bracket.consolationRounds.map((_, idx) => idx)
    schedule.push({
      mainBracketRoundIndex: null,
      consolationRoundIndices: allConsolationIndices,
      description: "Consolation",
    })
  }

  // 3. Finals round (always last, always alone)
  schedule.push({
    mainBracketRoundIndex: finalsRoundIndex,
    consolationRoundIndices: [],
    description: "Finals",
  })

  return schedule
}

/**
 * Gets a human-readable description for a main-bracket round.
 */
function getRoundDescription(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - 1 - roundIndex
  if (roundsFromEnd === 0) return "Finals"
  if (roundsFromEnd === 1) return "Semifinals"
  if (roundsFromEnd === 2) return "Quarterfinals"
  if (roundIndex === 0) return "Play-in"
  return `Round ${roundIndex + 1}`
}

/**
 * Gets a human-readable label for a consolation round based on its placement position and matchup count.
 * - Single matchup: "9th/10th", "5th/6th", "3rd/4th"
 * - Two matchups (mini-bracket semi-finals): "5th-8th SF"
 * - Other: "5th+ Consolation"
 */
export function getConsolationLabel(cRound: ConsolationRound): string {
  const ps = cRound.placementStart
  if (cRound.matchups.length === 2) {
    // Mini-bracket semi-finals (e.g., 5th-8th SF)
    return `${ordinal(ps)}-${ordinal(ps + 3)} SF`
  }
  if (cRound.matchups.length === 1) {
    // Single matchup: "9th/10th", "5th/6th", "3rd/4th"
    return `${ordinal(ps)}/${ordinal(ps + 1)}`
  }
  return `${ordinal(ps)}+ Consolation`
}

/**
 * Returns all active matchups for a given schedule entry, merging main-bracket
 * and consolation matchups into a single array.
 *
 * Filters out matchups with empty playerA or playerB to prevent the
 * "No active matchups" hang that occurs when consolation mini-bracket finals
 * have not yet been populated with semi-final winners.
 *
 * @param bracket - Current bracket state
 * @param scheduleEntry - The schedule entry to look up matchups for
 * @returns Array of Matchup objects with valid playerA and playerB values
 */
export function getActiveMatchupsForSchedule(
  bracket: Bracket,
  scheduleEntry: GameRoundSchedule
): Matchup[] {
  const matchups: Matchup[] = []

  // Gather main-bracket matchups if this schedule entry has a main-bracket round
  if (scheduleEntry.mainBracketRoundIndex !== null) {
    const mainRound = bracket.rounds[scheduleEntry.mainBracketRoundIndex]
    if (mainRound) {
      for (const matchup of mainRound.matchups) {
        matchups.push(matchup)
      }
    }
  }

  // Gather consolation matchups from all referenced consolation round indices
  for (const cIdx of scheduleEntry.consolationRoundIndices) {
    const cRound = bracket.consolationRounds[cIdx]
    if (cRound) {
      for (const matchup of cRound.matchups) {
        matchups.push(matchup)
      }
    }
  }

  // Filter out matchups with empty playerA or playerB (prevents "No active matchups" hang)
  return matchups.filter(
    (m) => m.playerA !== "" && m.playerB !== ""
  )
}

/**
 * Returns ordinal string for a number (e.g., 1 → "1st", 2 → "2nd", 3 → "3rd").
 */
export function ordinal(n: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" }
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  return `${n}${suffixes[n % 10] || "th"}`
}
