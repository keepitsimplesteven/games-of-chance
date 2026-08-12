import type { Circumstance, PlayDefinition } from "./types"

/**
 * Selects a single PlayDefinition from a pool using weighted random selection.
 *
 * Algorithm:
 * 1. Filter pool to entries whose circumstances includes the current circumstance
 * 2. If empty, re-filter using "standard" (fallback) and log warning in dev mode
 * 3. Compute total weight = sum of (entry.weight ?? 1) for all valid entries
 * 4. Roll rng() * totalWeight, iterate entries accumulating weight until threshold crossed
 * 5. Return the selected PlayDefinition
 */
export function selectPlay(
  pool: PlayDefinition[],
  circumstance: Circumstance,
  rng: () => number
): PlayDefinition {
  // Step 1: Filter to entries matching the requested circumstance
  let candidates = pool.filter((entry) =>
    entry.circumstances.includes(circumstance)
  )

  // Step 2: Fallback to "standard" if no matches found
  if (candidates.length === 0) {
    candidates = pool.filter((entry) =>
      entry.circumstances.includes("standard")
    )

    if (import.meta.env?.DEV) {
      console.warn(
        `[PlaySelector] No plays found for circumstance "${circumstance}", falling back to "standard"`
      )
    }
  }

  // Step 3: Compute total weight
  const totalWeight = candidates.reduce(
    (sum, entry) => sum + (entry.weight ?? 1),
    0
  )

  // Step 4: Roll and iterate with cumulative weight
  const roll = rng() * totalWeight
  let cumulative = 0

  for (const entry of candidates) {
    cumulative += entry.weight ?? 1
    if (roll < cumulative) {
      return entry
    }
  }

  // Step 5: Return the last entry (handles floating-point edge case where roll === totalWeight)
  return candidates[candidates.length - 1]
}
