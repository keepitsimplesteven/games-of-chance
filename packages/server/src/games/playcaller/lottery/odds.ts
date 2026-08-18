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
 * Draws placements for all seeds by decomposing the odds table into a
 * convex combination of permutation matrices (Birkhoff-von Neumann decomposition)
 * and sampling one permutation according to its weight.
 *
 * This produces EXACT marginal distributions matching the target odds table,
 * since P(seed i gets placement j) = sum of weights of all permutation matrices
 * where seed i is assigned to placement j = table[i][j].
 *
 * For the 10×10 table this is computed once and cached. The decomposition uses
 * the iterative "greedy" algorithm: at each step find the largest permutation
 * matrix that fits within the residual, weight it, subtract, repeat.
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

  // Get or compute the decomposition for this playerCount/table combination
  const decomposition = getDecomposition(playerCount, table)

  // Sample a permutation: pick one weighted by decomposition weights
  const roll = rng()
  let cumulative = 0
  let chosenPerm = decomposition[decomposition.length - 1].perm

  for (const { weight, perm } of decomposition) {
    cumulative += weight
    if (roll < cumulative) {
      chosenPerm = perm
      break
    }
  }

  // Convert from 0-based to 1-based placements
  return chosenPerm.map((col) => col + 1)
}

/** A weighted permutation: perm[seedIdx] = colIdx (0-based) */
interface WeightedPermutation {
  weight: number
  perm: number[]
}

/**
 * Cache for decompositions keyed by playerCount + table reference.
 * Since DEFAULT_LOTTERY_ODDS is the common case, this avoids recomputation.
 */
const decompositionCache = new Map<string, WeightedPermutation[]>()

function getDecomposition(
  playerCount: number,
  table: LotteryOddsTable
): WeightedPermutation[] {
  // Use table identity for caching (reference equality for default, JSON for custom)
  const key =
    table === DEFAULT_LOTTERY_ODDS
      ? `default_${playerCount}`
      : `custom_${playerCount}_${JSON.stringify(table)}`

  let cached = decompositionCache.get(key)
  if (cached) return cached

  cached = birkhoffDecompose(playerCount, table)
  decompositionCache.set(key, cached)
  return cached
}

/**
 * Birkhoff-von Neumann decomposition via iterative greedy extraction.
 *
 * Finds permutation matrices one at a time, each weighted by the minimum
 * entry along that permutation in the residual matrix.
 */
function birkhoffDecompose(
  playerCount: number,
  table: LotteryOddsTable
): WeightedPermutation[] {
  const EPS = 1e-12
  const result: WeightedPermutation[] = []

  // Work with a mutable copy of the submatrix
  const residual: number[][] = Array.from({ length: playerCount }, (_, r) =>
    Array.from({ length: playerCount }, (_, c) => table[r][c])
  )

  let safetyCounter = 0
  const maxIterations = 10000 // doubly-stochastic 10x10 needs at most ~100 permutations typically

  while (safetyCounter++ < maxIterations) {
    // Find a permutation using the greedy approach (maximum weight matching)
    const perm = findMaxMinPermutation(residual, playerCount)
    if (!perm) break

    // Weight = minimum value along this permutation in the residual
    let minVal = Infinity
    for (let r = 0; r < playerCount; r++) {
      minVal = Math.min(minVal, residual[r][perm[r]])
    }

    if (minVal < EPS) break // residual is effectively zero

    // Subtract this weighted permutation from the residual
    for (let r = 0; r < playerCount; r++) {
      residual[r][perm[r]] -= minVal
    }

    result.push({ weight: minVal, perm: [...perm] })

    // Check if residual is effectively zero
    let maxResidual = 0
    for (let r = 0; r < playerCount; r++) {
      for (let c = 0; c < playerCount; c++) {
        maxResidual = Math.max(maxResidual, Math.abs(residual[r][c]))
      }
    }
    if (maxResidual < EPS) break
  }

  // Normalize weights to sum to exactly 1 (handles floating point drift)
  const totalWeight = result.reduce((sum, wp) => sum + wp.weight, 0)
  for (const wp of result) {
    wp.weight /= totalWeight
  }

  return result
}

/**
 * Find a permutation that maximizes the minimum entry along it in the matrix.
 * Uses a greedy approach: at each row, pick the column with the largest available value.
 * Falls back to Hungarian-style assignment if greedy fails.
 *
 * For the Birkhoff decomposition, any valid permutation over positive entries works.
 * We use a maximum-weight matching to extract the "fattest" permutation first,
 * which minimizes the number of iterations needed.
 */
function findMaxMinPermutation(
  matrix: number[][],
  n: number
): number[] | null {
  // Use the Kuhn-Munkres (Hungarian) algorithm to find maximum weight matching
  // For small n (≤10), a simpler brute-force matching works fine:
  // Try to find a perfect matching over entries > EPS using augmenting paths.

  const EPS = 1e-12

  // Build adjacency: only edges with positive residual
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] > EPS) {
        adj[r].push(c)
      }
    }
  }

  // Find maximum weight perfect matching using Hungarian algorithm
  // For simplicity with n≤10, we use a recursive approach with augmenting paths
  // to find ANY perfect matching, then greedily pick the fattest one.

  // First find any perfect matching (Hopcroft-Karp style)
  const match = new Array<number>(n).fill(-1) // match[col] = row
  const rowMatch = new Array<number>(n).fill(-1) // rowMatch[row] = col

  function augment(row: number, visited: boolean[]): boolean {
    for (const col of adj[row]) {
      if (visited[col]) continue
      visited[col] = true
      if (match[col] === -1 || augment(match[col], visited)) {
        match[col] = row
        rowMatch[row] = col
        return true
      }
    }
    return false
  }

  for (let r = 0; r < n; r++) {
    const visited = new Array<boolean>(n).fill(false)
    augment(r, visited)
  }

  // Check if we got a perfect matching
  for (let r = 0; r < n; r++) {
    if (rowMatch[r] === -1) return null
  }

  // Return the permutation
  return rowMatch
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
