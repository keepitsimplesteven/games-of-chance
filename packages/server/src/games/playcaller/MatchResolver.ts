import type { MatchResolver } from "@games-of-chance/shared"

/**
 * Phase 1 random resolver: selects a winner uniformly at random.
 */
export const randomResolver: MatchResolver = (playerA: string, playerB: string): string => {
  return Math.random() < 0.5 ? playerA : playerB
}
