/**
 * Feature: playcaller-tournament, Property 11: Score table validation
 *
 * Validates: Requirements 6.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { validateScoreTable } from "../games/playcaller/validateScoreTable"

describe("Property 11: Score table validation", () => {
  it("accepts arrays of length 2-10 with non-negative integers in non-increasing order", () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 2, max: 10 })
          .chain((len) =>
            fc.array(fc.integer({ min: 0, max: 1000 }), {
              minLength: len,
              maxLength: len,
            })
          )
          .map((arr) => arr.sort((a, b) => b - a)),
        (table) => {
          expect(validateScoreTable(table)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects arrays with fewer than 2 entries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }).chain((len) =>
          fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: len,
            maxLength: len,
          })
        ),
        (table) => {
          expect(validateScoreTable(table)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects arrays with more than 10 entries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 20 }).chain((len) =>
          fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: len,
            maxLength: len,
          })
        ),
        (table) => {
          expect(validateScoreTable(table)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects arrays containing negative numbers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain((len) => {
          // Generate an array of valid non-negative integers
          const validEntries = fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: len - 1,
            maxLength: len - 1,
          })
          // Generate one negative integer
          const negativeEntry = fc.integer({ min: -1000, max: -1 })
          // Insert the negative value at a random position
          return fc
            .tuple(validEntries, negativeEntry, fc.integer({ min: 0, max: len - 1 }))
            .map(([arr, neg, pos]) => {
              const result = [...arr]
              result.splice(pos, 0, neg)
              return result
            })
        }),
        (table) => {
          expect(validateScoreTable(table)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects arrays containing non-integer values (floats)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain((len) => {
          // Generate an array of valid integers
          const validEntries = fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: len - 1,
            maxLength: len - 1,
          })
          // Generate a non-integer float (filter out integers)
          const floatEntry = fc
            .double({ min: 0.01, max: 1000, noNaN: true })
            .filter((n) => !Number.isInteger(n))
          // Insert the float at a random position
          return fc
            .tuple(validEntries, floatEntry, fc.integer({ min: 0, max: len - 1 }))
            .map(([arr, float, pos]) => {
              const result = [...arr]
              result.splice(pos, 0, float)
              return result
            })
        }),
        (table) => {
          expect(validateScoreTable(table)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects arrays in increasing order (not non-increasing)", () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 2, max: 10 })
          .chain((len) =>
            fc.array(fc.integer({ min: 0, max: 1000 }), {
              minLength: len,
              maxLength: len,
            })
          )
          // Sort ascending and filter out arrays that happen to be non-increasing
          .map((arr) => arr.sort((a, b) => a - b))
          .filter((arr) => {
            // Ensure it's strictly increasing somewhere (not all equal / not already non-increasing)
            for (let i = 0; i < arr.length - 1; i++) {
              if (arr[i] > arr[i + 1]) return false // already non-increasing somewhere, skip
            }
            // Must have at least one strict increase (not flat)
            for (let i = 0; i < arr.length - 1; i++) {
              if (arr[i] < arr[i + 1]) return true
            }
            return false // all equal → would be valid non-increasing
          }),
        (table) => {
          expect(validateScoreTable(table)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects non-array values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.double({ noNaN: true }),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.object()
        ),
        (value) => {
          expect(validateScoreTable(value)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
