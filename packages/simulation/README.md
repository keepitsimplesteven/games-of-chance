# @games-of-chance/simulation

Headless game simulation engine for balance testing and statistical analysis. Runs games without WebSocket connections or browser clients using the same GamePlugin interface as production.

## Quick Start

From the workspace root:

```bash
pnpm simulate -- --games 10000 --seed 42
```

## CLI Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--game` | `-g` | `coin-toss` | Game type to simulate |
| `--players` | `-p` | `4` | Number of bot players (minimum 2) |
| `--rounds` | `-r` | `10` | Rounds per game |
| `--games` | `-n` | `10000` | Total games to simulate |
| `--seed` | `-s` | *(random)* | PRNG seed for reproducible results |

## Examples

```bash
# Run 1 million games with a fixed seed for reproducibility
pnpm simulate -- -n 1000000 -s 123

# Quick 100-game run with 6 players and 20 rounds each
pnpm simulate -- -p 6 -r 20 -n 100

# Default run (coin-toss, 4 players, 10 rounds, 10000 games, random seed)
pnpm simulate
```

## Output

The CLI prints a full statistical report to stdout:

- **Score distribution** — mean, std deviation, min/max range, max/min ratio
- **Gini coefficient** — measures score inequality (0 = perfectly equal, 1 = max inequality)
- **Snowball detection** — Pearson correlation between early-round scores and final rank
- **Streak analysis** — max consecutive wins/losses across all players
- **Win-rate distribution** — percentage of games each player position finishes at each rank
- **Per-round variance** — how much each round contributes to final score variance

## Architecture

```
packages/simulation/
├── src/
│   ├── cli.ts              # CLI entry point (pnpm simulate)
│   ├── core.ts             # simulateGame() pure function
│   ├── batch-runner.ts     # Monte Carlo orchestrator (runBatch)
│   ├── statistics.ts       # StatisticsReporter with all metrics
│   ├── bot.ts              # BotDecisionMaker, RandomBot, createBotPlayers
│   ├── rng.ts              # SeededRng (xoshiro128**), SystemRng, createRng
│   ├── pick-generator.ts   # PickGenerator interface and registry
│   ├── pick-generators/
│   │   └── coin-toss.ts    # CoinToss pick generator (self-registers)
│   ├── validate.ts         # Config validation
│   ├── types.ts            # SimulationConfig interface
│   ├── errors.ts           # Custom error classes
│   └── index.ts            # Barrel exports
└── package.json
```

## Adding a New Game Type

To simulate a new game, you need:

1. A `GamePlugin` registered in the server's `GameRegistry` (implements `resolveRound`, `scoreRound`, `computeGameLeaderboard`, `validatePick`)
2. A `PickGenerator` that produces valid picks for the game type

```typescript
// packages/simulation/src/pick-generators/my-game.ts
import type { PickGenerator } from "../pick-generator"
import { pickGeneratorRegistry } from "../pick-generator"
import type { Rng } from "../rng"

export const myGamePickGenerator: PickGenerator<MyPick> = {
  gameType: "my-game",
  generatePick(rng: Rng): MyPick {
    // Return a valid random pick using rng
  },
}

pickGeneratorRegistry.register(myGamePickGenerator)
```

Then import it as a side-effect in `cli.ts`:

```typescript
import "./pick-generators/my-game"
```

## Programmatic Usage

```typescript
import { runBatch, StatisticsReporter } from "@games-of-chance/simulation"
import "@games-of-chance/simulation/src/pick-generators/coin-toss"

const result = runBatch({
  gameType: "coin-toss",
  playerCount: 4,
  roundCount: 10,
  gameCount: 10000,
  seed: 42,
})

const reporter = new StatisticsReporter()
const stats = reporter.compute(result.games, 4)

console.log(`Gini: ${stats.giniCoefficient}`)
console.log(`Snowball correlation: ${stats.earlyLeadCorrelation}`)
```

## Testing

```bash
# Run all simulation tests (unit + property-based)
pnpm --filter @games-of-chance/simulation test
```

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) to verify correctness invariants across thousands of random inputs.
