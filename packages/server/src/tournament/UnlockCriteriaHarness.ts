import { registry } from "../games/GameRegistry"
import type { TournamentProgress, TournamentTileStatus } from "@games-of-chance/shared"

/**
 * Evaluates the availability of all registered game plugins based on
 * tournament progress and each plugin's unlock criteria.
 */
export function evaluateAvailability(
  progress: TournamentProgress
): Record<string, TournamentTileStatus> {
  const availability: Record<string, TournamentTileStatus> = {}
  const allTypes = registry.list()

  for (const gameType of allTypes) {
    const plugin = registry.lookup(gameType)

    // Already completed → locked
    if (progress.completedGames.includes(gameType)) {
      availability[gameType] = "locked"
      continue
    }

    // Finale gate: unavailable until all non-finale games are complete
    if (plugin.isFinale) {
      const nonFinaleTypes = allTypes.filter(t => {
        const p = registry.lookup(t)
        return !p.isFinale
      })
      const allNonFinaleComplete = nonFinaleTypes.every(t =>
        progress.completedGames.includes(t)
      )
      availability[gameType] = allNonFinaleComplete ? "available" : "unavailable"
      continue
    }

    // Custom unlock criteria
    if (plugin.unlockCriteria) {
      availability[gameType] = plugin.unlockCriteria(progress) ? "available" : "unavailable"
      continue
    }

    // Default: available if not completed
    availability[gameType] = "available"
  }

  return availability
}
