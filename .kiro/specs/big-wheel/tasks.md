# Implementation Plan: Big Wheel

## Overview

Implement the Big Wheel game plugin — a turn-based, sequential-spin game inspired by The Price Is Right's Showcase Showdown wheel. Players take turns spinning a wheel twice, with all players watching each spin live. The implementation covers: server-side plugin (constants, validation, resolution, scoring, leaderboard), shared types, client-side wheel UI components with animation, and integration into the existing GameView routing and room lifecycle.

## Tasks

- [ ] 1. Define shared types and server constants
  - [ ] 1.1 Add Big Wheel shared types to `packages/shared/src/types.ts`
    - Add `BigWheelPick` interface (`{ type: "spin" }`)
    - Add `BigWheelSpinResult` interface (spinnerPlayerId, spinNumber, reelIndex, value, spinTotal)
    - Add `BigWheelGameState` interface (spinOrder, currentTurnIndex, currentSpinNumber, activeSpinnerId, spinResults, reelStrip)
    - _Requirements: 1.1, 5.3, 11.1, 11.3_

  - [ ] 1.2 Create `packages/server/src/games/big-wheel/constants.ts`
    - Define `BIG_WHEEL` constant object (PICK_WINDOW_MS: 15000, DEFAULT_REEL_STRIP: [5..100 in steps of 5], REEL_STRIP_MIN_LENGTH: 2, REEL_STRIP_MAX_LENGTH: 100, REEL_VALUE_MIN: 1, REEL_VALUE_MAX: 10000, SPINS_PER_TURN: 2)
    - Define `BIG_WHEEL_SETTINGS_SCHEMA` (SettingsSchema array with REEL_STRIP field)
    - _Requirements: 1.4, 2.1, 2.3, 2.4_

- [ ] 2. Implement Big Wheel server plugin core logic
  - [ ] 2.1 Create `packages/server/src/games/big-wheel/BigWheelPlugin.ts` with plugin skeleton
    - Implement `bigWheelPlugin` object satisfying `GamePlugin<BigWheelPick, BigWheelSpinResult>`
    - Set `gameType: "big-wheel"`, attach `settingsSchema` and `pickWindowMs`
    - Implement `validatePick`: return true only for `{ type: "spin" }` objects
    - _Requirements: 1.1, 1.4, 8.1, 8.3, 8.4_

  - [ ]* 2.2 Write property test for pick validation
    - **Property 4: Pick validation**
    - **Validates: Requirements 8.1, 8.3, 8.4**

  - [ ] 2.3 Implement `resolveRound` method in BigWheelPlugin
    - Read `pluginState` to determine active spinner and spin number
    - Select a uniformly random index from the reel strip
    - Return `BigWheelSpinResult` with index, value, spinnerPlayerId, spinNumber, and spinTotal (null for spin 1, computed for spin 2)
    - _Requirements: 4.3, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.4 Write property test for spin result round-trip consistency
    - **Property 1: Spin result round-trip consistency**
    - **Validates: Requirements 4.3, 4.6, 5.1, 5.2, 5.3, 5.4**

  - [ ] 2.5 Implement `scoreRound` method in BigWheelPlugin
    - After spin 1: return `{ deltas: {} }` (no score yet)
    - After spin 2: compute spinTotal = spin1 + spin2, return `{ deltas: { [playerId]: spinTotal } }`
    - _Requirements: 4.5, 6.1, 6.2, 6.3_

  - [ ]* 2.6 Write property test for spin total arithmetic
    - **Property 2: Spin total is the arithmetic sum of two spin values**
    - **Validates: Requirements 4.5, 6.1**

  - [ ]* 2.7 Write property test for score delta equals spin total
    - **Property 8: Score delta equals spin total**
    - **Validates: Requirements 6.2, 6.3**

- [ ] 3. Implement spin order, leaderboard, and disconnection logic
  - [ ] 3.1 Implement spin order determination helper
    - Create a `determineSpinOrder` function that sorts players by session leaderboard rank ascending
    - Break ties randomly (Fisher-Yates shuffle within tied groups)
    - Return ordered array of player IDs
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 Write property test for spin order respects session rank
    - **Property 6: Spin order respects session rank**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ] 3.3 Implement `computeGameLeaderboard` method in BigWheelPlugin
    - Sort connected players by score descending
    - Break ties by session leaderboard rank (lower rank number wins)
    - If still tied (same score and same session rank), randomize
    - Only include connected players
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 3.4 Write property test for leaderboard ordering invariant
    - **Property 5: Leaderboard ordering invariant**
    - **Validates: Requirements 7.1, 7.2, 7.4**

  - [ ] 3.5 Implement reel strip validation helper
    - Validate length is between 2 and 100
    - Validate all values are positive integers in [1, 10000]
    - Return validation result with error message on failure
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 3.6 Write property test for reel strip validation
    - **Property 3: Reel strip validation**
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [ ] 3.7 Implement disconnection handling logic
    - Active spinner disconnect: auto-resolve remaining spins with random reel strip indices
    - Non-active player disconnect: skip their turn, assign score 0
    - Track disconnected players in `pluginState.disconnectedPlayers`
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 3.8 Write property test for disconnected player zero score
    - **Property 7: Disconnected player's skipped turn produces zero score**
    - **Validates: Requirements 12.2, 12.3**

- [ ] 4. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Register plugin and integrate with room lifecycle
  - [ ] 5.1 Register Big Wheel plugin in GameRegistry
    - Add `registry.register(bigWheelPlugin)` at module bottom
    - Add side-effect import `"./games/big-wheel/BigWheelPlugin"` in `room.ts`
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 5.2 Integrate turn-based round lifecycle with room.ts
    - Handle `pluginState` initialization on first round (set spinOrder, currentTurnIndex=0, currentSpinNumber=1, reelStrip from settings)
    - On round start: designate active spinner from spinOrder[currentTurnIndex]
    - After spin 2 resolves: increment currentTurnIndex, reset currentSpinNumber to 1
    - After all players complete: signal game end
    - Enforce active-spinner-only pick acceptance (reject picks from non-active spinners with `NOT_ACTIVE_SPINNER` error)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 8.2, 11.1, 11.2, 11.3_

  - [ ] 5.3 Add Big Wheel to `buildDefaultGameSettings` in room.ts
    - Handle `"big-wheel"` game type for round count (equals player count, determined at game launch)
    - Wire up `BIG_WHEEL.PICK_WINDOW_MS` as default pickWindowMs
    - _Requirements: 1.3, 1.4_

- [ ] 6. Implement client-side Big Wheel UI components
  - [ ] 6.1 Create `packages/client/src/games/big-wheel/BigWheelContainer.tsx`
    - Main container component that reads room state from `useGameStore`
    - Routes to correct sub-components based on phase (PICKING, RESOLVING, RESULT)
    - Determines if current user is active spinner
    - _Requirements: 9.1, 9.4, 10.1_

  - [ ] 6.2 Create wheel visualization components
    - Create `WheelAnimation.tsx`: animated SVG/Canvas wheel with segments colored in alternating carnival palette (red, yellow, green, blue, orange), white bold numeric labels, metallic rim, center hub, and pointer/flapper at top
    - Create `WheelSegment.tsx`: individual wedge slice component
    - Create `WheelPointer.tsx`: fixed triangular flapper/pointer at top
    - Animate spin with realistic deceleration (ease-out cubic, 3-5 seconds), land on resolved segment index
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 6.3 Create spinner interaction components
    - Create `SpinButton.tsx`: "SPIN!" button visible only to active spinner during PICKING, disabled during RESOLVING
    - Create `SpinnerInfo.tsx`: displays active spinner name and spin count ("Spin 1 of 2" / "Spin 2 of 2")
    - Create `SpinResultDisplay.tsx`: shows landed value and running spin total
    - _Requirements: 9.4, 9.5, 10.2_

  - [ ] 6.4 Create spin order queue and leaderboard components
    - Create `SpinOrderQueue.tsx`: shows upcoming spinner order with completed/active/pending indicators
    - Create `BigWheelLeaderboard.tsx`: final rankings display at END_GAME
    - _Requirements: 7.5, 10.3_

- [ ] 7. Wire Big Wheel into GameView routing
  - [ ] 7.1 Add Big Wheel case to `GameView.tsx` switch statement
    - Import `BigWheelContainer` and add `case "big-wheel"` in `renderGameContainer()`
    - _Requirements: 1.2_

  - [ ] 7.2 Add Big Wheel game state parsing in `useGameStore`
    - Parse `BigWheelGameState` from `pluginState` in STATE_SYNC messages
    - Expose activeSpinnerId, spinOrder, currentSpinNumber, spinResults, reelStrip to components
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 8. Checkpoint - Ensure all tests pass and UI renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8.1 Write integration tests for full Big Wheel game flow
  - Test 3-player game: all spin manually, game ends with correct leaderboard
  - Test disconnection mid-turn: remaining spins auto-resolve
  - Test timeout: auto-resolve produces valid result
  - _Requirements: 4.1, 4.6, 7.1, 12.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout, matching the existing codebase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.5"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "3.6"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.2", "3.3", "3.7"] },
    { "id": 4, "tasks": ["2.6", "2.7", "3.4", "3.8"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "7.2"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["8.1"] }
  ]
}
```
