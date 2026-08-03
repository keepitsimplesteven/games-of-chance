/**
 * Feature: big-wheel, Property 3: Reel strip validation
 *
 * For any candidate reel strip array, the validator SHALL accept it if and only
 * if it has between 2 and 100 elements (inclusive) and every element is a
 * positive integer in [1, 10000]. If rejected, the previously valid reel strip
 * SHALL remain unchanged.
 *
 * **Validates: Requirements 2.3, 2.4, 2.5**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { validateReelStrip } from "../validation"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a valid reel strip: length 2-100, values are integers in [1, 10000] */
const validReelStripArb = fc
  .integer({ min: 2, max: 100 })
  .chain((length) =>
    fc.array(fc.integer({ min: 1, max: 10_000 }), {
      minLength: length,
      maxLength: length,
    })
  )

/** Generate strips with invalid length: 0, 1, or >100 elements (with valid values) */
const invalidLengthStripArb = fc.oneof(
  // Empty array
  fc.constant([] as number[]),
  // Length 1
  fc.array(fc.integer({ min: 1, max: 10_000 }), {
    minLength: 1,
    maxLength: 1,
  }),
  // Length > 100 (101-200)
  fc
    .integer({ min: 101, max: 200 })
    .chain((length) =>
      fc.array(fc.integer({ min: 1, max: 10_000 }), {
        minLength: length,
        maxLength: length,
      })
    )
)

/** Generate strips with valid length (2-100) but containing at least one invalid value */
const invalidValueStripArb = fc
  .integer({ min: 2, max: 100 })
  .chain((length) => {
    // Generate an array of valid values, then inject at least one invalid value
    const invalidValueArb = fc.oneof(
      fc.integer({ min: -1000, max: 0 }), // negatives and zero
      fc.double({ min: 0.1, max: 9999.9, noInteger: true }), // floats
      fc.integer({ min: 10_001, max: 100_000 }) // > 10000
    )

    return fc
      .tuple(
        // Position to inject invalid value
        fc.integer({ min: 0, max: length - 1 }),
        // The invalid value to inject
        invalidValueArb,
        // The rest are valid values
        fc.array(fc.integer({ min: 1, max: 10_000 }), {
          minLength: length,
          maxLength: length,
        })
      )
      .map(([pos, invalidVal, arr]) => {
        const result = [...arr]
        result[pos] = invalidVal
        return result
      })
  })

/** Generate arbitrary arrays (varying lengths 0-200, values including negatives/floats/out-of-range) */
const arbitraryStripArb = fc.array(
  fc.oneof(
    fc.integer({ min: -1000, max: 20_000 }),
    fc.double({ min: -100, max: 20_000 }),
    fc.integer({ min: 1, max: 10_000 })
  ),
  { minLength: 0, maxLength: 200 }
)

// ── Helper ─────────────────────────────────────────────────────────────────

/** Reference implementation: check if a strip should be valid */
function isValidStrip(strip: number[]): boolean {
  if (strip.length < 2 || strip.length > 100) return false
  return strip.every(
    (v) => Number.isInteger(v) && v >= 1 && v <= 10_000
  )
}

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 3: Reel strip validation", () => {
  /**
   * Property 3a: Valid reel strips are always accepted.
   * Any strip with length in [2, 100] and all integer values in [1, 10000]
   * must return { valid: true }.
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  it("accepts any strip with length 2-100 and all integer values in [1, 10000]", () => {
    fc.assert(
      fc.property(validReelStripArb, (strip) => {
        const result = validateReelStrip(strip)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3b: Strips with invalid length are rejected.
   * Any strip with length 0, 1, or > 100 must return { valid: false }.
   *
   * **Validates: Requirements 2.3**
   */
  it("rejects any strip with invalid length (0, 1, or >100)", () => {
    fc.assert(
      fc.property(invalidLengthStripArb, (strip) => {
        const result = validateReelStrip(strip)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3c: Strips with invalid values are rejected.
   * Any strip with correct length but containing negatives, floats, 0, or >10000
   * must return { valid: false }.
   *
   * **Validates: Requirements 2.4, 2.5**
   */
  it("rejects any strip with invalid values (negatives, floats, 0, or >10000)", () => {
    fc.assert(
      fc.property(invalidValueStripArb, (strip) => {
        const result = validateReelStrip(strip)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3d: Validator accepts iff length in [2,100] and all values are integers in [1,10000].
   * For arbitrary arrays, the validator should agree with the reference implementation.
   *
   * **Validates: Requirements 2.3, 2.4, 2.5**
   */
  it("accepts iff length in [2,100] and all values are integers in [1, 10000]", () => {
    fc.assert(
      fc.property(arbitraryStripArb, (strip) => {
        const result = validateReelStrip(strip)
        const shouldBeValid = isValidStrip(strip)
        expect(result.valid).toBe(shouldBeValid)
        if (!shouldBeValid) {
          expect(result.error).toBeDefined()
        }
      }),
      { numRuns: 100 }
    )
  })
})
