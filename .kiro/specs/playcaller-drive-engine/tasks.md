# Implementation Plan: Playcaller Drive Engine

## Overview

Implement the Drive Engine as a pure functional module that resolves football drives through a multi-step D&D-style roll system. The engine accepts play selections, applies defensive modifiers from a config-driven play matrix, rolls for outcomes via injectable RNG, and returns updated drive state with play-by-play text. This replaces the Phase 1 random `MatchResolver` with interactive play-calling mechanics.

## Tasks

- [x] 1. Define types and configuration
  - [x] 1.1 Create drive engine type definitions
    - Create `packages/server/src/games/playcaller/drive/types.ts` with all interfaces: `PlayAxis`, `PlayStyle`, `OffensivePlayId`, `DefensivePlayId`, `OffensivePlayStats`, `DefensiveModifier`, `DefensivePlayDef`, `PlayConfig`, `PlayMatrix`, `RngFunction`, `PlayOutcome`, `PlayResult`, `PlayHistoryEntry`, `DriveEndingType`, `DriveCompletion`, `DriveState`
    - Include custom error classes: `InvalidPlayError`, `DriveCompleteError`, `InvalidPlayerError`, `InvalidSeedError`
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 4.4, 4.5, 4.6, 5.10, 10.1, 11.1, 12.5_

  - [x] 1.2 Create play configuration and matrix
    - Create `packages/server/src/games/playcaller/drive/config.ts` with `DEFAULT_PLAY_CONFIG` (4 offensive plays with base stats, 4 defensive play definitions) and `DEFAULT_PLAY_MATRIX` (16 defensive modifier entries keyed by `"offId:defId"` template literal)
    - Safe plays: higher success rate (0.65-0.70), lower yardage ceiling (5-7)
    - Aggressive plays: lower success rate (0.45-0.55), higher yardage ceiling (10-15)
    - Matching axis modifiers: shrink variance, moderate success penalty, increase crit failure
    - Mismatched axis modifiers: expand variance, slight success boost, increase crit success
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 9.1, 9.2, 9.3, 9.4, 12.1, 12.2, 12.3, 12.4_

- [x] 2. Implement core engine functions
  - [x] 2.1 Implement createDriveState and input validation
    - Create `packages/server/src/games/playcaller/drive/engine.ts`
    - Implement `createDriveState(playerA, playerB, seedA, seedB)` — assigns higher seed as offense, initializes yardLine=25, down=1, yardsToGo=10, empty playHistory
    - Throw `InvalidPlayerError` if both player IDs are the same
    - Throw `InvalidSeedError` if seeds are equal
    - _Requirements: 1.1, 1.2, 1.3, 10.4_

  - [x] 2.2 Implement resolveDown core logic
    - Implement `resolveDown(state, offPlay, defPlay, rng, config, matrix)` as a pure function
    - Validate play IDs (throw `InvalidPlayError` for invalid selections)
    - Throw `DriveCompleteError` if called on a completed drive
    - Lookup defensive modifier from matrix, apply to base stats with clamping rules
    - Perform multi-step roll sequence: success roll → critical check → yardage computation
    - Clamping: successRate [0.05, 0.95], yardageMin [0, max], yardageMax [1, 25], critChances [0, 0.30]
    - _Requirements: 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 10.1, 10.2, 10.3_

  - [x] 2.3 Implement down progression and drive completion
    - Within resolveDown, after computing yardage: update yardLine (clamp to [0, 99])
    - First-down logic: if yards gained >= yardsToGo, reset down=1, yardsToGo=min(10, newYardLine)
    - Progression: if not enough yards and down < 4, increment down, reduce yardsToGo
    - Turnover on downs: if down=4 and not enough yards, end drive with defense winning
    - Touchdown: if yardLine reaches 0, end drive with offense winning
    - Turnovers: interception (pass crit failure) or fumble (run crit failure) end drive immediately
    - Append PlayHistoryEntry to playHistory
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2, 11.3, 13.1, 13.2, 13.3_

  - [x] 2.4 Implement isDriveComplete, getDriveCompletion, and selectRandomPlay
    - `isDriveComplete(state)` — returns boolean based on state.isComplete
    - `getDriveCompletion(state)` — returns completion info or throws if not complete
    - `selectRandomPlay(plays, rng)` — selects a random play from the provided list using rng
    - _Requirements: 2.5, 10.5_

  - [x] 2.5 Write property test: Initial state correctness (Property 1)
    - **Property 1: Initial state correctness**
    - For any two player IDs and seed values where seedA ≠ seedB, verify yardLine=25, down=1, yardsToGo=10, empty playHistory, higher seed as offense
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.6 Write property test: Pure function determinism (Property 8)
    - **Property 8: Pure function determinism**
    - Call resolveDown twice with identical inputs and same RNG sequence, verify identical outputs and no mutation of input state
    - **Validates: Requirements 5.10, 10.2, 10.3**

- [x] 3. Checkpoint - Core engine functions compile and pass basic validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3.1 Create CLI harness for interactive drive testing
  - Create `packages/server/src/games/playcaller/drive/cli.ts`
  - Import createDriveState, resolveDown, isDriveComplete, getDriveCompletion, selectRandomPlay, generatePlayByPlay from the drive engine
  - Use `Math.random` as the RNG function
  - Initialize a drive with "player-you" vs "bot" (bot gets lower seed so you're on offense)
  - Each loop iteration: print current state (down, yardsToGo, yardLine), prompt user to pick a play (1-4), bot picks randomly via selectRandomPlay, resolve the down, print the play-by-play text
  - On drive completion: print the final result (touchdown/turnover/interception/fumble) and winner
  - Add a `"drive:cli"` script to `packages/server/package.json` that runs `npx tsx src/games/playcaller/drive/cli.ts`
  - Create `packages/server/src/games/playcaller/drive/README.md` documenting the drive engine module: what it does, how to run the CLI (`npm run drive:cli` from packages/server), play selection options (1-4), and example output
  - _Purpose: Manual smoke test to visually verify drive flow and play-by-play feel before moving to property tests_

- [x] 4. Implement resolution roll mechanics and property tests
  - [x] 4.1 Write unit tests for resolveDown roll outcomes
    - Create `packages/server/src/games/playcaller/drive/engine.test.ts`
    - Test with controlled RNG: success roll (rng=0.5), critical success, incomplete pass, tackle for loss, interception, fumble
    - Test a complete drive scenario: 3 successful plays → touchdown
    - Test a complete drive scenario: 4 incomplete passes → turnover on downs
    - Test a complete drive scenario: critical failure on first play → immediate turnover
    - Test error cases: invalid play ID, completed drive, same player both sides, equal seeds
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.3, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Write property test: Success roll threshold (Property 2)
    - **Property 2: Success roll threshold**
    - For any play combination and config, when RNG < modified success rate → successful outcome; when RNG >= modified success rate → failure outcome
    - **Validates: Requirements 5.1**

  - [x] 4.3 Write property test: Critical success yardage bounds (Property 3)
    - **Property 3: Critical success yardage bounds**
    - For any critical success, yards gained is between 100% and 120% (rounded) of modified max yardage
    - **Validates: Requirements 5.2, 5.3**

  - [x] 4.4 Write property test: Normal success yardage bounds (Property 4)
    - **Property 4: Normal success yardage bounds**
    - For any normal success, yards gained is within [min, max] of modified yardage range
    - **Validates: Requirements 5.4**

  - [x] 4.5 Write property test: Critical failure resolves by axis (Property 5)
    - **Property 5: Critical failure resolves by axis**
    - For any critical failure: pass axis → interception, run axis → fumble; drive ends with defense as winner
    - **Validates: Requirements 5.5, 5.6, 5.7, 7.2, 7.3**

  - [x] 4.6 Write property test: Failed pass yields zero yards (Property 6)
    - **Property 6: Failed pass yields zero yards**
    - For any pass play failure (non-critical), yards gained = 0 and outcome = incomplete_pass
    - **Validates: Requirements 5.8**

  - [x] 4.7 Write property test: Failed run yields tackle-for-loss (Property 7)
    - **Property 7: Failed run yields tackle-for-loss yardage**
    - For any run play failure (non-critical), yards gained is between -3 and -1 and outcome = tackle_for_loss
    - **Validates: Requirements 5.9, 13.1**

- [x] 5. Implement down progression property tests
  - [x] 5.1 Write property test: First-down reset logic (Property 9)
    - **Property 9: First-down reset logic**
    - When yards gained >= yardsToGo and drive doesn't end, resulting state has down=1 and yardsToGo=min(10, newYardLine)
    - **Validates: Requirements 6.1, 6.6**

  - [x] 5.2 Write property test: Down progression on insufficient gain (Property 10)
    - **Property 10: Down progression on insufficient gain**
    - When down < 4 and yards gained < yardsToGo (no turnover), down increments by 1 and yardsToGo decreases by yards gained
    - **Validates: Requirements 6.2**

  - [x] 5.3 Write property test: Turnover on downs (Property 11)
    - **Property 11: Turnover on downs**
    - On 4th down when play doesn't gain enough yards and no critical failure, drive ends as turnover_on_downs with defense as winner
    - **Validates: Requirements 6.3, 7.4**

  - [x] 5.4 Write property test: Yard line update and clamping (Property 12)
    - **Property 12: Yard line update and clamping**
    - Resulting yardLine = max(0, min(99, previousYardLine - yardsGained)); never negative, never exceeds 99
    - **Validates: Requirements 6.4, 6.5, 13.2, 13.3**

  - [x] 5.5 Write property test: Touchdown detection (Property 13)
    - **Property 13: Touchdown detection**
    - When yardLine reaches 0 after applying yards, drive ends with offense as winner and endingType=touchdown
    - **Validates: Requirements 7.1**

  - [x] 5.6 Write property test: Play history append invariant (Property 14)
    - **Property 14: Play history append invariant**
    - After resolveDown on non-complete drive, playHistory has exactly one more entry (appended last) with correct down, yardsToGo, yardLine, plays, result, and resultingYardLine
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 6. Checkpoint - Resolution and progression tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement play-by-play text generation
  - [x] 7.1 Create play-by-play template module
    - Create `packages/server/src/games/playcaller/drive/playByPlay.ts`
    - Define `DEFAULT_TEMPLATES` with template strings for each PlayOutcome (success, critical_success, incomplete_pass, tackle_for_loss, interception, fumble)
    - Implement `generatePlayByPlay(result, templates?)` — deterministic template selection based on play details, {yards} placeholder replacement
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.2 Write property test: Play-by-play text correctness (Property 15)
    - **Property 15: Play-by-play text correctness**
    - For any resolved down: text is non-empty, deterministic for same inputs, and contains absolute yardage value when outcome involves non-zero yardage
    - **Validates: Requirements 8.1, 8.3, 8.4**

  - [x] 7.3 Write unit tests for play-by-play generation
    - Create `packages/server/src/games/playcaller/drive/playByPlay.test.ts`
    - Test each outcome type produces correct template-based text
    - Test yardage placeholder replacement
    - Test custom templates override defaults
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Implement defensive modifier property tests
  - [x] 8.1 Write property test: Matching axis reduces offensive range (Property 16)
    - **Property 16: Matching axis reduces offensive range**
    - For any play combination sharing the same axis, the modifier results in a smaller yardage range or reduced success rate compared to base
    - **Validates: Requirements 4.7, 9.4**

  - [x] 8.2 Write property test: Mismatching axis expands offensive range (Property 17)
    - **Property 17: Mismatching axis expands offensive range**
    - For any play combination with different axes, the modifier results in expanded yardage range or improved success rate relative to matched case
    - **Validates: Requirements 4.8**

  - [x] 8.3 Write property test: Random play selection validity (Property 18)
    - **Property 18: Random play selection validity**
    - For any RNG output, selectRandomPlay returns exactly one valid play ID from the provided list
    - **Validates: Requirements 2.5**

- [x] 9. Implement config validation and statistical balance tests
  - [x] 9.1 Write config structure validation tests
    - Create `packages/server/src/games/playcaller/drive/config.test.ts`
    - Verify DEFAULT_PLAY_CONFIG has exactly 4 offensive and 4 defensive plays
    - Verify DEFAULT_PLAY_MATRIX has exactly 16 entries
    - Verify all base stats are within declared ranges (successRate 0-1, yardage min <= max, crit chances 0-1)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 12.1, 12.2, 12.3_

  - [x] 9.2 Write property test: Statistical balance — uniform random (Property 19)
    - **Property 19: Statistical balance — uniform random play selection**
    - Create `packages/server/src/games/playcaller/drive/balance.property.test.ts`
    - For seeded RNG, simulate 1000+ drives with both players selecting uniformly at random; offensive win rate must be between 45% and 55%
    - **Validates: Requirements 9.1**

  - [x] 9.3 Write property test: Statistical balance — average yardage (Property 20)
    - **Property 20: Statistical balance — average yardage per play**
    - For seeded RNG, average yards gained per play (across all offensive plays equally weighted) must be between 2.5 and 3.5 regardless of defensive play selected
    - **Validates: Requirements 9.3**

- [x] 10. Checkpoint - All property and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create public API and MatchResolver integration
  - [x] 11.1 Create index module and MatchResolver adapter
    - Create `packages/server/src/games/playcaller/drive/index.ts` — re-export public API (createDriveState, resolveDown, isDriveComplete, getDriveCompletion, selectRandomPlay, createDriveResolver, types, config)
    - Implement `createDriveResolver(rng, config, matrix)` that returns a `MatchResolver`-compatible function running a full auto-resolved drive
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.2 Write integration tests for drive resolver
    - Create `packages/server/src/games/playcaller/drive/engine.test.ts` integration section
    - Test createDriveResolver resolves a matchup and returns one of the two player IDs
    - Test deterministic replay: same seed produces identical play-by-play history
    - Test full bracket with Drive_Engine: run a 4-player bracket using drive resolution, verify champion is determined
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 12. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` with Vitest
- Unit tests validate specific examples and edge cases
- The Drive_Engine is a pure functional module — all randomness injected via RNG_Function, no side effects
- Tag format for property tests: **Feature: playcaller-drive-engine, Property {N}: {title}**
- Statistical balance tests (Properties 19, 20) require 1000+ simulated drives and may take longer to run
- The drive resolver adapter (`createDriveResolver`) enables drop-in replacement for the Phase 1 `randomResolver`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "2.6", "3.1", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1", "8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```
