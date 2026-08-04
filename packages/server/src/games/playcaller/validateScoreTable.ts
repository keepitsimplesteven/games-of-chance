import { PLAYCALLER } from "./constants"

/**
 * Validates a Score_Table array.
 *
 * A valid Score_Table:
 * - Contains between 2 and 10 entries (SCORE_TABLE_MIN_ENTRIES to SCORE_TABLE_MAX_ENTRIES)
 * - Each entry is a non-negative integer
 * - Entries are in non-increasing order (each entry >= next entry)
 *
 * @returns true if valid, false otherwise
 */
export function validateScoreTable(table: unknown): table is number[] {
  if (!Array.isArray(table)) return false
  if (table.length < PLAYCALLER.SCORE_TABLE_MIN_ENTRIES) return false
  if (table.length > PLAYCALLER.SCORE_TABLE_MAX_ENTRIES) return false

  for (let i = 0; i < table.length; i++) {
    const entry = table[i]
    // Must be a non-negative integer
    if (typeof entry !== "number") return false
    if (!Number.isInteger(entry)) return false
    if (entry < 0) return false

    // Must be non-increasing (current >= next)
    if (i > 0 && table[i - 1] < entry) return false
  }

  return true
}
