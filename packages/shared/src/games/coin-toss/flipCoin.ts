import type { CoinSide } from "./types"

export type RngFunction = () => number

/**
 * Resolves a coin flip using the provided RNG function.
 * Returns "HEADS" when rng() < 0.5, "TAILS" otherwise.
 * Defaults to Math.random when no RNG is provided.
 */
export function flipCoin(rng: RngFunction = Math.random): CoinSide {
  return rng() < 0.5 ? "HEADS" : "TAILS"
}
