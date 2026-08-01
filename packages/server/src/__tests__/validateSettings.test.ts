import { describe, it, expect } from "vitest"
import { validateSettingsUpdate } from "../settings/validateSettings"
import type { GameSettings, SettingsSchema } from "@games-of-chance/shared"

const baseSettings: GameSettings = {
  roundCount: 10,
  pickWindowMs: 15000,
  tuning: {
    CORRECT_GUESS_CHIPS: 5,
    STREAK_MULTIPLIER: 2,
  },
}

const schema: SettingsSchema = [
  {
    key: "CORRECT_GUESS_CHIPS",
    label: "Points per correct guess",
    type: "number",
    defaultValue: 5,
    constraints: { min: 1, max: 100, step: 1 },
  },
  {
    key: "STREAK_MULTIPLIER",
    label: "Streak multiplier",
    type: "number",
    defaultValue: 2,
    constraints: { min: 1, max: 10, step: 0.5 },
  },
  {
    key: "ENABLE_BONUS",
    label: "Enable bonus",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "DIFFICULTY",
    label: "Difficulty",
    type: "select",
    defaultValue: "normal",
    constraints: {
      options: [
        { label: "Easy", value: "easy" },
        { label: "Normal", value: "normal" },
        { label: "Hard", value: "hard" },
      ],
    },
  },
]

describe("validateSettingsUpdate", () => {
  describe("roundCount validation", () => {
    it.each([1, 25, 50])("accepts valid roundCount %i", (value) => {
      const result = validateSettingsUpdate({ roundCount: value }, baseSettings, schema)
      expect(result).toEqual({ valid: true, sanitized: { roundCount: value } })
    })

    it.each([0, -1, 51, 5.5])("rejects out-of-range roundCount %d", (value) => {
      const result = validateSettingsUpdate({ roundCount: value }, baseSettings, schema)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toContain("roundCount")
    })
  })

  describe("pickWindowMs validation", () => {
    it.each([3000, 30000, 60000])("accepts valid pickWindowMs %i", (value) => {
      const result = validateSettingsUpdate({ pickWindowMs: value }, baseSettings, schema)
      expect(result).toEqual({ valid: true, sanitized: { pickWindowMs: value } })
    })

    it.each([2999, 60001, 5000.5])("rejects out-of-range pickWindowMs %d", (value) => {
      const result = validateSettingsUpdate({ pickWindowMs: value }, baseSettings, schema)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toContain("pickWindowMs")
    })
  })

  describe("tuning key validation", () => {
    it("accepts valid number tuning key within constraints", () => {
      const result = validateSettingsUpdate(
        { tuning: { CORRECT_GUESS_CHIPS: 50 } },
        baseSettings,
        schema
      )
      expect(result).toEqual({ valid: true, sanitized: { tuning: { CORRECT_GUESS_CHIPS: 50 } } })
    })

    it("rejects number tuning key below min", () => {
      const result = validateSettingsUpdate(
        { tuning: { CORRECT_GUESS_CHIPS: 0 } },
        baseSettings,
        schema
      )
      expect(result.valid).toBe(false)
    })

    it("rejects number tuning key above max", () => {
      const result = validateSettingsUpdate(
        { tuning: { CORRECT_GUESS_CHIPS: 101 } },
        baseSettings,
        schema
      )
      expect(result.valid).toBe(false)
    })

    it("validates step constraint for number fields", () => {
      // STREAK_MULTIPLIER has step 0.5, so 1.5 is valid, 1.3 is not
      const validResult = validateSettingsUpdate(
        { tuning: { STREAK_MULTIPLIER: 1.5 } },
        baseSettings,
        schema
      )
      expect(validResult.valid).toBe(true)

      const invalidResult = validateSettingsUpdate(
        { tuning: { STREAK_MULTIPLIER: 1.3 } },
        baseSettings,
        schema
      )
      expect(invalidResult.valid).toBe(false)
    })

    it("accepts valid boolean tuning key", () => {
      const result = validateSettingsUpdate(
        { tuning: { ENABLE_BONUS: true } },
        baseSettings,
        schema
      )
      expect(result).toEqual({ valid: true, sanitized: { tuning: { ENABLE_BONUS: true } } })
    })

    it("rejects non-boolean value for boolean field", () => {
      const result = validateSettingsUpdate(
        { tuning: { ENABLE_BONUS: "yes" as unknown as boolean } },
        baseSettings,
        schema
      )
      expect(result.valid).toBe(false)
    })

    it("accepts valid select tuning key", () => {
      const result = validateSettingsUpdate(
        { tuning: { DIFFICULTY: "hard" } },
        baseSettings,
        schema
      )
      expect(result).toEqual({ valid: true, sanitized: { tuning: { DIFFICULTY: "hard" } } })
    })

    it("rejects invalid select option", () => {
      const result = validateSettingsUpdate(
        { tuning: { DIFFICULTY: "impossible" } },
        baseSettings,
        schema
      )
      expect(result.valid).toBe(false)
    })

    it("silently ignores unknown tuning keys", () => {
      const result = validateSettingsUpdate(
        { tuning: { UNKNOWN_KEY: 42 } },
        baseSettings,
        schema
      )
      // Valid but unknown keys are stripped from sanitized output
      expect(result).toEqual({ valid: true, sanitized: {} })
    })

    it("ignores all tuning keys when schema is undefined", () => {
      const result = validateSettingsUpdate(
        { tuning: { CORRECT_GUESS_CHIPS: 999 } },
        baseSettings,
        undefined
      )
      expect(result).toEqual({ valid: true, sanitized: {} })
    })
  })

  describe("combined changes", () => {
    it("validates multiple valid fields together", () => {
      const result = validateSettingsUpdate(
        { roundCount: 20, pickWindowMs: 10000, tuning: { CORRECT_GUESS_CHIPS: 10 } },
        baseSettings,
        schema
      )
      expect(result).toEqual({
        valid: true,
        sanitized: { roundCount: 20, pickWindowMs: 10000, tuning: { CORRECT_GUESS_CHIPS: 10 } },
      })
    })

    it("rejects if any field is invalid", () => {
      const result = validateSettingsUpdate(
        { roundCount: 100, pickWindowMs: 10000 },
        baseSettings,
        schema
      )
      expect(result.valid).toBe(false)
    })

    it("returns empty sanitized for empty changes", () => {
      const result = validateSettingsUpdate({}, baseSettings, schema)
      expect(result).toEqual({ valid: true, sanitized: {} })
    })
  })
})
