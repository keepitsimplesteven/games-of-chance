import type { GameSettings, SettingsSchema, SettingsFieldSchema } from "@games-of-chance/shared"

type ValidationResult =
  | { valid: true; sanitized: Partial<GameSettings> }
  | { valid: false; error: string }

/**
 * Validates a partial settings update against the active plugin's schema.
 * Returns { valid: true, sanitized } or { valid: false, error }.
 */
export function validateSettingsUpdate(
  changes: Partial<GameSettings>,
  _currentSettings: GameSettings,
  schema: SettingsSchema | undefined
): ValidationResult {
  const sanitized: Partial<GameSettings> = {}

  // Validate roundCount
  if (changes.roundCount !== undefined) {
    const rc = changes.roundCount
    if (!Number.isInteger(rc) || rc < 1 || rc > 50) {
      return { valid: false, error: "roundCount must be an integer between 1 and 50" }
    }
    sanitized.roundCount = rc
  }

  // Validate pickWindowMs
  if (changes.pickWindowMs !== undefined) {
    const pw = changes.pickWindowMs
    if (!Number.isInteger(pw) || pw < 3000 || pw > 60000) {
      return { valid: false, error: "pickWindowMs must be an integer between 3000 and 60000" }
    }
    sanitized.pickWindowMs = pw
  }

  // Validate tuning keys against the plugin's settingsSchema
  if (changes.tuning !== undefined) {
    const sanitizedTuning: Record<string, number | boolean | string | number[]> = {}

    // If no schema, ignore all tuning keys
    if (schema !== undefined) {
      const schemaMap = new Map<string, SettingsFieldSchema>()
      for (const field of schema) {
        schemaMap.set(field.key, field)
      }

      for (const [key, value] of Object.entries(changes.tuning)) {
        const field = schemaMap.get(key)

        // Unknown tuning keys are silently ignored
        if (!field) continue

        const result = validateTuningField(field, value)
        if (!result.valid) {
          return { valid: false, error: result.error }
        }
        sanitizedTuning[key] = value
      }
    }

    // Only include tuning in sanitized output if there are valid keys
    if (Object.keys(sanitizedTuning).length > 0) {
      sanitized.tuning = sanitizedTuning
    }
  }

  return { valid: true, sanitized }
}

function validateTuningField(
  field: SettingsFieldSchema,
  value: unknown
): { valid: true } | { valid: false; error: string } {
  switch (field.type) {
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { valid: false, error: `${field.key} must be a finite number` }
      }
      const { min, max, step } = field.constraints ?? {}
      if (min !== undefined && value < min) {
        return { valid: false, error: `${field.key} must be at least ${min}` }
      }
      if (max !== undefined && value > max) {
        return { valid: false, error: `${field.key} must be at most ${max}` }
      }
      if (step !== undefined && step > 0) {
        // Check that the value aligns to the step relative to min (or 0)
        const base = min ?? 0
        const remainder = Math.abs((value - base) % step)
        // Use a small epsilon for floating point comparison
        if (remainder > 1e-9 && Math.abs(remainder - step) > 1e-9) {
          return { valid: false, error: `${field.key} must be a multiple of ${step}` }
        }
      }
      return { valid: true }
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        return { valid: false, error: `${field.key} must be a boolean` }
      }
      return { valid: true }
    }
    case "select": {
      if (typeof value !== "string") {
        return { valid: false, error: `${field.key} must be a string` }
      }
      const options = field.constraints?.options
      if (options && options.length > 0) {
        const validValues = options.map((o) => o.value)
        if (!validValues.includes(value)) {
          return {
            valid: false,
            error: `${field.key} must be one of: ${validValues.join(", ")}`,
          }
        }
      }
      return { valid: true }
    }
    default:
      return { valid: true }
  }
}
