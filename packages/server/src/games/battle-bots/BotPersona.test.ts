import { describe, it, expect } from "vitest"
import { ensureEvenParticipants, botPersonaSelectRobot } from "./BotPersona"
import type { RobotTemplate } from "./types"

describe("ensureEvenParticipants", () => {
  it("returns empty array when player count is even and >= 2", () => {
    const result = ensureEvenParticipants(["p1", "p2"])
    expect(result).toEqual([])
  })

  it("returns empty array for 4 players", () => {
    const result = ensureEvenParticipants(["p1", "p2", "p3", "p4"])
    expect(result).toEqual([])
  })

  it("creates a bot persona when player count is 1", () => {
    const result = ensureEvenParticipants(["p1"])
    expect(result).toHaveLength(1)
    expect(result[0].id).toMatch(/^bot_[a-f0-9]{8}$/)
    expect(result[0].name).toMatch(/^MechBot-\d{1,2}$/)
    expect(result[0].isBot).toBe(true)
  })

  it("creates a bot persona when player count is odd (3)", () => {
    const result = ensureEvenParticipants(["p1", "p2", "p3"])
    expect(result).toHaveLength(1)
    expect(result[0].id).toMatch(/^bot_[a-f0-9]{8}$/)
    expect(result[0].name).toMatch(/^MechBot-\d{1,2}$/)
    expect(result[0].isBot).toBe(true)
  })

  it("creates a bot persona when player count is odd (5)", () => {
    const result = ensureEvenParticipants(["p1", "p2", "p3", "p4", "p5"])
    expect(result).toHaveLength(1)
    expect(result[0].isBot).toBe(true)
  })

  it("generates bot name number between 1 and 99", () => {
    // Run multiple times to check range
    for (let i = 0; i < 50; i++) {
      const result = ensureEvenParticipants(["p1"])
      const num = parseInt(result[0].name.replace("MechBot-", ""), 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(99)
    }
  })

  it("generates unique IDs across calls", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const result = ensureEvenParticipants(["p1"])
      ids.add(result[0].id)
    }
    // With 8 hex chars, collisions in 20 calls are virtually impossible
    expect(ids.size).toBe(20)
  })
})


describe("botPersonaSelectRobot", () => {
  const mockVisual = { headType: "square" as const, bodyType: "square" as const, weaponType: "drill" as const, color: "#cc3333" }
  const mockOptions: RobotTemplate[] = [
    { id: "bot-alpha", name: "Iron Crusher", hp: 100, accuracy: 80, damageMin: 1, damageMax: 10, visualId: "robot-1", visual: mockVisual },
    { id: "bot-beta", name: "Steel Viper", hp: 100, accuracy: 80, damageMin: 1, damageMax: 10, visualId: "robot-2", visual: { ...mockVisual, weaponType: "blaster" as const } },
    { id: "bot-gamma", name: "Chrome Fang", hp: 100, accuracy: 80, damageMin: 1, damageMax: 10, visualId: "robot-3", visual: { ...mockVisual, weaponType: "bazooka" as const } },
  ]

  it("returns an id from the provided options", () => {
    const validIds = mockOptions.map(o => o.id)
    const result = botPersonaSelectRobot(mockOptions)
    expect(validIds).toContain(result)
  })

  it("always returns a valid option id across multiple calls", () => {
    const validIds = new Set(mockOptions.map(o => o.id))
    for (let i = 0; i < 100; i++) {
      const result = botPersonaSelectRobot(mockOptions)
      expect(validIds.has(result)).toBe(true)
    }
  })

  it("selects from all available options (not always the same)", () => {
    const selected = new Set<string>()
    for (let i = 0; i < 100; i++) {
      selected.add(botPersonaSelectRobot(mockOptions))
    }
    // With 100 iterations and 3 options, it's statistically near-impossible to miss one
    expect(selected.size).toBeGreaterThan(1)
  })

  it("works with a single option", () => {
    const singleOption: RobotTemplate[] = [
      { id: "bot-alpha", name: "Iron Crusher", hp: 100, accuracy: 80, damageMin: 1, damageMax: 10, visualId: "robot-1", visual: mockVisual },
    ]
    const result = botPersonaSelectRobot(singleOption)
    expect(result).toBe("bot-alpha")
  })
})
