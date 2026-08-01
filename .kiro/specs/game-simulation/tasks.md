# Implementation Plan: Game Simulation Engine

## Overview

Build a headless game simulation engine as a new `packages/simulation/` workspace package. The implementation proceeds from foundational types and RNG, through the core simulation loop and bot system, to the statistics reporter, CLI entry point, and finally the server-side Fast-Play adapter for the Admin UI. TypeScript throughout, using Vitest + fast-check for property-based testing.

## Tasks

- [x] 1. Set up simulation package and foundational types
  - [x] 1.1 Create `packages/simulation/` package structure
    - Initialize `packages/simulation/package.json` with name `@games-of-chance/simulation`, peer dependencies on `@games-of-chance/server` and `@games-of-chance/shared`, and a `bin` entry for the CLI
    - Create `packages/simulation/tsconfig.json` extending the workspace base config
    - Create `packages/simulation/src/types.ts` defining `SimulationConfig` interface (gameType, playerCount, roundCount, gameCount, seed?)
    - Create `packages/simulation/src/errors.ts` with `UnknownGameTypeError`, `MissingPickGeneratorError`, and `InvalidConfigError` classes
    - Create `packages/simulation/src/index.ts` barrel export
    - _Requirements: 1.2, 1.5, 6.1_

  - [x] 1.2 Implement seeded PRNG module
    - Create `packages/simulation/src/rng.ts` with `Rng` interface (next, nextInt methods)
    - Implement `SeededRng` class using xoshiro128** algorithm for deterministic results
    - Implement `SystemRng` class wrapping Math.random for non-deterministic runs
    - Implement `createRng(seed?)` factory function
    - _Requirements: 1.4_

  - [x] 1.3 Write property test for seed determinism (RNG)
    - **Property 2: Seed Determinism**
    - Verify that two `SeededRng` instances with the same seed produce identical sequences
    - **Validates: Requirements 1.4**

- [x] 2. Implement Bot Player and Pick Generation system
  - [x] 2.1 Create PickGenerator interface and registry
    - Create `packages/simulation/src/pick-generator.ts` with `PickGenerator<TPick>` interface (gameType, generatePick(rng))
    - Implement `PickGeneratorRegistry` class with register/lookup methods
    - Export singleton `pickGeneratorRegistry` instance
    - _Requirements: 2.1, 6.4_

  - [x] 2.2 Implement CoinToss PickGenerator
    - Create `packages/simulation/src/pick-generators/coin-toss.ts`
    - Implement generator producing "HEADS" or "TAILS" picks uniformly via RNG
    - Register with `pickGeneratorRegistry` on import (side-effect registration)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Implement BotPlayer decision system
    - Create `packages/simulation/src/bot.ts` with `BotDecisionMaker` interface (persona, decidePick)
    - Implement `RandomBot` class delegating to PickGenerator (uniform random, stateless)
    - Implement `createBotPlayers(count)` factory creating simulated Player objects
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.4 Write property test for bot pick validity
    - **Property 4: Bot Picks Always Valid**
    - For random RNG states and the coin-toss game type, verify every pick from RandomBot passes GamePlugin.validatePick
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.5 Write property test for uniform distribution
    - **Property 5: Random Bot Uniform Distribution**
    - Generate N≥1000 picks and verify distribution is within expected chi-squared bounds
    - **Validates: Requirements 2.3**

- [x] 3. Implement SimulationCore game loop
  - [x] 3.1 Implement `simulateGame` function
    - Create `packages/simulation/src/core.ts` with `RoundRecord` and `GameResult` interfaces
    - Implement `simulateGame()` as a pure synchronous function: loops rounds, generates bot picks, calls resolveRound, scoreRound, accumulates scores, calls computeGameLeaderboard at end
    - Support optional `onRound` callback for per-round observation
    - _Requirements: 1.1, 1.3, 1.6, 1.7, 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Add config validation to SimulationCore
    - Validate playerCount >= 2, roundCount >= 1, gameCount >= 1
    - Throw `InvalidConfigError` for invalid configs
    - Throw `UnknownGameTypeError` if game type not in GameRegistry
    - Throw `MissingPickGeneratorError` if no PickGenerator registered
    - _Requirements: 6.4, 6.5_

  - [x] 3.3 Write property test for score accumulation invariant
    - **Property 1: Score Accumulation Invariant**
    - For random configs (players 2–20, rounds 1–100), verify final cumulative score equals sum of all round deltas per player
    - **Validates: Requirements 1.1, 1.6**

  - [x] 3.4 Write property test for game result completeness
    - **Property 3: Game Result Completeness**
    - For random valid configs, verify returned GameResult has exactly R RoundRecords, P leaderboard entries, and finalScores for all P players
    - **Validates: Requirements 1.7**

  - [x] 3.5 Write property test for seed determinism (full simulation)
    - **Property 2: Seed Determinism (full simulation)**
    - Run simulation twice with same seed/config and verify identical results
    - **Validates: Requirements 1.4**

  - [x] 3.6 Write property test for generic game type support
    - **Property 10: Generic Game Type Support**
    - Create mock GamePlugin with random behaviors, register with registries, verify SimulationCore runs without game-type-specific errors
    - **Validates: Requirements 6.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Statistics Reporter
  - [x] 5.1 Implement core statistical computations
    - Create `packages/simulation/src/statistics.ts` with `BatchStatistics` interface
    - Implement `StatisticsReporter.compute()` method computing: meanScore, stdDevScore, minScore, maxScore, maxMinRatio
    - _Requirements: 5.1, 5.3_

  - [x] 5.2 Implement Gini coefficient and inequality metrics
    - Implement `computeGini(scores)` method using the sorted-scores formula
    - Integrate into `compute()` output
    - _Requirements: 5.2_

  - [x] 5.3 Implement win-rate distribution and snowball detection
    - Implement win-rate distribution computation: for each player position, count rank finishes across all games
    - Implement snowball detection via Pearson correlation between early-round scores (round 3) and final rankings
    - _Requirements: 5.4, 5.5_

  - [x] 5.4 Implement streak analysis and per-round variance
    - Implement max consecutive wins/losses per player position
    - Implement score variance by round position across all games
    - _Requirements: 5.6, 5.7_

  - [x] 5.5 Write property test for Gini coefficient properties
    - **Property 6: Gini Coefficient Mathematical Properties**
    - Verify: (a) identical scores → Gini = 0, (b) Gini ∈ [0,1], (c) scalar invariance Gini(k*x) = Gini(x)
    - **Validates: Requirements 5.2**

  - [x] 5.6 Write property test for win-rate distribution conservation
    - **Property 7: Win-Rate Distribution Conservation**
    - Verify sum of winRateDistribution[p][rank] across all ranks equals gameCount for each player position
    - **Validates: Requirements 5.4**

  - [x] 5.7 Write property test for statistical output bounds
    - **Property 8: Statistical Output Bounds**
    - Verify: (a) Pearson correlation ∈ [-1,1], (b) max consecutive wins ∈ [0, roundCount], (c) max consecutive losses ∈ [0, roundCount]
    - **Validates: Requirements 5.5, 5.6**

  - [x] 5.8 Write property test for variance and mean correctness
    - **Property 9: Variance Non-Negativity and Mean Correctness**
    - Verify: (a) variance ≥ 0, (b) mean = sum/count, (c) stdDev = sqrt(variance)
    - **Validates: Requirements 5.1, 5.7**

- [x] 6. Implement BatchRunner and CLI entry point
  - [x] 6.1 Implement BatchRunner (Monte Carlo orchestrator)
    - Create `packages/simulation/src/batch-runner.ts` with `BatchResult` interface
    - Implement `runBatch(config, onProgress?)` function: loops gameCount iterations, reuses player array and single RNG, reports progress every 1000 games
    - Optimize for throughput (minimal allocations per game loop)
    - _Requirements: 4.1, 4.4, 4.6_

  - [x] 6.2 Implement CLI entry point
    - Create `packages/simulation/src/cli.ts` using `node:util` parseArgs
    - Accept CLI arguments: --game/-g, --players/-p, --rounds/-r, --games/-n, --seed/-s
    - Import pick generators via side-effect import
    - Call `runBatch()` with progress callback writing to stdout
    - Call `StatisticsReporter.compute()` and print formatted results table
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 5.8_

  - [x] 6.3 Add `pnpm simulate` script
    - Add `simulate` script to root `package.json` that runs the CLI via the simulation package
    - Ensure the CLI runs without UI, browser, or WebSocket dependencies
    - _Requirements: 4.1, 4.3_

  - [x] 6.4 Write unit tests for CLI argument parsing and error handling
    - Test valid argument combinations produce correct SimulationConfig
    - Test invalid/missing game type prints descriptive error with exit code 1
    - Test invalid player count or round count prints usage message
    - _Requirements: 4.2, 6.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Fast-Play Adapter for Admin UI
  - [x] 8.1 Implement FastPlayAdapter server component
    - Create `packages/server/src/simulation/FastPlayAdapter.ts`
    - Implement async `run()` method that executes rounds with configurable delay (default 500ms) between each
    - Broadcast STATE_SYNC messages after each round using existing RoomState shape with `simulation: true` metadata marker
    - Broadcast final state with RESULT phase when all rounds complete
    - Implement `abort()` method to stop mid-simulation and preserve partial results
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8_

  - [x] 8.2 Integrate Fast-Play trigger into GameRoom
    - Add `START_SIMULATION` message type handling in `packages/server/src/room.ts`
    - Gate activation behind host role check
    - Instantiate FastPlayAdapter and call `run()` when host triggers simulation
    - Handle `STOP_SIMULATION` message to call `abort()` on the adapter
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 8.3 Add simulation UI controls to client
    - Add "Simulate Game" button to `packages/client/src/components/lobby/HostControls.tsx` (visible only to host)
    - Add simulation active indicator to distinguish simulation from live game
    - Add "Stop Simulation" button visible during active simulation
    - Wire buttons to send `START_SIMULATION` and `STOP_SIMULATION` messages via PartySocket
    - _Requirements: 3.1, 3.6, 3.7, 3.8_

  - [x] 8.4 Write unit tests for FastPlayAdapter
    - Test abort stops execution and preserves partial state
    - Test that STATE_SYNC broadcasts occur with correct shape and simulation marker
    - Test round interval timing behavior
    - _Requirements: 3.2, 3.5, 3.6_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The simulation package has zero dependencies on PartyKit or WebSocket — only the FastPlayAdapter (which lives in the server package) bridges simulation to the network layer
- The `pnpm simulate` CLI should achieve 1M coin-toss games in under 60 seconds; optimize the hot loop accordingly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5", "3.6", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 7, "tasks": ["5.5", "5.6", "5.7", "5.8", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2", "8.3"] },
    { "id": 12, "tasks": ["8.4"] }
  ]
}
```
