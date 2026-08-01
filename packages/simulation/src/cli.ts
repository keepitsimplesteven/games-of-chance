#!/usr/bin/env node

import { parseArgs } from "node:util"
import { runBatch } from "./batch-runner"
import { StatisticsReporter } from "./statistics"
import { InvalidConfigError, UnknownGameTypeError, MissingPickGeneratorError } from "./errors"

// Side-effect imports: registers pick generators and game plugins
import "./pick-generators/coin-toss"
import "@games-of-chance/server/src/games/coin-toss/CoinTossPlugin"

const { values } = parseArgs({
  options: {
    game: { type: "string", short: "g", default: "coin-toss" },
    players: { type: "string", short: "p", default: "4" },
    rounds: { type: "string", short: "r", default: "10" },
    games: { type: "string", short: "n", default: "10000" },
    seed: { type: "string", short: "s" },
  },
})

const config = {
  gameType: values.game!,
  playerCount: parseInt(values.players!, 10),
  roundCount: parseInt(values.rounds!, 10),
  gameCount: parseInt(values.games!, 10),
  seed: values.seed ? parseInt(values.seed, 10) : undefined,
}

// Print header
console.log(`Simulating ${config.gameCount} games of "${config.gameType}"`)
console.log(`  Players: ${config.playerCount}, Rounds/game: ${config.roundCount}`)
if (config.seed !== undefined) console.log(`  Seed: ${config.seed}`)
console.log()

try {
  const result = runBatch(config, (completed, total) => {
    process.stdout.write(
      `\r  Progress: ${completed}/${total} games (${((completed / total) * 100).toFixed(1)}%)`
    )
  })

  console.log(
    `\r  Completed ${config.gameCount} games in ${result.elapsedMs.toFixed(0)}ms`
  )
  console.log()

  const reporter = new StatisticsReporter()
  const stats = reporter.compute(result.games, config.playerCount)

  // Output formatted results table
  console.log("── Results ──────────────────────────────────")
  console.log(`  Mean score:        ${stats.meanScore.toFixed(2)}`)
  console.log(`  Std deviation:     ${stats.stdDevScore.toFixed(2)}`)
  console.log(`  Score range:       ${stats.minScore} – ${stats.maxScore}`)
  console.log(`  Max/Min ratio:     ${stats.maxMinRatio === Infinity ? "∞" : stats.maxMinRatio.toFixed(2)}`)
  console.log(`  Gini coefficient:  ${stats.giniCoefficient.toFixed(4)}`)
  console.log()

  console.log("── Snowball Detection ───────────────────────")
  console.log(`  Early-lead corr:   ${stats.earlyLeadCorrelation.toFixed(4)}`)
  console.log()

  console.log("── Streak Analysis ─────────────────────────")
  console.log(`  Max consecutive wins:   ${Math.max(...stats.maxConsecutiveWins)}`)
  console.log(`  Max consecutive losses: ${Math.max(...stats.maxConsecutiveLosses)}`)
  console.log()

  console.log("── Win-Rate Distribution ───────────────────")
  console.log("  Position → Rank distribution (% of games)")
  for (let p = 0; p < config.playerCount; p++) {
    const ranks = stats.winRateDistribution[p]
    const formatted = ranks
      .map((count, rank) => `R${rank + 1}:${((count / stats.gameCount) * 100).toFixed(1)}%`)
      .join("  ")
    console.log(`  Player ${p + 1}: ${formatted}`)
  }
  console.log()

  console.log("── Per-Round Variance ──────────────────────")
  const maxRoundsToShow = Math.min(stats.scoreVarianceByRound.length, 20)
  for (let r = 0; r < maxRoundsToShow; r++) {
    console.log(`  Round ${String(r + 1).padStart(3)}: variance = ${stats.scoreVarianceByRound[r].toFixed(4)}`)
  }
  if (stats.scoreVarianceByRound.length > 20) {
    console.log(`  ... (${stats.scoreVarianceByRound.length - 20} more rounds omitted)`)
  }
} catch (error) {
  if (
    error instanceof InvalidConfigError ||
    error instanceof UnknownGameTypeError ||
    error instanceof MissingPickGeneratorError
  ) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
  throw error
}
