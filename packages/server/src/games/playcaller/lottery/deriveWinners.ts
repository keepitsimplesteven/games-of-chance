/**
 * Derives predetermined matchup winners from a target placement ordering.
 *
 * Walks through the bracket sequentially, simulating advancement so that later-round
 * matchup slots are populated before their winners are determined. For each matchup,
 * the player with the lower target placement number (better finish) wins.
 *
 * Also handles consolation rounds using the same logic.
 */

import type { Bracket, Matchup, ConsolationRound } from "@games-of-chance/shared"
import { standardBracketOrder } from "../BracketEngine"

/**
 * Derives the predetermined winner for every matchup (main bracket + consolation)
 * based on the target placements drawn from the lottery.
 *
 * @param bracket - The fully generated bracket (with consolation rounds attached).
 *                  Matchup slots in later rounds may be empty — this function fills them via simulation.
 * @param targetPlacements - Map of playerId → target placement (1-based, lower is better)
 * @returns Record of matchupId → winnerId for ALL matchups
 */
export function deriveMatchupWinners(
  bracket: Bracket,
  targetPlacements: Map<string, number>
): Record<string, string> {
  const winners: Record<string, string> = {}

  // Deep-clone the bracket rounds so we can mutate slots without affecting the original
  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matchups: round.matchups.map((m) => ({ ...m })),
    byes: [...round.byes],
  }))

  // ── Main Bracket ─────────────────────────────────────────────────────

  for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
    const currentRound = rounds[roundIdx]

    // Determine winners for each matchup in this round
    for (const matchup of currentRound.matchups) {
      if (!matchup.playerA || !matchup.playerB) {
        // Should not happen if bracket was generated correctly, but guard anyway
        continue
      }

      const placementA = targetPlacements.get(matchup.playerA)!
      const placementB = targetPlacements.get(matchup.playerB)!

      // Lower placement number = better finish = wins the matchup
      const winner = placementA < placementB ? matchup.playerA : matchup.playerB
      matchup.winner = winner
      winners[matchup.matchupId] = winner
    }

    // Simulate advancement: place winners into next round slots
    const isLastRound = roundIdx >= rounds.length - 1
    if (!isLastRound) {
      const nextRound = rounds[roundIdx + 1]

      if (currentRound.byes.length > 0) {
        // Play-in round: use standard bracket seeding order (same as resolveCurrentRound)
        const advancers: { playerId: string; effectiveSeed: number }[] = []

        // Bye players advance with their original seed
        for (const byePlayer of currentRound.byes) {
          advancers.push({ playerId: byePlayer, effectiveSeed: bracket.seeds[byePlayer] })
        }

        // Play-in winners: effective seed = the higher seed of the matchup pair (playerA's seed)
        for (const matchup of currentRound.matchups) {
          const effectiveSeed = bracket.seeds[matchup.playerA]
          advancers.push({ playerId: matchup.winner!, effectiveSeed })
        }

        // Sort by effective seed
        advancers.sort((a, b) => a.effectiveSeed - b.effectiveSeed)

        // Apply standard bracket seeding order
        const mainBracketSize = advancers.length
        const order = standardBracketOrder(mainBracketSize)

        for (let i = 0; i < order.length; i += 2) {
          const matchupIndex = Math.floor(i / 2)
          const seedPositionA = order[i] - 1
          const seedPositionB = order[i + 1] - 1
          nextRound.matchups[matchupIndex].playerA = advancers[seedPositionA].playerId
          nextRound.matchups[matchupIndex].playerB = advancers[seedPositionB].playerId
        }
      } else {
        // Normal round: winners placed sequentially into next round
        const roundWinners: string[] = currentRound.matchups.map((m) => m.winner!)

        for (let i = 0; i < roundWinners.length; i++) {
          const matchupIndex = Math.floor(i / 2)
          if (i % 2 === 0) {
            nextRound.matchups[matchupIndex].playerA = roundWinners[i]
          } else {
            nextRound.matchups[matchupIndex].playerB = roundWinners[i]
          }
        }
      }
    }
  }

  // ── Consolation Rounds ───────────────────────────────────────────────

  // Deep-clone consolation rounds so we can fill in player slots for mini-bracket finals
  const consolationRounds = bracket.consolationRounds.map((round) => ({
    ...round,
    matchups: round.matchups.map((m) => ({ ...m })),
  }))

  for (let i = 0; i < consolationRounds.length; i++) {
    const currentRound = consolationRounds[i]

    // Determine winners for each matchup
    for (const matchup of currentRound.matchups) {
      if (!matchup.playerA || !matchup.playerB) {
        continue
      }

      const placementA = targetPlacements.get(matchup.playerA)!
      const placementB = targetPlacements.get(matchup.playerB)!

      const winner = placementA < placementB ? matchup.playerA : matchup.playerB
      matchup.winner = winner
      winners[matchup.matchupId] = winner
    }

    // Advance winners to the next consolation round if it's part of the same mini-bracket
    const nextIndex = i + 1
    if (nextIndex < consolationRounds.length) {
      const nextRound = consolationRounds[nextIndex]
      if (nextRound.placementStart === currentRound.placementStart) {
        // Fill next round's matchup slots with current round winners (same as resolveConsolationRound)
        const roundWinners: string[] = currentRound.matchups.map((m) => m.winner!)

        for (let w = 0; w < roundWinners.length; w++) {
          const matchupIndex = Math.floor(w / 2)
          if (w % 2 === 0) {
            nextRound.matchups[matchupIndex].playerA = roundWinners[w]
          } else {
            nextRound.matchups[matchupIndex].playerB = roundWinners[w]
          }
        }
      }
    }
  }

  return winners
}
