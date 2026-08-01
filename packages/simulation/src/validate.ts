import type { SimulationConfig } from "./types"
import { registry } from "@games-of-chance/server/src/games/GameRegistry"
import { pickGeneratorRegistry } from "./pick-generator"
import { InvalidConfigError, UnknownGameTypeError, MissingPickGeneratorError } from "./errors"

/**
 * Validates a SimulationConfig, throwing descriptive errors for invalid values.
 * Should be called before running a simulation batch or single game.
 */
export function validateConfig(config: SimulationConfig): void {
  if (config.playerCount < 2) {
    throw new InvalidConfigError(
      `playerCount must be >= 2, got ${config.playerCount}`
    )
  }

  if (config.roundCount < 1) {
    throw new InvalidConfigError(
      `roundCount must be >= 1, got ${config.roundCount}`
    )
  }

  if (config.gameCount < 1) {
    throw new InvalidConfigError(
      `gameCount must be >= 1, got ${config.gameCount}`
    )
  }

  // Check game type is registered in the GameRegistry
  const registeredTypes = registry.list()
  if (!registeredTypes.includes(config.gameType)) {
    throw new UnknownGameTypeError(config.gameType)
  }

  // Check a PickGenerator is registered for this game type
  try {
    pickGeneratorRegistry.lookup(config.gameType)
  } catch (e) {
    if (e instanceof MissingPickGeneratorError) {
      throw e
    }
    throw e
  }
}
