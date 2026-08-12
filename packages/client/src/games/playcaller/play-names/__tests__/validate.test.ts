import { describe, it, expect } from "vitest"
import { validatePlayDefinition } from "../validate"

describe("validatePlayDefinition", () => {
  const validPlayArt = {
    markers: [{ position: { x: 50, y: 50 }, shape: "circle" as const }],
    routes: [],
    lineOfScrimmage: 50,
  }

  const validDef = {
    displayName: "Power Run",
    formation: "I-Formation",
    circumstances: ["standard", "short_yardage"],
    playArt: validPlayArt,
    weight: 2,
  }

  it("accepts a valid PlayDefinition with all fields", () => {
    const result = validatePlayDefinition(validDef)
    expect(result.displayName).toBe("Power Run")
    expect(result.formation).toBe("I-Formation")
    expect(result.circumstances).toEqual(["standard", "short_yardage"])
    expect(result.weight).toBe(2)
  })

  it("accepts a valid PlayDefinition without optional weight", () => {
    const { weight, ...noWeight } = validDef
    const result = validatePlayDefinition(noWeight)
    expect(result.displayName).toBe("Power Run")
    expect(result.weight).toBeUndefined()
  })

  it("throws if def is null", () => {
    expect(() => validatePlayDefinition(null)).toThrow(
      "PlayDefinition must be a non-null object"
    )
  })

  it("throws if def is not an object", () => {
    expect(() => validatePlayDefinition("string")).toThrow(
      "PlayDefinition must be a non-null object"
    )
  })

  it("throws if displayName is not a string", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, displayName: 123 })
    ).toThrow("PlayDefinition.displayName must be a string")
  })

  it("throws if displayName is empty", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, displayName: "" })
    ).toThrow("PlayDefinition.displayName must be 1–50 characters, got length 0")
  })

  it("throws if displayName exceeds 50 characters", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, displayName: "a".repeat(51) })
    ).toThrow("PlayDefinition.displayName must be 1–50 characters, got length 51")
  })

  it("throws if formation is not a string", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, formation: true })
    ).toThrow("PlayDefinition.formation must be a string")
  })

  it("throws if formation is empty", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, formation: "" })
    ).toThrow("PlayDefinition.formation must be 1–30 characters, got length 0")
  })

  it("throws if formation exceeds 30 characters", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, formation: "a".repeat(31) })
    ).toThrow("PlayDefinition.formation must be 1–30 characters, got length 31")
  })

  it("throws if circumstances is not an array", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, circumstances: "standard" })
    ).toThrow("PlayDefinition.circumstances must be an array")
  })

  it("throws if circumstances is empty", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, circumstances: [] })
    ).toThrow("PlayDefinition.circumstances must be a non-empty array")
  })

  it("throws if circumstances contains invalid value", () => {
    expect(() =>
      validatePlayDefinition({
        ...validDef,
        circumstances: ["standard", "invalid_value"],
      })
    ).toThrow(
      'PlayDefinition.circumstances contains invalid value: "invalid_value"'
    )
  })

  it("throws if weight is not a number", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, weight: "high" })
    ).toThrow("PlayDefinition.weight must be a number")
  })

  it("throws if weight is 0", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, weight: 0 })
    ).toThrow("PlayDefinition.weight must be greater than 0, got 0")
  })

  it("throws if weight is negative", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, weight: -1 })
    ).toThrow("PlayDefinition.weight must be greater than 0, got -1")
  })

  it("accepts displayName at boundary length 1", () => {
    const result = validatePlayDefinition({ ...validDef, displayName: "X" })
    expect(result.displayName).toBe("X")
  })

  it("accepts displayName at boundary length 50", () => {
    const name = "a".repeat(50)
    const result = validatePlayDefinition({ ...validDef, displayName: name })
    expect(result.displayName).toBe(name)
  })

  it("accepts formation at boundary length 30", () => {
    const formation = "b".repeat(30)
    const result = validatePlayDefinition({ ...validDef, formation })
    expect(result.formation).toBe(formation)
  })

  it("accepts all valid circumstance values", () => {
    const allCircumstances = [
      "standard",
      "short_yardage",
      "medium_yardage",
      "long_yardage",
      "desperation",
      "goal_line",
      "must_convert",
    ]
    const result = validatePlayDefinition({
      ...validDef,
      circumstances: allCircumstances,
    })
    expect(result.circumstances).toEqual(allCircumstances)
  })

  it("accepts fractional weight > 0", () => {
    const result = validatePlayDefinition({ ...validDef, weight: 0.5 })
    expect(result.weight).toBe(0.5)
  })

  it("throws if playArt is missing", () => {
    const { playArt, ...noArt } = validDef
    expect(() => validatePlayDefinition(noArt)).toThrow(
      "PlayDefinition.playArt must be a non-null object"
    )
  })

  it("throws if playArt is null", () => {
    expect(() =>
      validatePlayDefinition({ ...validDef, playArt: null })
    ).toThrow("PlayDefinition.playArt must be a non-null object, got null")
  })

  it("throws if playArt.markers is empty", () => {
    expect(() =>
      validatePlayDefinition({
        ...validDef,
        playArt: { markers: [], routes: [], lineOfScrimmage: 50 },
      })
    ).toThrow(
      "PlayDefinition.playArt.markers must be an array with at least 1 marker, got length 0"
    )
  })

  it("throws if playArt.lineOfScrimmage is below 0", () => {
    expect(() =>
      validatePlayDefinition({
        ...validDef,
        playArt: { ...validPlayArt, lineOfScrimmage: -1 },
      })
    ).toThrow(
      "PlayDefinition.playArt.lineOfScrimmage must be between 0 and 100, got -1"
    )
  })

  it("throws if playArt.lineOfScrimmage is above 100", () => {
    expect(() =>
      validatePlayDefinition({
        ...validDef,
        playArt: { ...validPlayArt, lineOfScrimmage: 101 },
      })
    ).toThrow(
      "PlayDefinition.playArt.lineOfScrimmage must be between 0 and 100, got 101"
    )
  })

  it("accepts playArt with lineOfScrimmage at boundary 0", () => {
    const result = validatePlayDefinition({
      ...validDef,
      playArt: { ...validPlayArt, lineOfScrimmage: 0 },
    })
    expect(result.playArt.lineOfScrimmage).toBe(0)
  })

  it("accepts playArt with lineOfScrimmage at boundary 100", () => {
    const result = validatePlayDefinition({
      ...validDef,
      playArt: { ...validPlayArt, lineOfScrimmage: 100 },
    })
    expect(result.playArt.lineOfScrimmage).toBe(100)
  })
})
