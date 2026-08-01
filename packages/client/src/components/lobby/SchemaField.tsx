import { useState } from "react"
import type { SettingsFieldSchema } from "@games-of-chance/shared"

interface SchemaFieldProps {
  field: SettingsFieldSchema
  value: number | boolean | string
  onChange: (key: string, value: number | boolean | string) => void
  disabled: boolean
}

/**
 * Generic field renderer:
 * - "number" → <input type="number"> with min/max/step
 * - "boolean" → toggle switch
 * - "select" → <select> dropdown
 *
 * Mobile-first: 44px minimum tap targets.
 * Client-side validation: clamps number values on blur.
 * Shows inline validation message when value is temporarily out of range.
 */
export default function SchemaField({ field, value, onChange, disabled }: SchemaFieldProps) {
  const [validationMsg, setValidationMsg] = useState<string | null>(null)

  if (field.type === "number") {
    return (
      <NumberField
        field={field}
        value={value as number}
        onChange={onChange}
        disabled={disabled}
        validationMsg={validationMsg}
        setValidationMsg={setValidationMsg}
      />
    )
  }

  if (field.type === "boolean") {
    return (
      <BooleanField
        field={field}
        value={value as boolean}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  if (field.type === "select") {
    return (
      <SelectField
        field={field}
        value={value as string}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  return null
}

// ── Number Field ───────────────────────────────────────────────────────────

function NumberField({
  field,
  value,
  onChange,
  disabled,
  validationMsg,
  setValidationMsg,
}: {
  field: SettingsFieldSchema
  value: number
  onChange: (key: string, value: number | boolean | string) => void
  disabled: boolean
  validationMsg: string | null
  setValidationMsg: (msg: string | null) => void
}) {
  const min = field.constraints?.min
  const max = field.constraints?.max
  const step = field.constraints?.step

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const num = parseFloat(raw)

    if (isNaN(num)) return

    // Show validation message if out of range, but allow typing
    if (min !== undefined && num < min) {
      setValidationMsg(`Minimum is ${min}`)
    } else if (max !== undefined && num > max) {
      setValidationMsg(`Maximum is ${max}`)
    } else {
      setValidationMsg(null)
    }

    onChange(field.key, num)
  }

  function handleBlur() {
    // Clamp to valid range on blur
    let clamped = value
    if (min !== undefined && clamped < min) clamped = min
    if (max !== undefined && clamped > max) clamped = max

    if (clamped !== value) {
      onChange(field.key, clamped)
    }
    setValidationMsg(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`field-${field.key}`}
        className="text-sm font-medium text-gray-700"
      >
        {field.label}
      </label>
      <input
        id={`field-${field.key}`}
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      />
      {validationMsg && (
        <p className="text-xs text-red-600" role="alert">
          {validationMsg}
        </p>
      )}
    </div>
  )
}

// ── Boolean Field (Toggle Switch) ──────────────────────────────────────────

function BooleanField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SettingsFieldSchema
  value: boolean
  onChange: (key: string, value: number | boolean | string) => void
  disabled: boolean
}) {
  function handleToggle() {
    if (disabled) return
    onChange(field.key, !value)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={`field-${field.key}`}
        className="text-sm font-medium text-gray-700"
      >
        {field.label}
      </label>
      <button
        id={`field-${field.key}`}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleToggle}
        disabled={disabled}
        className={`relative inline-flex h-[28px] min-w-[44px] items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? "bg-green-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-[20px]" : "translate-x-[4px]"
          }`}
        />
      </button>
    </div>
  )
}

// ── Select Field ───────────────────────────────────────────────────────────

function SelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SettingsFieldSchema
  value: string
  onChange: (key: string, value: number | boolean | string) => void
  disabled: boolean
}) {
  const options = field.constraints?.options ?? []

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(field.key, e.target.value)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`field-${field.key}`}
        className="text-sm font-medium text-gray-700"
      >
        {field.label}
      </label>
      <select
        id={`field-${field.key}`}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="min-h-[44px] w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
