import { describe, it, expect } from "vitest"
import { coinTossPickGenerator } from "./coin-toss"
import { pickGeneratorRegistry } from "../pick-generator"
import { SeededRng } from "../rng"

describe("coinTossPickGenerator", () => {
  it("has gameType 'coin-toss'", () => {
    expect(coinTossPickGenerator.gameType).toBe("coin-toss")
  })

  it("generates a pick with side HEADS or TAILS", () => {
    const rng = new SeededRng(42)
    const pick = coinTossPickGenerator.generatePick(rng)
    expect(pick).toHaveProperty("side")
    expect(["HEADS", "TAILS"]).toContain(pick.side)
  })

  it("produces both HEADS and TAILS over multiple calls", () => {
    const rng = new SeededRng(123)
    const sides = new Set<string>()
    for (let i = 0; i < 100; i++) {
      sides.add(coinTossPickGenerator.generatePick(rng).side)
    }
    expect(sides.has("HEADS")).toBe(true)
    expect(sides.has("TAILS")).toBe(true)
  })

  it("is registered in pickGeneratorRegistry on import", () => {
    const generator = pickGeneratorRegistry.lookup("coin-toss")
    expect(generator).toBe(coinTossPickGenerator)
  })
})
