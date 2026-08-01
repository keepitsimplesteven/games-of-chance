/**
 * Feature: game-settings, Property 11: Schema-driven field type rendering
 * Feature: game-settings, Property 12: Client-side clamping to valid range
 *
 * **Validates: Requirements 6.1, 11.1, 11.3, 11.4**
 */
import { describe, it, expect, vi } from "vitest"
import * as fc from "fast-check"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import SchemaField from "../SchemaField"
import type { SettingsFieldSchema } from "@games-of-chance/shared"

// ── Arbitraries ────────────────────────────────────────────────────────────

/** Generate a unique key string for a schema field */
const fieldKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,15}$/)

/**
 * Generate a human-readable label that works with testing-library's getByLabelText.
 * Labels must be alphanumeric words (no leading/trailing spaces, no special-only strings).
 */
const fieldLabelArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,20}$/)
  .filter((s) => s.trim().length >= 3)
  .map((s) => s.trim())

/** Generate a number-type schema field with valid constraints */
const numberFieldArb: fc.Arbitrary<SettingsFieldSchema> = fc.record({
  key: fieldKeyArb,
  label: fieldLabelArb,
  type: fc.constant("number" as const),
  defaultValue: fc.integer({ min: 1, max: 100 }),
  constraints: fc.record({
    min: fc.integer({ min: 0, max: 50 }),
    max: fc.integer({ min: 51, max: 200 }),
    step: fc.constantFrom(1, 0.5, 5, 10),
  }),
}).map((rec) => ({
  key: rec.key,
  label: rec.label,
  type: rec.type,
  defaultValue: rec.defaultValue,
  constraints: rec.constraints,
}))

/** Generate a boolean-type schema field */
const booleanFieldArb: fc.Arbitrary<SettingsFieldSchema> = fc.record({
  key: fieldKeyArb,
  label: fieldLabelArb,
  type: fc.constant("boolean" as const),
  defaultValue: fc.boolean(),
})

/** Generate a select-type schema field with 2-5 options */
const selectFieldArb: fc.Arbitrary<SettingsFieldSchema> = fc
  .record({
    key: fieldKeyArb,
    label: fieldLabelArb,
    type: fc.constant("select" as const),
    options: fc.array(
      fc.record({
        label: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,12}$/).map((s) => s.trim()),
        value: fc.stringMatching(/^[a-z][a-z0-9\-]{1,8}$/),
      }),
      { minLength: 2, maxLength: 5 }
    ),
  })
  .map((rec) => ({
    key: rec.key,
    label: rec.label,
    type: rec.type,
    defaultValue: rec.options[0].value,
    constraints: { options: rec.options },
  }))

/** Generate any field type */
const anyFieldArb: fc.Arbitrary<SettingsFieldSchema> = fc.oneof(
  numberFieldArb,
  booleanFieldArb,
  selectFieldArb
)

/** Generate a schema with 1-10 fields, each with a unique key and label */
const schemaArb: fc.Arbitrary<SettingsFieldSchema[]> = fc
  .array(anyFieldArb, { minLength: 1, maxLength: 10 })
  .map((fields) => {
    // Deduplicate by key and ensure unique labels for accessibility queries
    const seen = new Set<string>()
    const seenLabels = new Set<string>()
    const unique: SettingsFieldSchema[] = []
    for (const field of fields) {
      const normalizedLabel = field.label.toLowerCase()
      if (!seen.has(field.key) && !seenLabels.has(normalizedLabel)) {
        seen.add(field.key)
        seenLabels.add(normalizedLabel)
        unique.push(field)
      }
    }
    return unique
  })
  .filter((fields) => fields.length >= 1)

// ── Property 11: Schema-driven field type rendering ────────────────────────

describe("Feature: game-settings, Property 11: Schema-driven field type rendering", () => {
  /**
   * Property 11: Schema-driven field type rendering
   *
   * For any SettingsSchema containing N fields with types from {"number", "boolean", "select"},
   * the SchemaField component renders exactly one appropriate control per field:
   * - number → input[type=number]
   * - boolean → switch role
   * - select → select element
   *
   * **Validates: Requirements 6.1, 11.1**
   */
  it("for any schema with N fields of mixed types, renders exactly N controls with correct types", () => {
    fc.assert(
      fc.property(schemaArb, (schema) => {
        cleanup()

        const onChange = vi.fn()
        const N = schema.length

        // Render all schema fields
        const { container } = render(
          <>
            {schema.map((field) => {
              const value = field.defaultValue
              return (
                <SchemaField
                  key={field.key}
                  field={field}
                  value={value}
                  onChange={onChange}
                  disabled={false}
                />
              )
            })}
          </>
        )

        // Count controls by type using DOM queries
        const numberInputs = container.querySelectorAll('input[type="number"]')
        const switches = screen.queryAllByRole("switch")
        const selects = container.querySelectorAll("select")

        const totalRendered = numberInputs.length + switches.length + selects.length
        expect(totalRendered).toBe(N)

        // Verify counts match expected counts from schema
        const expectedNumberCount = schema.filter((f) => f.type === "number").length
        const expectedBooleanCount = schema.filter((f) => f.type === "boolean").length
        const expectedSelectCount = schema.filter((f) => f.type === "select").length

        expect(numberInputs.length).toBe(expectedNumberCount)
        expect(switches.length).toBe(expectedBooleanCount)
        expect(selects.length).toBe(expectedSelectCount)

        // Verify each field's ID is rendered correctly
        for (const field of schema) {
          const element = container.querySelector(`#field-${field.key}`)
          expect(element).not.toBeNull()

          if (field.type === "number") {
            expect((element as HTMLInputElement).type).toBe("number")
          } else if (field.type === "boolean") {
            expect(element?.getAttribute("role")).toBe("switch")
          } else if (field.type === "select") {
            expect(element?.tagName.toLowerCase()).toBe("select")
          }
        }

        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it("number fields have correct min/max/step attributes from schema constraints", () => {
    fc.assert(
      fc.property(numberFieldArb, (field) => {
        cleanup()

        const onChange = vi.fn()
        const { container } = render(
          <SchemaField
            field={field}
            value={field.defaultValue as number}
            onChange={onChange}
            disabled={false}
          />
        )

        const input = container.querySelector(`#field-${field.key}`) as HTMLInputElement
        expect(input).not.toBeNull()
        expect(input.type).toBe("number")
        expect(input.min).toBe(String(field.constraints!.min))
        expect(input.max).toBe(String(field.constraints!.max))
        expect(input.step).toBe(String(field.constraints!.step))

        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it("select fields render the correct number of options from constraints", () => {
    fc.assert(
      fc.property(selectFieldArb, (field) => {
        cleanup()

        const onChange = vi.fn()
        const { container } = render(
          <SchemaField
            field={field}
            value={field.defaultValue}
            onChange={onChange}
            disabled={false}
          />
        )

        const select = container.querySelector(`#field-${field.key}`) as HTMLSelectElement
        expect(select).not.toBeNull()
        const options = select.querySelectorAll("option")
        expect(options.length).toBe(field.constraints!.options!.length)

        // Verify each option has correct value/label
        field.constraints!.options!.forEach((opt, idx) => {
          expect(options[idx].value).toBe(opt.value)
          expect(options[idx].textContent).toBe(opt.label)
        })

        cleanup()
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 12: Client-side clamping to valid range ───────────────────────

describe("Feature: game-settings, Property 12: Client-side clamping to valid range", () => {
  /** Generate a number field with a strict min < max constraint */
  const constrainedNumberFieldArb: fc.Arbitrary<SettingsFieldSchema> = fc
    .record({
      key: fieldKeyArb,
      label: fieldLabelArb,
      min: fc.integer({ min: 0, max: 50 }),
      max: fc.integer({ min: 51, max: 200 }),
      step: fc.constantFrom(1, 0.5, 5, 10),
    })
    .map((rec) => ({
      key: rec.key,
      label: rec.label,
      type: "number" as const,
      defaultValue: rec.min,
      constraints: { min: rec.min, max: rec.max, step: rec.step },
    }))

  /** Generate a value below the min */
  const valueBelowMinArb = (min: number) =>
    fc.integer({ min: min - 500, max: min - 1 })

  /** Generate a value above the max */
  const valueAboveMaxArb = (max: number) =>
    fc.integer({ min: max + 1, max: max + 500 })

  /**
   * Property 12: Client-side clamping to valid range
   *
   * For any numeric schema field with constraints {min, max} and for any value
   * below min, the SchemaField clamps to min on blur.
   *
   * **Validates: Requirements 11.3, 11.4**
   */
  it("clamps to min when value is below the field minimum on blur", () => {
    fc.assert(
      fc.property(
        constrainedNumberFieldArb.chain((field) =>
          valueBelowMinArb(field.constraints!.min!).map((belowValue) => ({
            field,
            belowValue,
          }))
        ),
        ({ field, belowValue }) => {
          cleanup()

          const onChange = vi.fn()
          const { container } = render(
            <SchemaField
              field={field}
              value={belowValue}
              onChange={onChange}
              disabled={false}
            />
          )

          const input = container.querySelector(`#field-${field.key}`) as HTMLInputElement
          expect(input).not.toBeNull()
          fireEvent.blur(input)

          // onChange should be called with the min value (clamped)
          expect(onChange).toHaveBeenCalledWith(field.key, field.constraints!.min)

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Client-side clamping to valid range
   *
   * For any numeric schema field with constraints {min, max} and for any value
   * above max, the SchemaField clamps to max on blur.
   *
   * **Validates: Requirements 11.3, 11.4**
   */
  it("clamps to max when value is above the field maximum on blur", () => {
    fc.assert(
      fc.property(
        constrainedNumberFieldArb.chain((field) =>
          valueAboveMaxArb(field.constraints!.max!).map((aboveValue) => ({
            field,
            aboveValue,
          }))
        ),
        ({ field, aboveValue }) => {
          cleanup()

          const onChange = vi.fn()
          const { container } = render(
            <SchemaField
              field={field}
              value={aboveValue}
              onChange={onChange}
              disabled={false}
            />
          )

          const input = container.querySelector(`#field-${field.key}`) as HTMLInputElement
          expect(input).not.toBeNull()
          fireEvent.blur(input)

          // onChange should be called with the max value (clamped)
          expect(onChange).toHaveBeenCalledWith(field.key, field.constraints!.max)

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12 (complement): Values within range are NOT clamped on blur.
   *
   * For any numeric schema field with constraints {min, max} and for any value
   * within [min, max], the SchemaField does NOT call onChange on blur (no clamping needed).
   *
   * **Validates: Requirements 11.3, 11.4**
   */
  it("does not clamp (no onChange call) when value is within valid range on blur", () => {
    fc.assert(
      fc.property(
        constrainedNumberFieldArb.chain((field) =>
          fc
            .integer({ min: field.constraints!.min!, max: field.constraints!.max! })
            .map((inRangeValue) => ({ field, inRangeValue }))
        ),
        ({ field, inRangeValue }) => {
          cleanup()

          const onChange = vi.fn()
          const { container } = render(
            <SchemaField
              field={field}
              value={inRangeValue}
              onChange={onChange}
              disabled={false}
            />
          )

          const input = container.querySelector(`#field-${field.key}`) as HTMLInputElement
          expect(input).not.toBeNull()
          fireEvent.blur(input)

          // onChange should NOT be called — value is already valid
          expect(onChange).not.toHaveBeenCalled()

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })
})
