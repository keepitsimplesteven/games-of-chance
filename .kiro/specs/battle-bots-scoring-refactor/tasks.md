# Implementation Plan: Battle Bots Scoring Refactor

## Overview

Replace the rank-based FFA scoring in BattleBotsPlugin with a survival-tick-based system. Extract scoring constants to a dedicated file, implement a pure utility function for eliminated player scoring, refactor the `scoreRound` method for Round 3, and remove the obsolete `BattleBotsLeaderboard` component.

## Tasks

- [x] 1. Create scoring constants file and utility functions
  - [x] 1.1 Create `scoring-constants.ts` with exported constants
    - Create file at `packages/server/src/games/battle-bots/scoring-constants.ts`
    - Export `WIN_BONUS = 25`, `PENALTY_MULTIPLIER = 1.1`, `SURVIVOR_POINTS = 100`
    - Add JSDoc comments explaining each constant's purpose
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.2 Add survival scoring utility functions to `scoring-utils.ts`
    - Import constants from `scoring-constants.ts`
    - Implement `computeEliminatedSurvivalPoints(eliminatedTick, totalTicks)` returning `Math.ceil((eliminatedTick / (totalTicks * PENALTY_MULTIPLIER)) * SURVIVOR_POINTS)`
    - Implement `computeSurvivorScore()` returning `SURVIVOR_POINTS + WIN_BONUS`
    - Add JSDoc with parameter descriptions and return value semantics
    - _Requirements: 3.1, 2.1, 2.2, 5.1_

  - [x]* 1.3 Write property tests for scoring utility functions
    - **Property 4: FFA eliminated player formula correctness**
    - **Property 5: FFA eliminated score ceiling invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Create test file at `packages/server/src/games/battle-bots/scoring.prop.test.ts`
    - Use `fast-check` with `{ numRuns: 200 }` configuration
    - Generate random (eliminatedTick, totalTicks) pairs where `1 <= eliminatedTick <= totalTicks` and `totalTicks >= 1`
    - Verify formula output matches `Math.ceil((eliminatedTick / (totalTicks * 1.1)) * 100)`
    - Verify result never exceeds 91 with default constants

- [x] 2. Refactor `scoreRound` in BattleBotsPlugin
  - [x] 2.1 Refactor Round 2 scoring to use imported constants
    - In `BattleBotsPlugin.ts`, import `WIN_BONUS` from `scoring-constants.ts`
    - Replace any inline `25` literal in Round 2 scoring with `WIN_BONUS`
    - Ensure winners receive `WIN_BONUS` points and losers receive 0
    - _Requirements: 1.1, 1.2, 5.1_

  - [x] 2.2 Implement Round 3 FFA survival-tick scoring
    - Replace existing Round 3 `case 3` logic in `scoreRound` method
    - Import `computeEliminatedSurvivalPoints` and `computeSurvivorScore` from `scoring-utils.ts`
    - Iterate both `winnersBracket` and `losersBracket`
    - Compute `totalTicks` from the last entry in `eliminationOrder`
    - Score eliminated players using `computeEliminatedSurvivalPoints(eliminatedTick, totalTicks)`
    - Score survivor using `computeSurvivorScore()`
    - Exclude Bot_Persona participants from deltas using existing `botPersonaIds` set
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.4, 4.1, 4.2_

  - [x]* 2.3 Write property tests for scoreRound integration
    - **Property 1: 1v1 round winner/loser scoring**
    - **Property 2: Bot_Persona exclusion from all score deltas**
    - **Property 3: FFA survivor receives fixed 125 points**
    - **Property 6: New scoring output differs from legacy rank-based formula**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.4, 4.1, 4.3**
    - Add tests to `packages/server/src/games/battle-bots/scoring.prop.test.ts`
    - Generate random 1v1 pairing results and verify winner gets 25, loser gets 0
    - Generate random FFA brackets with Bot_Persona entries and verify no bot IDs in deltas
    - Generate random FFA brackets with a non-bot survivor and verify delta is exactly 125
    - Generate FFA results with 3+ non-bot participants and verify at least one delta differs from legacy formula

  - [x]* 2.4 Update unit tests in `BattleBotsPlugin.scoreRound.test.ts`
    - Update existing Round 2 test assertions to match constant-based scoring
    - Add Round 3 example-based tests with known elimination ticks and expected scores
    - Add edge case: single-robot bracket (auto-win survivor gets 125)
    - Add edge case: all non-survivor players eliminated on same tick get same score
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.3_

- [x] 3. Checkpoint - Verify scoring logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Remove obsolete BattleBotsLeaderboard component
  - [x] 4.1 Delete `BattleBotsLeaderboard.tsx` and clean up imports
    - Delete `packages/client/src/games/battle-bots/BattleBotsLeaderboard.tsx`
    - Remove the import of `BattleBotsLeaderboard` from `GameView.tsx`
    - Remove the `showBattleBotsLeaderboard` variable and associated conditional JSX block from `GameView.tsx`
    - _Requirements: 6.2, 6.3_

  - [x]* 4.2 Verify no remaining references to BattleBotsLeaderboard
    - Search codebase for any remaining imports or usages of `BattleBotsLeaderboard`
    - Ensure build compiles cleanly without the removed component
    - _Requirements: 6.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementation tasks use TypeScript
- The project already has `fast-check ^3.23.2` and `vitest` configured for property-based testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3", "2.4", "4.1"] },
    { "id": 5, "tasks": ["4.2"] }
  ]
}
```
