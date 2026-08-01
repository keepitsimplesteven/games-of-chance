import type { GameType } from "@games-of-chance/shared"

export interface SimulationConfig {
  /** Registered game type to simulate */
  gameType: GameType
  /** Number of bot players per game */
  playerCount: number
  /** Rounds per game */
  roundCount: number
  /** Number of complete games to simulate (1 for fast-play, 1M for Monte Carlo) */
  gameCount: number
  /** Optional seed for deterministic PRNG — omit for true randomness */
  seed?: number
}
