import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { validateConfig } from "./validate"
import { InvalidConfigError, UnknownGameTypeError, MissingPickGeneratorError } from "./errors"
import { registry } from "@games-of-chance/server/src/games/GameRegistry"
import { pickGeneratorRegistry, PickGeneratorRegistry } from "./pick-generator"
import type { SimulationConfig } from "./types"
import type { Rng } from "./rng"

// Import coin-toss plugin side-effect (registers in GameRegistry)
import "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"
// Import coin-toss pick generator side-effect (registers in PickGeneratorRegistry)
import "./pick-generators/coin-toss"

describe("validateConfig", () => {
  const validConfig: SimulationConfig = {
    gameType: "coin-toss",
    playerCount: 4,
    roundCount: 10,
    gameCount: 100,
  }

  it("does not throw for a valid config", () => {
    expect(() => validateConfig(validConfig)).not.toThrow()
  })

  it("does not throw when seed is provided", () => {
    expect(() => validateConfig({ ...validConfig, seed: 42 })).not.toThrow()
  })

  describe("playerCount validation", () => {
    it("throws InvalidConfigError when playerCount < 2", () => {
      expect(() => validateConfig({ ...validConfig, playerCount: 1 })).toThrow(
        InvalidConfigError
      )
    })

    it("throws InvalidConfigError when playerCount is 0", () => {
      expect(() => validateConfig({ ...validConfig, playerCount: 0 })).toThrow(
        InvalidConfigError
      )
    })

    it("throws InvalidConfigError with descriptive message", () => {
      expect(() => validateConfig({ ...validConfig, playerCount: 1 })).toThrow(
        "playerCount must be >= 2, got 1"
      )
    })

    it("accepts playerCount of exactly 2", () => {
      expect(() => validateConfig({ ...validConfig, playerCount: 2 })).not.toThrow()
    })
  })

  describe("roundCount validation", () => {
    it("throws InvalidConfigError when roundCount < 1", () => {
      expect(() => validateConfig({ ...validConfig, roundCount: 0 })).toThrow(
        InvalidConfigError
      )
    })

    it("throws InvalidConfigError with descriptive message", () => {
      expect(() => validateConfig({ ...validConfig, roundCount: 0 })).toThrow(
        "roundCount must be >= 1, got 0"
      )
    })

    it("accepts roundCount of exactly 1", () => {
      expect(() => validateConfig({ ...validConfig, roundCount: 1 })).not.toThrow()
    })
  })

  describe("gameCount validation", () => {
    it("throws InvalidConfigError when gameCount < 1", () => {
      expect(() => validateConfig({ ...validConfig, gameCount: 0 })).toThrow(
        InvalidConfigError
      )
    })

    it("throws InvalidConfigError with descriptive message", () => {
      expect(() => validateConfig({ ...validConfig, gameCount: 0 })).toThrow(
        "gameCount must be >= 1, got 0"
      )
    })

    it("accepts gameCount of exactly 1", () => {
      expect(() => validateConfig({ ...validConfig, gameCount: 1 })).not.toThrow()
    })
  })

  describe("gameType validation", () => {
    it("throws UnknownGameTypeError for unregistered game type", () => {
      expect(() =>
        validateConfig({ ...validConfig, gameType: "nonexistent-game" })
      ).toThrow(UnknownGameTypeError)
    })

    it("throws UnknownGameTypeError with game type in message", () => {
      expect(() =>
        validateConfig({ ...validConfig, gameType: "nonexistent-game" })
      ).toThrow('Unknown game type "nonexistent-game"')
    })
  })

  describe("PickGenerator validation", () => {
    it("throws MissingPickGeneratorError when no generator registered for game type", () => {
      // Register a game type in GameRegistry but NOT in PickGeneratorRegistry
      const fakePlugin = {
        gameType: "fake-game-no-picker" as string,
        resolveRound: () => ({}),
        scoreRound: () => ({ deltas: {} }),
        computeGameLeaderboard: () => [],
        validatePick: () => true,
      }
      registry.register(fakePlugin as any)

      expect(() =>
        validateConfig({ ...validConfig, gameType: "fake-game-no-picker" })
      ).toThrow(MissingPickGeneratorError)
    })
  })
})
