import type { Rng } from "./rng"
import type { GameType } from "@games-of-chance/shared"
import { MissingPickGeneratorError } from "./errors"

/**
 * Generates a valid random pick for a given game type.
 * Each game type registers its own generator.
 */
export interface PickGenerator<TPick = unknown> {
  gameType: GameType
  /** Generate a random valid pick using the provided RNG */
  generatePick(rng: Rng): TPick
}

/**
 * Registry mapping game types to their pick generators.
 */
export class PickGeneratorRegistry {
  private generators = new Map<GameType, PickGenerator>()

  register(generator: PickGenerator): void {
    this.generators.set(generator.gameType, generator)
  }

  lookup(gameType: GameType): PickGenerator {
    const gen = this.generators.get(gameType)
    if (!gen) throw new MissingPickGeneratorError(gameType)
    return gen
  }
}

export const pickGeneratorRegistry = new PickGeneratorRegistry()
