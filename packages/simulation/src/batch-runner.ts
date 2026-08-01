import type { SimulationConfig } from "./types"
import type { GameResult } from "./core"
import { simulateGame } from "./core"
import { createBotPlayers, RandomBot } from "./bot"
import { createRng } from "./rng"
import { pickGeneratorRegistry } from "./pick-generator"
import { registry as gameRegistry } from "@games-of-chance/server/src/games/GameRegistry"
import { validateConfig } from "./validate"

export interface BatchResult {
  config: SimulationConfig
  games: GameResult[]
  elapsedMs: number
}

/**
 * Runs a batch of games for Monte Carlo analysis.
 * Optimized for throughput: reuses player array, single RNG instance.
 */
export function runBatch(
  config: SimulationConfig,
  onProgress?: (completed: number, total: number) => void
): BatchResult {
  validateConfig(config)

  const plugin = gameRegistry.lookup(config.gameType)
  const pickGenerator = pickGeneratorRegistry.lookup(config.gameType)
  const players = createBotPlayers(config.playerCount)
  const rng = createRng(config.seed)
  const bot = new RandomBot()

  const games: GameResult[] = []
  const start = performance.now()

  for (let i = 0; i < config.gameCount; i++) {
    const result = simulateGame(
      plugin, players, config.roundCount, bot, pickGenerator, rng, i
    )
    games.push(result)

    // Progress callback every 1000 games
    if (onProgress && (i + 1) % 1000 === 0) {
      onProgress(i + 1, config.gameCount)
    }
  }

  const elapsedMs = performance.now() - start
  return { config, games, elapsedMs }
}
