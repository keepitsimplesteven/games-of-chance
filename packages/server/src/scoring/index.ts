import type { ScoringMode } from "@games-of-chance/shared"
import type { SessionScoringStrategy } from "./SessionScoringStrategy"
import { GrandPrixStrategy } from "./GrandPrixStrategy"
import { ChipsStrategy } from "./ChipsStrategy"

export { type SessionScoringStrategy, computeSessionRanks } from "./SessionScoringStrategy"
export { GrandPrixStrategy } from "./GrandPrixStrategy"
export { ChipsStrategy } from "./ChipsStrategy"

/**
 * Factory function to get the appropriate scoring strategy for a given mode.
 * Optionally accepts placementPoints for GrandPrix customization.
 */
export function getStrategy(
  mode: ScoringMode,
  placementPoints?: number[]
): SessionScoringStrategy {
  switch (mode) {
    case "grand-prix":
      return new GrandPrixStrategy(placementPoints)
    case "chips":
      return new ChipsStrategy()
    default:
      throw new Error(`Unknown scoring mode: ${mode}`)
  }
}
