import type { Player } from "@games-of-chance/shared"
import type { Rng } from "./rng"
import type { PickGenerator } from "./pick-generator"

/**
 * Decision-making interface for bot players.
 * "Random" is the default; additional personas can be added.
 */
export interface BotDecisionMaker {
  persona: string
  decidePick(generator: PickGenerator, rng: Rng): unknown
}

/**
 * Random bot — picks uniformly at random from valid options.
 * Stateless: each decision is independent.
 */
export class RandomBot implements BotDecisionMaker {
  persona = "Random"

  decidePick(generator: PickGenerator, rng: Rng): unknown {
    return generator.generatePick(rng)
  }
}

/**
 * Creates an array of simulated Player objects for a game.
 */
export function createBotPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bot-${i}`,
    name: `Bot ${i + 1}`,
    role: "player" as const,
    connected: true,
    connectionId: `bot-${i}`,
  }))
}
