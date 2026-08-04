# Implementation Plan: Playcaller Tournament

## Overview

Implement the Playcaller single-elimination tournament bracket game as a GamePlugin. The implementation builds up from shared types, through the pure Bracket_Engine, to the plugin adapter and client components. Match resolution in Phase 1 is random — the architecture decouples bracket logic from resolution so Phase 2 can swap in play-calling mechanics without modifying the engine.

## Tasks

- [x] 1. Define shared types and constants
  - [x] 1.1 Add Playcaller types to shared package
    - Add `PlaycallerPick`, `Matchup`, `BracketRound`, `Bracket`, `PlaycallerRoundResult`, `PlaycallerGameState`, and `MatchResolver` type definitions to `packages/shared/src/types.ts`
    - _Requirements: 1.1, 1.4, 2.6, 4.4, 4.6_

  - [x] 1.2 Create Playcaller constants file
    - Create `packages/server/src/games/playcaller/constants.ts` with `PLAYCALLER` object (PICK_WINDOW_MS, DEFAULT_SCORE_TABLE, MIN_PLAYERS, MAX_PLAYERS, SCORE_TABLE_MIN_ENTRIES, SCORE_TABLE_MAX_ENTRIES) and `PLAYCALLER_SETTINGS_SCHEMA`
    - _Requirements: 1.3, 6.2, 10.1, 11.3_

- [x] 2. Implement Bracket_Engine (pure functional module)
  - [x] 2.1 Implement bracket generation logic
    - Create `packages/server/src/games/playcaller/BracketEngine.ts` with `generateBracket`, `computeByeCount`, and `nextPowerOfTwo` functions
    - Implement seeding with injected tiebreaker function for tied players
    - Implement standard bracket pairing (highest-vs-lowest inward)
    - Assign byes to highest-seeded players when player count is not a power of 2
    - Pre-compute all rounds with empty matchup slots for future rounds
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 5.4, 10.1, 10.3_

  - [x] 2.2 Write property test: Bracket structural validity
    - **Property 1: Bracket structural validity**
    - For player counts 2-10, verify totalRounds equals ceil(log2(N)), every player appears exactly once, and the final round has one matchup
    - **Validates: Requirements 2.1, 2.6, 3.4, 10.1**

  - [x] 2.3 Write property test: Seeding correctness
    - **Property 2: Seeding correctness**
    - For random session scores, verify seed assignments match rank order and tied players are never alphabetically ordered
    - **Validates: Requirements 2.2, 2.5**

  - [x] 2.4 Write property test: Bye assignment correctness
    - **Property 3: Bye assignment correctness**
    - For non-power-of-2 player counts, verify bye count equals nextPowerOf2(N) - N, byes go to highest seeds, and byes appear only in round 1
    - **Validates: Requirements 2.3, 5.3, 5.4, 10.3**

  - [x] 2.5 Write property test: First-round pairing order
    - **Property 4: First-round pairing order**
    - Verify non-bye players are paired highest-vs-lowest, second-highest-vs-second-lowest, inward
    - **Validates: Requirements 2.4**

  - [x] 2.6 Implement round resolution and advancement
    - Add `resolveCurrentRound` function that invokes the Match_Resolver for each matchup, advances winners to the next round, increments currentRoundIndex
    - Validate that resolver returns one of the two input IDs (resolution failure handling)
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.5, 5.1_

  - [x] 2.7 Write property test: Winner advancement
    - **Property 5: Winner advancement**
    - Resolve rounds with deterministic resolvers, verify each winner appears in next round and currentRoundIndex increments by 1
    - **Validates: Requirements 3.1, 3.2, 4.2**

  - [x] 2.8 Write property test: Bye players bypass the resolver
    - **Property 7: Bye players bypass the resolver**
    - Inject a counting resolver, verify it is never called for bye players, and bye players appear in round 2
    - **Validates: Requirements 5.1**

  - [x] 2.9 Implement completion detection and placements
    - Add `isComplete` function (checks if only one player remains undefeated)
    - Add `computePlacements` function that derives placement positions from bracket depth (same-round losers share lowest tied position)
    - _Requirements: 3.3, 6.1, 6.4_

  - [x] 2.10 Write property test: Tournament completion
    - **Property 6: Tournament completion**
    - Fully resolve brackets for all player counts 2-10, verify isComplete returns true
    - **Validates: Requirements 3.3**

  - [x] 2.11 Write property test: Resolver output invariant
    - **Property 12: Resolver output invariant**
    - For random player ID pairs, verify randomResolver always returns one of the two inputs
    - **Validates: Requirements 4.4**

- [x] 3. Checkpoint - Bracket_Engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Match_Resolver and Score_Table validation
  - [x] 4.1 Create Match_Resolver module
    - Create `packages/server/src/games/playcaller/MatchResolver.ts` with the `randomResolver` function (Phase 1: uniform random selection)
    - _Requirements: 4.3, 4.4_

  - [x] 4.2 Implement Score_Table validation utility
    - Create a `validateScoreTable` function that validates Score_Table arrays: 2-10 entries, non-negative integers, non-increasing order
    - _Requirements: 6.3_

  - [x] 4.3 Write property test: Score table validation
    - **Property 11: Score table validation**
    - Generate random arrays, verify validation accepts only arrays with 2-10 non-negative integer entries in non-increasing order
    - **Validates: Requirements 6.3**

- [x] 5. Implement PlaycallerPlugin (GamePlugin adapter)
  - [x] 5.1 Create PlaycallerPlugin with registration and state management
    - Create `packages/server/src/games/playcaller/PlaycallerPlugin.ts` implementing the GamePlugin interface
    - Register with gameType "playcaller" in GameRegistry
    - Implement module-level bracket state (get/set/reset)
    - Implement `validatePick` (accept any pick in Phase 1)
    - Set `pickWindowMs` to 3000ms
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1, 11.2, 11.3_

  - [x] 5.2 Implement resolveRound in PlaycallerPlugin
    - Call `resolveCurrentRound` with `randomResolver`
    - Return `PlaycallerRoundResult` with matchup outcomes and completion flag
    - Derive spectator and activeCompetitor lists for state broadcast
    - _Requirements: 3.1, 3.2, 4.1, 7.1, 7.3, 11.2_

  - [x] 5.3 Implement scoreRound in PlaycallerPlugin
    - Return zero deltas for all non-final rounds
    - On tournament completion, compute placements and assign points from Score_Table
    - Handle players whose placement exceeds table length (assign 0 points)
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [x] 5.4 Write property test: Zero deltas before final round
    - **Property 10: Zero deltas before final round**
    - For non-final bracket rounds, verify scoreRound returns empty/zero deltas
    - **Validates: Requirements 6.5**

  - [x] 5.5 Write property test: Scoring correctness
    - **Property 9: Scoring correctness**
    - For completed brackets with various Score_Tables, verify placement-to-points mapping including tied placements and overflow cases
    - **Validates: Requirements 6.1, 6.4, 6.6, 12.1, 12.2**

  - [x] 5.6 Implement computeGameLeaderboard in PlaycallerPlugin
    - During play: rank active competitors above eliminated players
    - After completion: rank by final placement with Score_Table points
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 5.7 Write property test: In-progress leaderboard ordering
    - **Property 13: In-progress leaderboard ordering**
    - For partially-resolved brackets, verify all active competitors rank above all eliminated players
    - **Validates: Requirements 12.3**

  - [x] 5.8 Write property test: Spectator/active player partition
    - **Property 8: Spectator/active player partition**
    - Verify spectators and active competitors are disjoint and their union equals all tournament players
    - **Validates: Requirements 5.2, 7.1, 7.3**

- [x] 6. Checkpoint - Plugin tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate with Room Server
  - [x] 7.1 Wire bracket initialization on game start
    - In `room.ts`, when a Playcaller game starts from LOBBY, build the session leaderboard, extract ranked player IDs, call `generateBracket`, store result in `pluginState`, and set roundCount to totalRounds
    - Handle player count validation (error if fewer than 2)
    - _Requirements: 2.1, 2.2, 3.4, 10.1, 10.2_

  - [x] 7.2 Wire game completion detection
    - After `resolveRound` returns `isComplete: true`, transition room to END_GAME state after the RESULT phase
    - Include PlaycallerGameState (bracket, spectators, activeCompetitors) in STATE_SYNC broadcasts
    - _Requirements: 3.3, 3.5, 7.2_

  - [x] 7.3 Write unit tests for room server integration
    - Test full lifecycle: lobby → bracket → resolve all rounds → END_GAME
    - Test host-gated advancement between bracket rounds
    - Test player count validation error
    - _Requirements: 1.2, 3.3, 3.5, 10.2_

- [x] 8. Checkpoint - Server integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement client components
  - [x] 9.1 Create PlaycallerContainer component
    - Create `packages/client/src/games/playcaller/PlaycallerContainer.tsx`
    - Determine view mode based on player state (active competitor vs spectator vs between-rounds)
    - Register with GameView for gameType "playcaller"
    - _Requirements: 8.1, 8.3_

  - [x] 9.2 Create BracketVisualization component
    - Create `packages/client/src/games/playcaller/BracketVisualization.tsx`
    - Render full bracket diagram showing all rounds, seeds, matchups, winners, and byes
    - Show full-size between rounds (RESULT phase), hidden/collapsed during active play
    - Visually distinguish eliminated players, active competitors, and bye recipients
    - _Requirements: 8.4, 8.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 9.3 Create MatchPanel and SideMatchPanels components
    - Create `packages/client/src/games/playcaller/MatchPanel.tsx` — large center panel for active player's matchup with names, seeds, and resolution animation
    - Create `packages/client/src/games/playcaller/SideMatchPanels.tsx` — compact scoreboard cards for other active matchups
    - _Requirements: 8.1, 8.2_

  - [x] 9.4 Create SpectatorView and RoundHeader components
    - Create `packages/client/src/games/playcaller/SpectatorView.tsx` — equal-size display of all active matchups for spectators
    - Create `packages/client/src/games/playcaller/RoundHeader.tsx` — displays current bracket round name (Quarter-Finals, Semi-Finals, Final)
    - _Requirements: 8.3, 9.1_

  - [x] 9.5 Write client component tests
    - Test PlaycallerContainer renders MatchPanel for active competitor and SpectatorView for eliminated player
    - Test BracketVisualization visibility logic (shown between rounds, hidden during play)
    - Test bye indicators and eliminated player visual distinction in bracket diagram
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 9.3, 9.4_

- [x] 10. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` with Vitest
- Unit tests validate specific examples and edge cases
- The Bracket_Engine is a pure functional module — no side effects, no randomness embedded (randomness injected via resolver/tiebreaker)
- Phase 1 uses random resolution; Phase 2 will replace the Match_Resolver without modifying bracket logic
- All scoring is deferred to tournament completion (zero deltas during intermediate rounds)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.7", "2.8", "2.9"] },
    { "id": 4, "tasks": ["2.10", "2.11", "4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.6"] },
    { "id": 7, "tasks": ["5.4", "5.5", "5.7", "5.8"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 13, "tasks": ["9.5"] }
  ]
}
```
