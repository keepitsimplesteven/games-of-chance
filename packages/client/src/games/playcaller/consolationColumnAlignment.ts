/**
 * Pure function extracting the consolation column alignment logic for testability.
 *
 * This mirrors the logic in BracketVisualization.tsx's ConsolationRow component,
 * making it possible to property-test independently of React rendering.
 *
 * Column alignment formula: totalRounds - 1 - floor((placementStart - 3) / 2)
 *
 * For 10 players (4 columns): 9th/10th→col 0, 7th/8th→col 1, 5th/6th→col 2, 3rd/4th→col 3
 * For 8 players (3 columns):  7th/8th→col 0, 5th/6th→col 1, 3rd/4th→col 2
 */

/**
 * Computes the visual column index where a consolation round should be rendered,
 * aligning it with the corresponding main-bracket column.
 *
 * @param placementStart - The starting placement position (e.g. 3 for 3rd/4th place)
 * @param totalRounds - The total number of main-bracket rounds (columns)
 * @returns The zero-based column index in the consolation row
 */
export function getConsolationColumnIndex(placementStart: number, totalRounds: number): number {
  return totalRounds - 1 - Math.floor((placementStart - 3) / 2)
}
