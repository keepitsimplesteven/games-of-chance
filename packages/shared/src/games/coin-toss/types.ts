// packages/shared/src/games/coin-toss/types.ts
// Coin-toss-specific shared types

/** The two possible sides of a coin */
export type CoinSide = "HEADS" | "TAILS"

/** A player's pick for a coin toss round */
export interface CoinTossPick {
  side: CoinSide
}

/** The result of a coin toss round resolved by the server */
export interface CoinTossResult {
  outcome: CoinSide
  /** Timestamp (epoch ms) when the coin was flipped — used for animation sync */
  flippedAt: number
}

/** A single entry in the toss history — one per resolved round */
export interface TossHistoryEntry {
  /** The actual coin outcome for this round */
  outcome: CoinSide
  /** Each player's pick for this round (playerId → side) */
  picks: Record<string, CoinSide>
  /** Each player's score delta for this round (after multiplier) */
  deltas: Record<string, number>
}

/** Game state broadcast to clients during a coin-toss game */
export interface CoinTossGameState {
  /** Ordered list of all resolved toss results + picks (index 0 = round 1) */
  tossHistory: TossHistoryEntry[]
}
