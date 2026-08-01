import { describe, it, expect } from "vitest"
import { PickGeneratorRegistry } from "./pick-generator"
import { MissingPickGeneratorError } from "./errors"
import type { PickGenerator } from "./pick-generator"
import type { Rng } from "./rng"

describe("PickGeneratorRegistry", () => {
  it("registers and looks up a generator by game type", () => {
    const registry = new PickGeneratorRegistry()
    const mockGenerator: PickGenerator<string> = {
      gameType: "coin-toss",
      generatePick(_rng: Rng) {
        return "HEADS"
      },
    }

    registry.register(mockGenerator)
    const result = registry.lookup("coin-toss")

    expect(result).toBe(mockGenerator)
  })

  it("throws MissingPickGeneratorError for unregistered game type", () => {
    const registry = new PickGeneratorRegistry()

    expect(() => registry.lookup("unknown-game")).toThrow(MissingPickGeneratorError)
    expect(() => registry.lookup("unknown-game")).toThrow(
      'No PickGenerator registered for game type "unknown-game"'
    )
  })

  it("overwrites a previously registered generator for the same game type", () => {
    const registry = new PickGeneratorRegistry()
    const gen1: PickGenerator<string> = {
      gameType: "coin-toss",
      generatePick() {
        return "HEADS"
      },
    }
    const gen2: PickGenerator<string> = {
      gameType: "coin-toss",
      generatePick() {
        return "TAILS"
      },
    }

    registry.register(gen1)
    registry.register(gen2)

    expect(registry.lookup("coin-toss")).toBe(gen2)
  })
})
