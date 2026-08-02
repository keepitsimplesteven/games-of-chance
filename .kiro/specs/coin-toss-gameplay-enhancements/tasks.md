# Implementation Plan: Coin Toss Gameplay Enhancements

## Overview

This implementation plan covers adding gameplay enhancements to the Coin Toss game including: game phase indicators, pick confirmation display, round counters, current player result prominence, a final results screen with podium layout, streak-based multiplier scoring, and streak indicators on the leaderboard. Changes span the shared types package, the PartyKit server (room lifecycle + coin-toss plugin), and the React client (plugin-agnostic game components + coin-toss-specific UI).

## Tasks

- [x] 1. Extend shared types and interfaces
  - [x] 1.1 Add END_GAME to RoundPhase type and extend GameLeaderboardEntry
    - In `packages/shared/src/types.ts`, add `"END_GAME"` to the `RoundPhase` union type
    - Add optional `streak?: number`, `coldStreak?: number`, and `lastMultiplier?: number` fields to `GameLeaderboardEntry`
    - Add the `RETURN_TO_LOBBY` client message type to the message protocol types
    - _Requirements: 5.1, 7.7_

- [x] 2. Implement Streak Engine (server-side)
  - [x] 2.1 Create StreakEngine module with computeStreakScoring function
    - Create `packages/server/src/games/coin-toss/StreakEngine.ts`
    - Define `StreakState` interface with `correctStreaks` and `wrongStreaks` record fields
    - Define `StreakScoringResult` interface with `deltas`, `nextStreakState`, and `appliedMultipliers`
    - Implement `computeStreakScoring(picks, result, currentStreak, basePoints)` with multiplier tiers: 0→1x, 1→2x, 2+→3x
    - Implement `getStreakIndicator(correctStreak, wrongStreak)` utility returning the appropriate emoji string
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.2 Write property test for streak counter tracking
    - **Property 6: Streak Counter Tracking**
    - Test that for any sequence of correct/incorrect outcomes, correctStreak increments on correct and resets on incorrect, and wrongStreak increments on incorrect and resets on correct
    - Use fast-check to generate random sequences of 1–20 outcomes
    - **Validates: Requirements 6.1, 7.1**

  - [x] 2.3 Write property test for multiplier scoring formula
    - **Property 7: Multiplier Scoring Formula**
    - Test that points = basePoints × multiplier (1x/2x/3x) based on prior streak, and 0 points for incorrect guesses
    - Use fast-check with random basePoints (1–100) and streak values (0–20)
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 2.4 Write property test for streak indicator mapping
    - **Property 9: Streak Indicator Mapping**
    - Test that the getStreakIndicator function returns correct emoji for all combinations of correctStreak and wrongStreak with mutual exclusion constraint
    - Use fast-check with random streak values (0–20) ensuring mutual exclusion
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

  - [x] 2.5 Write property test for new game streak reset
    - **Property 8: New Game Streak Reset**
    - Test that when a new game starts, all streak counters initialize to 0 regardless of prior state
    - Use fast-check with random player sets (2–10) with pre-existing streak values
    - **Validates: Requirements 6.7**

- [x] 3. Integrate streak scoring into CoinTossPlugin
  - [x] 3.1 Update CoinTossPlugin to use StreakEngine for scoring
    - Modify `packages/server/src/games/coin-toss/CoinTossPlugin.ts` to store `StreakState` in `pluginState`
    - Call `computeStreakScoring()` during round resolution instead of flat scoring
    - Include `streak`, `coldStreak`, and `lastMultiplier` in each `GameLeaderboardEntry` for the broadcast
    - Reset all streak counters when a new game starts
    - _Requirements: 6.1, 6.5, 6.7, 7.7_

- [x] 4. Implement END_GAME phase in room lifecycle
  - [x] 4.1 Add END_GAME transition and RETURN_TO_LOBBY handler to room.ts
    - Modify `packages/server/src/room.ts` to transition to `END_GAME` instead of `LOBBY` when the last round completes
    - Add handler for `RETURN_TO_LOBBY` message (host-only, valid only during END_GAME)
    - On RETURN_TO_LOBBY: reset phase to LOBBY, clear game scores, reset streak counters
    - Reject RETURN_TO_LOBBY from non-host with `NOT_HOST` error
    - Reject RETURN_TO_LOBBY outside END_GAME with `WRONG_PHASE` error
    - _Requirements: 5.1, 5.6_

  - [x] 4.2 Write property test for last round triggering END_GAME
    - **Property 3: Last Round Triggers END_GAME**
    - Test that for any configured total round count N, when round N's RESULT phase completes, the game transitions to END_GAME
    - Use fast-check with random totalRounds (1–20)
    - **Validates: Requirements 5.1**

  - [x] 4.3 Write property test for return to lobby state reset
    - **Property 5: Return to Lobby Resets State**
    - Test that RETURN_TO_LOBBY transitions to LOBBY with all scores at 0 and all streak counters at 0
    - Use fast-check with random END_GAME states (scores 0–1000, streaks 0–10)
    - **Validates: Requirements 5.6**

- [x] 5. Checkpoint - Server logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement PhaseIndicator component (plugin-agnostic)
  - [x] 6.1 Create PhaseIndicator component in shared game components
    - Create `packages/client/src/components/game/PhaseIndicator.tsx`
    - Render "Pick a Side" with picking-phase styling during PICKING
    - Render "Flipping..." with resolving-phase styling during RESOLVING
    - Render "Results" with result-phase styling during RESULT
    - Render nothing for unrecognized phases (graceful degradation)
    - Integrate into `GameView.tsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7. Implement PickConfirmation component (coin-toss-specific)
  - [x] 7.1 Create PickConfirmation component and update game store
    - Create `packages/client/src/games/coin-toss/PickConfirmation.tsx`
    - Display "You chose Heads" or "You chose Tails" matching the submitted pick
    - Add `currentPick` field to `useGameStore` to store the player's pick value
    - Update `CoinTossContainer.tsx` to show PickConfirmation in place of PickWidget after pick submission
    - Keep PickConfirmation visible during RESOLVING phase alongside coin flip animation
    - Hide PickConfirmation during RESULT phase (replaced by ResultDisplay)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Implement RoundCounter component (coin-toss-specific)
  - [x] 8.1 Create RoundCounter component
    - Create `packages/client/src/games/coin-toss/RoundCounter.tsx`
    - Display "Round X of Y" format with current round and total rounds
    - Position at top of coin-toss game UI above game-specific content
    - Update on new round begin
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 8.2 Write property test for round counter format
    - **Property 1: Round Counter Format**
    - Test that for any valid round number X (1 ≤ X ≤ Y) and total Y (1 ≤ Y ≤ 100), the output matches "Round X of Y"
    - Use fast-check with arbitrary integers constrained to valid ranges
    - **Validates: Requirements 3.1**

- [x] 9. Enhance ResultDisplay with current player prominence
  - [x] 9.1 Update ResultDisplay to highlight current player's result
    - Modify `packages/client/src/games/coin-toss/ResultDisplay.tsx`
    - Render current player's result entry at index 0 (top of list) regardless of server order
    - Apply larger text and bold font weight to current player's entry
    - Add a visual separator between current player and other players
    - Render other players below in smaller text
    - Handle edge case: if current player not in results, render all without prominence
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 9.2 Write property test for current player result ordering
    - **Property 2: Current Player Result Ordering**
    - Test that for any non-empty results list, the current player is always at index 0 and other players' relative order is preserved
    - Use fast-check with arrays of 2–10 player results and random currentPlayerId
    - **Validates: Requirements 4.1**

- [x] 10. Implement FinalResultsScreen with podium layout (plugin-agnostic)
  - [x] 10.1 Create FinalResultsScreen component with podium layout
    - Create `packages/client/src/components/game/FinalResultsScreen.tsx`
    - Show when phase is END_GAME
    - Display top 3 players in podium arrangement: 2nd (left), 1st (center, elevated), 3rd (right)
    - Display remaining players below podium in ranked order
    - Handle fewer than 3 players gracefully (show available without empty spots)
    - Show "Return to Lobby" button visible only to the host
    - Wire button to send `RETURN_TO_LOBBY` message to server
    - Integrate into `GameView.tsx` for END_GAME phase rendering
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 10.2 Write property test for podium layout ordering
    - **Property 4: Podium Layout Ordering**
    - Test that rank 1 is center, rank 2 is left, rank 3 is right, and remaining are in ascending rank order
    - Use fast-check with random leaderboards of 3–10 entries with valid ranks
    - **Validates: Requirements 5.3, 5.4**

- [x] 11. Implement StreakIndicator on leaderboard
  - [x] 11.1 Add StreakIndicator to GameLeaderboard component
    - Modify `packages/client/src/components/game/GameLeaderboard.tsx`
    - Render streak emoji between player name and score based on `streak` and `coldStreak` fields
    - 🔥 for streak=1 (2 consecutive correct), 🔥🔥 for streak≥2 (3+ correct)
    - 🧊 for coldStreak=2 (2 consecutive wrong), 🧊🧊 for coldStreak≥3 (3+ wrong)
    - No indicator when both are ≤1
    - Handle missing streak/coldStreak fields gracefully (backward-compatible)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_

- [x] 12. Checkpoint - Client UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration wiring and final verification
  - [x] 13.1 Wire all components together and verify end-to-end flow
    - Ensure GameView conditionally renders FinalResultsScreen during END_GAME phase
    - Ensure CoinTossContainer integrates PhaseIndicator, RoundCounter, PickConfirmation, and enhanced ResultDisplay
    - Verify state broadcast includes streak data in leaderboard entries
    - Verify phase transitions: PICKING → RESOLVING → RESULT → (last round) END_GAME → LOBBY
    - _Requirements: 1.4, 3.3, 3.4, 5.1, 7.7_

  - [x] 13.2 Write integration tests for full round lifecycle with streaks
    - Test playing 3 rounds with streak scoring, verify multipliers applied correctly
    - Test END_GAME → RETURN_TO_LOBBY → LOBBY full flow with score reset
    - Test streak broadcast: resolve a round and verify gameLeaderboard entries include streak data
    - _Requirements: 5.6, 6.5, 7.7_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
- Plugin-agnostic components go in `packages/client/src/components/game/` and `packages/server/src/room.ts`
- Coin-toss-specific components go in `packages/client/src/games/coin-toss/` and `packages/server/src/games/coin-toss/`
- Testing uses Vitest with fast-check for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "6.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1", "7.1", "8.2"] },
    { "id": 3, "tasks": ["4.1", "9.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "9.2", "10.1", "11.1"] },
    { "id": 5, "tasks": ["10.2", "13.1"] },
    { "id": 6, "tasks": ["13.2"] }
  ]
}
```
