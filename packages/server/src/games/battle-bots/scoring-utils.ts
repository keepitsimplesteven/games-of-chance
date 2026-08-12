import type { GameLeaderboardEntry } from "@games-of-chance/shared"
import { PENALTY_MULTIPLIER, SURVIVOR_POINTS, WIN_BONUS } from "./scoring-constants"

/**
 * Filters bot persona IDs from score deltas.
 * Bot personas participate in battles but must not appear in scoring outputs.
 */
export function filterBotPersonasFromDeltas(
  deltas: Record<string, number>,
  botPersonaIds: Set<string>
): Record<string, number> {
  const filtered: Record<string, number> = {}
  for (const [id, delta] of Object.entries(deltas)) {
    if (!botPersonaIds.has(id)) {
      filtered[id] = delta
    }
  }
  return filtered
}

/**
 * Filters bot persona entries from the game leaderboard.
 * Bot personas hold bracket positions but must not appear in leaderboard results.
 */
export function filterBotPersonasFromLeaderboard(
  leaderboard: GameLeaderboardEntry[],
  botPersonaIds: Set<string>
): GameLeaderboardEntry[] {
  return leaderboard.filter((entry) => !botPersonaIds.has(entry.playerId))
}

/**
 * Computes survival points for an eliminated FFA player.
 * Formula: ceil(eliminatedTick / (totalTicks * PENALTY_MULTIPLIER) * SURVIVOR_POINTS)
 *
 * @param eliminatedTick - The tick on which the player was eliminated
 * @param totalTicks - The tick on which the final elimination occurred (declaring the survivor)
 * @returns Survival points (integer, max 91 with default constants)
 */
export function computeEliminatedSurvivalPoints(
  eliminatedTick: number,
  totalTicks: number
): number {
  return Math.ceil((eliminatedTick / (totalTicks * PENALTY_MULTIPLIER)) * SURVIVOR_POINTS)
}

/**
 * Computes the total score for the FFA survivor.
 * Flat SURVIVOR_POINTS + WIN_BONUS.
 *
 * @returns Total survivor score (125 with default constants)
 */
export function computeSurvivorScore(): number {
  return SURVIVOR_POINTS + WIN_BONUS
}
