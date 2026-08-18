/**
 * Convert an ordered array of player IDs to a seeds record.
 * Position 0 → seed 1, position 1 → seed 2, etc.
 */
export function buildSeedsRecord(orderedIds: string[]): Record<string, number> {
  const seeds: Record<string, number> = {}
  orderedIds.forEach((id, i) => {
    seeds[id] = i + 1
  })
  return seeds
}

/**
 * Sort player IDs by their seed value ascending.
 * Players without a seed entry sort to the end.
 */
export function sortBySeed(
  playerIds: string[],
  seeds: Record<string, number>
): string[] {
  return [...playerIds].sort(
    (a, b) => (seeds[a] ?? Infinity) - (seeds[b] ?? Infinity)
  )
}
