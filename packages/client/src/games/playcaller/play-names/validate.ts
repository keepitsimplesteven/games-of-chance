import type { Circumstance, PlayDefinition } from "./types"

/** All valid Circumstance values */
const VALID_CIRCUMSTANCES: readonly Circumstance[] = [
  "standard",
  "short_yardage",
  "medium_yardage",
  "long_yardage",
  "desperation",
  "goal_line",
  "must_convert",
]

/**
 * Validates an unknown value as a PlayDefinition.
 * Throws a descriptive error naming the invalid field/value on failure.
 */
export function validatePlayDefinition(def: unknown): PlayDefinition {
  if (def === null || typeof def !== "object") {
    throw new Error("PlayDefinition must be a non-null object")
  }

  const obj = def as Record<string, unknown>

  // Validate displayName
  if (typeof obj.displayName !== "string") {
    throw new Error(
      `PlayDefinition.displayName must be a string, got ${typeof obj.displayName}`
    )
  }
  if (obj.displayName.length < 1 || obj.displayName.length > 50) {
    throw new Error(
      `PlayDefinition.displayName must be 1–50 characters, got length ${obj.displayName.length}`
    )
  }

  // Validate formation
  if (typeof obj.formation !== "string") {
    throw new Error(
      `PlayDefinition.formation must be a string, got ${typeof obj.formation}`
    )
  }
  if (obj.formation.length < 1 || obj.formation.length > 30) {
    throw new Error(
      `PlayDefinition.formation must be 1–30 characters, got length ${obj.formation.length}`
    )
  }

  // Validate circumstances
  if (!Array.isArray(obj.circumstances)) {
    throw new Error(
      `PlayDefinition.circumstances must be an array, got ${typeof obj.circumstances}`
    )
  }
  if (obj.circumstances.length === 0) {
    throw new Error("PlayDefinition.circumstances must be a non-empty array")
  }
  for (const value of obj.circumstances) {
    if (!VALID_CIRCUMSTANCES.includes(value as Circumstance)) {
      throw new Error(
        `PlayDefinition.circumstances contains invalid value: "${value}"`
      )
    }
  }

  // Validate playArt (required)
  if (obj.playArt === null || obj.playArt === undefined || typeof obj.playArt !== "object") {
    throw new Error(
      `PlayDefinition.playArt must be a non-null object, got ${obj.playArt === null ? "null" : typeof obj.playArt}`
    )
  }
  const playArt = obj.playArt as Record<string, unknown>
  if (!Array.isArray(playArt.markers) || playArt.markers.length < 1) {
    throw new Error(
      `PlayDefinition.playArt.markers must be an array with at least 1 marker, got ${Array.isArray(playArt.markers) ? `length ${playArt.markers.length}` : typeof playArt.markers}`
    )
  }
  if (typeof playArt.lineOfScrimmage !== "number") {
    throw new Error(
      `PlayDefinition.playArt.lineOfScrimmage must be a number, got ${typeof playArt.lineOfScrimmage}`
    )
  }
  if (playArt.lineOfScrimmage < 0 || playArt.lineOfScrimmage > 100) {
    throw new Error(
      `PlayDefinition.playArt.lineOfScrimmage must be between 0 and 100, got ${playArt.lineOfScrimmage}`
    )
  }

  // Validate weight (optional)
  if (obj.weight !== undefined) {
    if (typeof obj.weight !== "number") {
      throw new Error(
        `PlayDefinition.weight must be a number, got ${typeof obj.weight}`
      )
    }
    if (obj.weight <= 0) {
      throw new Error(
        `PlayDefinition.weight must be greater than 0, got ${obj.weight}`
      )
    }
  }

  return obj as unknown as PlayDefinition
}
