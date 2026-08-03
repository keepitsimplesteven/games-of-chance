/**
 * Feature: big-wheel, Property 4: Pick validation
 *
 * For any value, validatePick SHALL return true if and only if the value is
 * an object with a `type` field strictly equal to `"spin"`. All other values
 * SHALL be rejected.
 *
 * **Validates: Requirements 8.1, 8.3, 8.4**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { bigWheelPlugin } from "../BigWheelPlugin"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate arbitrary JSON values that are NOT { type: "spin" } */
const invalidPickArb = fc.oneof(
  // Primitives
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  // Arrays
  fc.array(fc.anything()),
  // Objects with no `type` field
  fc.record({ value: fc.anything() }),
  // Objects with `type` field set to non-"spin" string values
  fc.record(
    { type: fc.string().filter((s) => s !== "spin") },
    {}
  ),
  // Objects with `type` field set to non-string values
  fc.record({ type: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.array(fc.anything())) }),
  // Objects with extra properties (but wrong type)
  fc.record({ type: fc.constant("spinn"), extra: fc.anything() }),
  fc.record({ type: fc.constant("SPIN"), extra: fc.anything() })
)

/** Generate valid picks — always { type: "spin" }, possibly with extra props */
const validPickArb = fc.record(
  { type: fc.constant("spin" as const) },
  {}
).chain((base) =>
  fc.record({ extra: fc.anything() }).map((extras) => ({ ...extras, ...base }))
)

// ── Properties ─────────────────────────────────────────────────────────────

describe("Feature: big-wheel, Property 4: Pick validation", () => {
  /**
   * Property 4a: Valid picks are always accepted.
   * Any object with type === "spin" must pass validation.
   *
   * **Validates: Requirements 8.1**
   */
  it("accepts any object with type === 'spin'", () => {
    fc.assert(
      fc.property(validPickArb, (pick) => {
        expect(bigWheelPlugin.validatePick(pick)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4b: Invalid picks are always rejected.
   * Any value that is not an object with type === "spin" must be rejected.
   *
   * **Validates: Requirements 8.3, 8.4**
   */
  it("rejects any value that does not have type === 'spin'", () => {
    fc.assert(
      fc.property(invalidPickArb, (pick) => {
        expect(bigWheelPlugin.validatePick(pick)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})
