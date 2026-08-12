# Implementation Plan: Playcaller Coin Toss Ceremony

## Overview

Add a coin toss ceremony to the Playcaller tournament game that occurs between the SPLASH phase and the PICKING phase. The ceremony determines offense/defense assignments through a structured flow: higher-seeded player calls heads/tails, server resolves the flip using shared logic from the coin-toss game, and the winner selects their preferred side. Implementation spans the shared types package, server-side ceremony logic, client-side ceremony UI, and integration with the existing drive/bracket lifecycle.

## Tasks

- [x] 1. Add shared types and utilities
  - [x] 1.1 Create the shared `flipCoin` utility function
    - Create `packages/shared/src/games/coin-toss/flipCoin.ts`
    - Export `RngFunction` type and `flipCoin(rng?)` function that returns "HEADS" when rng() < 0.5, "TAILS" otherwise
    - Re-export from `packages/shared/src/games/coin-toss/types.ts` or a new index file
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 1.2 Add coin toss ceremony shared types
    - Add `SideSelection`, `CeremonyStep`, and `CoinTossCeremonyMatchupState` types to a new file `packages/shared/src/games/coin-toss/ceremonyTypes.ts`
    - Add `"COIN_TOSS"` to the `RoundPhase` type union (locate the existing RoundPhase definition in the shared package)
    - Add `COIN_TOSS_CALL` and `COIN_TOSS_CHOICE` variants to the `ClientMessage` union type
    - Add `ceremonyStates` optional field to the `PlaycallerGameState` interface (or equivalent state broadcast type)
    - Export all new types from the shared package barrel
    - _Requirements: 1.4, 8.1, 8.2, 8.3_

  - [ ]* 1.3 Write property test for `flipCoin` threshold logic
    - **Property 5: Flip Resolution Threshold**
    - Generate RNG values in [0, 1) and verify flipCoin returns "HEADS" when < 0.5, "TAILS" when >= 0.5
    - **Validates: Requirements 3.1, 9.2**

- [x] 2. Implement server-side coin toss ceremony module
  - [x] 2.1 Create ceremony constants
    - Add `COIN_TOSS_CEREMONY` constants object to `packages/server/src/games/playcaller/constants.ts` with: `COIN_CALL_TIMEOUT_MS` (20000), `SIDE_CHOICE_TIMEOUT_MS` (20000), `PHASE_TIMEOUT_MS` (10000), `TRANSITION_DELAY_MS` (500), `BOT_DELAY_MIN_MS` (1500), `BOT_DELAY_MAX_MS` (3500)
    - _Requirements: 1.5, 7.1, 7.3, 10.1, 10.2_

  - [x] 2.2 Implement `coinTossCeremony.ts` core logic
    - Create `packages/server/src/games/playcaller/coinTossCeremony.ts`
    - Implement `createCeremonyStates(matchups)` — initializes per-matchup ceremony state with playerA as Caller
    - Implement `handleCoinCall(state, playerId, side, rng?)` — validates caller, validates side value, resolves flip via shared `flipCoin`, determines Chooser
    - Implement `handleSideChoice(state, playerId, selection)` — validates chooser, validates selection, records offense/defense assignment
    - Implement `autoResolveCoinCall(state, rng?)` — timeout auto-assigns random call and resolves flip
    - Implement `autoResolveSideChoice(state)` — timeout auto-assigns "OFFENSE" to Chooser
    - Implement `allCeremoniesComplete(states)` — returns true when all matchups are COMPLETE
    - Implement `getAssignments(states)` — extracts offense/defense player mapping from completed ceremonies
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 4.5, 4.6, 4.7, 7.2, 7.4, 9.1, 9.4_

  - [ ]* 2.3 Write property tests for ceremony validation logic
    - **Property 1: Coin Call Validation** — generate random strings, verify only "HEADS"/"TAILS" accepted
    - **Property 2: Caller Designation** — generate matchups, verify playerA is always Caller
    - **Property 3: Non-Caller Rejection** — generate non-Caller player IDs, verify rejection with INVALID_CALLER
    - **Property 4: Duplicate Call Rejection** — submit call then re-submit, verify idempotence
    - **Validates: Requirements 2.1, 2.4, 2.5, 2.6, 2.7**

  - [ ]* 2.4 Write property tests for flip resolution and chooser logic
    - **Property 6: Chooser Designation** — generate calls and outcomes, verify correct Chooser assignment
    - **Property 7: Post-Resolution Idempotence** — resolve then re-submit call, verify no state change
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ]* 2.5 Write property tests for side selection logic
    - **Property 8: Side Selection Role Assignment** — generate choices, verify offense/defense mapping
    - **Property 9: Waiter Choice Rejection** — generate non-Chooser attempts, verify rejection
    - **Property 10: Invalid Selection Rejection** — generate invalid strings, verify rejection
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 3. Integrate ceremony into server room handlers
  - [x] 3.1 Modify `initializeDrives` to accept explicit assignments
    - Update `PlaycallerPlugin.ts` `initializeDrives` signature to accept optional `assignments?: Record<string, { offense: string; defense: string }>` parameter
    - When assignments provided, use them to determine seedA/seedB (offense gets seed 2, defense gets seed 1) instead of Math.random()
    - Retain existing random assignment as fallback when no assignments provided
    - _Requirements: 5.1, 5.2_

  - [ ]* 3.2 Write property test for drive initialization with explicit assignments
    - **Property 11: Drive Initialization Respects Explicit Assignments**
    - Generate explicit offense/defense mappings, verify resulting DriveState has correct offensePlayerId/defensePlayerId
    - **Validates: Requirements 5.2**

  - [x] 3.3 Add coin toss ceremony handlers to `roomHandlers.ts`
    - Implement `handleCoinTossCall(ctx, sender, payload)` — validates phase, resolves player ID, delegates to ceremony module, broadcasts state
    - Implement `handleCoinTossChoice(ctx, sender, payload)` — validates phase, resolves player ID, delegates to ceremony module, broadcasts state
    - Implement `beginCoinTossPhase(ctx)` — creates ceremony states for active matchups, transitions phase to COIN_TOSS, starts per-matchup timers, broadcasts STATE_SYNC
    - Implement `resolveCoinTossTimeout(ctx)` — auto-resolves all pending ceremonies on global phase timeout
    - Implement per-matchup timeout handlers for coin call and side choice steps
    - Reject PLAY_SELECTION messages during COIN_TOSS phase with "WRONG_PHASE" error
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 2.4, 2.5, 2.6, 7.1, 7.2, 7.3, 7.4, 7.5, 8.4, 8.5_

  - [x] 3.4 Implement bot support for coin toss ceremony
    - Implement `scheduleCoinTossBotActions(ctx)` in `roomHandlers.ts`
    - When a bot is the Caller: schedule random coin call after random delay (1500–3500ms)
    - When a bot is the Chooser: schedule "OFFENSE" selection after random delay (1500–3500ms)
    - Cancel pending bot timers if timeout fires first
    - Handle bot-vs-bot matchups (both steps automated)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 3.5 Write property tests for timeout and bot behavior
    - **Property 12: Timeout Auto-Assigns Valid CoinSide** — trigger timeouts, verify auto-assigned call is always "HEADS" or "TAILS"
    - **Property 13: Bot Coin Call Validity** — generate bot scenarios, verify bot's coin call is always valid CoinSide
    - **Validates: Requirements 7.2, 10.1**

- [x] 4. Wire ceremony into game lifecycle
  - [x] 4.1 Update phase transition in `beginPlaycallerDown` to route through COIN_TOSS
    - Modify `beginPlaycallerDown` in `roomHandlers.ts`: when this is the first down of a bracket round and SKIP_GAMEPLAY is not true, call `beginCoinTossPhase(ctx)` instead of immediately entering PICKING
    - After all ceremonies complete, call `initializeDrives(matchups, assignments)` with the ceremony results, then transition to PICKING
    - When SKIP_GAMEPLAY is true, skip coin toss and use random assignment as before
    - _Requirements: 1.1, 1.3, 5.1, 5.3_

  - [x] 4.2 Add COIN_TOSS phase to PlaycallerRoomContext state broadcast
    - Ensure `broadcastState()` includes `ceremonyStates` in the game state payload when phase is COIN_TOSS
    - Include deadline timestamps (`coinCallDeadlineMs`, `sideChoiceDeadlineMs`) in the broadcast
    - Clear `ceremonyStates` from broadcast when transitioning out of COIN_TOSS phase
    - _Requirements: 1.6, 7.1, 7.3, 8.3, 8.4_

  - [x] 4.3 Register new message types in the room's message dispatcher
    - Add cases for `COIN_TOSS_CALL` and `COIN_TOSS_CHOICE` in the room's `onMessage` handler, routing to the new handlers
    - Validate that messages reference valid matchupIds
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 5. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement client-side coin toss ceremony UI
  - [x] 6.1 Create `CoinTossCeremony` container component
    - Create `packages/client/src/games/playcaller/CoinTossCeremony.tsx`
    - Renders the appropriate ceremony step based on the player's role (Caller, Chooser, Waiter, Spectator) and current ceremony step from game state
    - Integrate into `PlaycallerContainer.tsx` to render when phase is COIN_TOSS
    - _Requirements: 2.2, 4.1, 6.1_

  - [x] 6.2 Implement coin call UI for the Caller
    - Create a sub-component that presents exactly two options: "HEADS" and "TAILS"
    - On selection, send `COIN_TOSS_CALL` message to server with matchupId and chosen side
    - Disable after submission (prevent duplicate calls client-side)
    - Only render interactive controls for the designated Caller
    - _Requirements: 2.2, 8.1_

  - [x] 6.3 Implement waiting state for non-Caller during coin call step
    - Display a waiting indicator to the lower-seeded player while coin call is pending
    - Show the identity of the Caller to spectators and the Waiter
    - _Requirements: 2.3, 6.5_

  - [x] 6.4 Implement coin flip animation and result display
    - Display coin flip animation synchronized using the `flippedAt` timestamp from the broadcast
    - Show the flip result (outcome) and the Caller's submitted call value
    - Display who won the toss (the Chooser)
    - Render the same animation for all viewers (participants and spectators)
    - _Requirements: 3.2, 6.2_

  - [x] 6.5 Implement side selection UI for the Chooser
    - Create a sub-component that presents exactly two options: "OFFENSE" and "DEFENSE"
    - On selection, send `COIN_TOSS_CHOICE` message to server with matchupId and selection
    - Only render interactive controls for the designated Chooser
    - Display waiting state to the Waiter during this step
    - _Requirements: 4.1, 4.2, 8.2_

  - [x] 6.6 Implement ceremony result display
    - Show the selected side and resulting offense/defense assignments to all players and spectators
    - Display player names/identities for each role assignment
    - _Requirements: 4.3, 6.3_

  - [x] 6.7 Implement spectator experience
    - Spectators see the full ceremony without interactive controls
    - When multiple matchups are active, allow spectators to select which matchup's ceremony to view
    - Display Caller identity during call step and Chooser identity during selection step
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.8 Display countdown timers for coin call and side choice deadlines
    - Read `coinCallDeadlineMs` and `sideChoiceDeadlineMs` from the game state broadcast
    - Display a countdown timer to all clients (similar to existing PlayClock)
    - _Requirements: 7.1, 7.3_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integration wiring and final verification
  - [x] 8.1 Update the existing CoinTossPlugin to use shared `flipCoin` utility
    - Refactor `CoinTossPlugin.resolveRound()` in `packages/server/src/games/coin-toss/` to call the shared `flipCoin` function instead of inline threshold logic
    - Verify the standalone coin-toss game still passes its existing tests
    - _Requirements: 9.2, 9.4_

  - [ ]* 8.2 Write integration tests for full ceremony flow
    - Test complete ceremony: call → flip → choice → drive initialization
    - Test multi-matchup ceremony with staggered completions
    - Test bot-vs-bot matchup completes without client interaction
    - Test SKIP_GAMEPLAY bypass skips ceremony entirely
    - Test global 10s phase timeout resolves all pending ceremonies
    - _Requirements: 1.1, 1.3, 1.5, 5.1, 5.3, 10.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations target `.ts`/`.tsx` files
- The shared `flipCoin` utility must be created before both the ceremony module and the CoinTossPlugin refactor can use it
- Client components follow the existing pattern of the Playcaller game (React components in `packages/client/src/games/playcaller/`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["6.1", "8.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.8"] },
    { "id": 8, "tasks": ["6.5", "6.6", "6.7"] },
    { "id": 9, "tasks": ["8.2"] }
  ]
}
```
