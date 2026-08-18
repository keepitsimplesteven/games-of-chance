/**
 * Lottery odds table and draw utilities for the Playcaller Lottery Mode.
 *
 * The table is a 10×10 matrix where table[seedIndex][placementIndex] = probability
 * of that seed finishing in that placement. Rows sum to ~1.0 and columns sum to ~1.0.
 */

/** Type alias for the lottery probability table: a 2D array of probabilities */
export type LotteryOddsTable = number[][]

/**
 * Default 10×10 lottery odds table.
 *
 * - Rows represent seed positions (0 = Seed 1, worst record / best odds)
 * - Columns represent placement positions (0 = 1st place, 9 = 10th place)
 * - Each cell is the probability of that seed landing in that placement
 */
export const DEFAULT_LOTTERY_ODDS: LotteryOddsTable = [
  // Seed 1 (worst record / highest session rank entering lottery)
  [0.189, 0.163, 0.154, 0.132, 0.125, 0.096, 0.071, 0.043, 0.022, 0.005],
  // Seed 2
  [0.164, 0.153, 0.148, 0.139, 0.123, 0.110, 0.077, 0.054, 0.027, 0.006],
  // Seed 3
  [0.143, 0.140, 0.131, 0.129, 0.131, 0.112, 0.096, 0.071, 0.039, 0.008],
  // Seed 4
  [0.133, 0.134, 0.127, 0.121, 0.121, 0.121, 0.098, 0.081, 0.049, 0.016],
  // Seed 5
  [0.100, 0.111, 0.122, 0.118, 0.120, 0.121, 0.121, 0.098, 0.069, 0.021],
  // Seed 6
  [0.092, 0.096, 0.091, 0.112, 0.110, 0.112, 0.128, 0.123, 0.095, 0.041],
  // Seed 7
  [0.068, 0.079, 0.084, 0.097, 0.098, 0.111, 0.132, 0.142, 0.128, 0.061],
  // Seed 8
  [0.051, 0.062, 0.069, 0.077, 0.078, 0.102, 0.120, 0.153, 0.180, 0.108],
  // Seed 9
  [0.042, 0.042, 0.047, 0.048, 0.058, 0.072, 0.100, 0.140, 0.225, 0.225],
  // Seed 10 (best record / lowest session rank entering lottery)
  [0.019, 0.022, 0.026, 0.028, 0.034, 0.043, 0.057, 0.096, 0.166, 0.509],
]

/**
 * Draws placements for all seeds using sequential weighted sampling without replacement.
 *
 * Algorithm:
 * 1. For placement column 0 (1st place): draw which seed gets it using column 0 probabilities
 * 2. Remove that seed from the remaining pool
 * 3. For placement column 1 (2nd place): normalize remaining seeds' column 1 probabilities, draw
 * 4. Repeat through all placements
 *
 * @param playerCount - Number of players (2-10). Uses first N rows/columns of the table.
 * @param rng - Random number generator returning values in [0, 1)
 * @param table - Optional custom odds table (defaults to DEFAULT_LOTTERY_ODDS)
 * @returns Array where result[seedIndex] = placement (1-based)
 */
export function drawPlacements(
  playerCount: number,
  rng: () => number,
  table: LotteryOddsTable = DEFAULT_LOTTERY_ODDS
): number[] {
  if (playerCount < 2 || playerCount > 10) {
    throw new Error(`playerCount must be between 2 and 10, got ${playerCount}`)
  }

  const result = new Array<number>(playerCount).fill(0)
  const remainingSeeds = Array.from({ length: playerCount }, (_, i) => i)

  for (let placementCol = 0; placementCol < playerCount; placementCol++) {
    // Gather column probabilities for remaining seeds
    const weights = remainingSeeds.map((seed) => table[seed][placementCol])

    // Normalize weights so they sum to 1
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    // Draw a seed from the weighted distribution
    const roll = rng() * totalWeight
    let cumulative = 0
    let chosenIndex = weights.length - 1 // fallback to last remaining seed

    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (roll < cumulative) {
        chosenIndex = i
        break
      }
    }

    const chosenSeed = remainingSeeds[chosenIndex]
    result[chosenSeed] = placementCol + 1 // 1-based placement

    // Remove chosen seed from pool
    remainingSeeds.splice(chosenIndex, 1)
  }

  return result
}

/** Floating-point tolerance for sum validation */
const SUM_TOLERANCE = 0.01

/**
 * Validates a lottery odds table structure and constraints.
 *
 * Checks:
 * - Exactly 10 rows
 * - Each row has exactly 10 columns
 * - Each row sums to ~1.0 (within tolerance)
 * - Each column sums to ~1.0 (within tolerance)
 *
 * @param table - The odds table to validate
 * @returns true if the table passes all checks
 */
export function validateOddsTable(table: LotteryOddsTable): boolean {
  if (table.length !== 10) return false

  for (const row of table) {
    if (row.length !== 10) return false
    const rowSum = row.reduce((sum, val) => sum + val, 0)
    if (Math.abs(rowSum - 1.0) > SUM_TOLERANCE) return false
  }

  for (let col = 0; col < 10; col++) {
    let colSum = 0
    for (let row = 0; row < 10; row++) {
      colSum += table[row][col]
    }
    if (Math.abs(colSum - 1.0) > SUM_TOLERANCE) return false
  }

  return true
}
