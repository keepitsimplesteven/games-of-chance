# Implementation Plan: Playcaller Server Drive Integration

## Overview

Wire the existing drive engine into PlaycallerPlugin and RoomServer so that when `SKIP_GAMEPLAY` is `false`, bracket rounds use interactive per-down play-calling. Each bracket round becomes a down loop where the PICKING phase repeats per down until all matchup drives complete, then the bracket advances.

## Tasks

- [x] 1. Add shared types and module-level drive state management
  - [x] 1.1 Add `play_selection` to the `ClientMessage` union in `packages/shared/src/types.ts`
    - Add `| { type: "PLAY_SELECTION"; payload: { matchupId: string; play: string } }` to the ClientMessage union
    - _Requirements: 2.3_

  - [x] 1.2 Add module-level drive state and downPicks management to `PlaycallerPlugin.ts`
    - Import `DriveState`, `OffensivePlayId`, `DefensivePlayId` from `./drive`
    - Add module-level `driveStates: Record<string, DriveState> | null = null`
    - Add module-level `downPicks: Record<string, { offense?: OffensivePlayId; defense?: DefensivePlayId }> = {}`
    - Export `getDriveStates`, `setDriveStates`, `resetDriveStates`, `getDownPicks`, `clearDownPicks`
    - Extend the existing `resetPlaycallerState` to also call `resetDriveStates` OR export `resetDriveStates` separately
    - _Requirements: 1.3, 9.2_

  - [x]* 1.3 Write property test for drive state accessors
    - **Property 11: Offense/defense roles are immutable within a drive**
    - **Validates: Requirements 10.3**

- [x] 2. Implement pure drive functions in PlaycallerPlugin
  - [x] 2.1 Implement `initializeDrives` function in `PlaycallerPlugin.ts`
    - Accept a `BracketMatchup[]` parameter
    - For each matchup, randomly assign offense/defense via `Math.random() < 0.5`
    - Call `createDriveState` with the two players and appropriate seed values (higher seed = offense)
    - Store result via `setDriveStates` and return the states Record
    - _Requirements: 1.1, 1.2, 10.1, 10.2_

  - [x]* 2.2 Write property test for `initializeDrives`
    - **Property 1: Drive initialization produces correct structure**
    - **Validates: Requirements 1.1, 1.2, 1.3, 10.1, 10.2**

  - [x] 2.3 Implement `recordPlaySelection` function in `PlaycallerPlugin.ts`
    - Validate player belongs to the matchup, drive is not complete, play matches role
    - Store pick in `downPicks[matchupId]` under `offense` or `defense`
    - Return `{ resolved: true, matchupId }` when both picks present, else `{ resolved: false, matchupId }`
    - Return `{ error: string }` for invalid submissions
    - _Requirements: 2.3, 2.4, 2.5, 9.1_

  - [x]* 2.4 Write property test for `recordPlaySelection`
    - **Property 3: Invalid play selections are rejected**
    - **Validates: Requirements 2.3, 2.4, 2.5, 9.1**

  - [x] 2.5 Implement `resolveMatchupDown` function in `PlaycallerPlugin.ts`
    - Call `resolveDown` from drive engine with the stored picks for the matchup
    - Update `driveStates[matchupId]` in place with the new state
    - Return the updated DriveState
    - _Requirements: 3.1, 3.2_

  - [x]* 2.6 Write property test for `resolveMatchupDown`
    - **Property 4: Both picks trigger resolution with correct state update**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.7 Implement `fillMissingPicks` function in `PlaycallerPlugin.ts`
    - Iterate active (non-complete) drives
    - For any matchup missing offense or defense pick, assign random play via `selectRandomPlay`
    - Preserve already-submitted picks
    - Return array of matchup IDs that were filled
    - _Requirements: 4.1, 4.2_

  - [x]* 2.8 Write property test for `fillMissingPicks`
    - **Property 6: Timeout preserves existing picks and fills missing**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 2.9 Implement `allDrivesComplete` and `getActiveDriveMatchups` helpers in `PlaycallerPlugin.ts`
    - `allDrivesComplete`: return true if all drive states have `isComplete === true`
    - `getActiveDriveMatchups`: return matchup IDs where drive is not complete
    - _Requirements: 3.4, 3.5_

- [x] 3. Checkpoint — Verify pure functions compile and pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Room.ts integration: down loop lifecycle
  - [x] 4.1 Add `PLAY_SELECTION` case to the `onMessage` switch in `room.ts`
    - Parse the message and delegate to a new `handlePlaySelection` private method
    - Import `recordPlaySelection`, `resolveMatchupDown`, `allDrivesComplete`, `clearDownPicks`, `getDriveStates`, `fillMissingPicks`, `initializeDrives`, `getActiveDriveMatchups`, `resetDriveStates` from PlaycallerPlugin
    - _Requirements: 2.3_

  - [x] 4.2 Implement `beginPlaycallerDown` method in `room.ts`
    - Call `clearDownPicks()`
    - Set `this.state.round.phase = "PICKING"`, `pickDeadlineMs = Date.now() + PLAYCALLER.PICK_WINDOW_MS`
    - Call `this.broadcastState()`
    - Call `this.schedulePlaycallerBotPicks()`
    - Call `this.scheduleResolve(PLAYCALLER.PICK_WINDOW_MS)`
    - _Requirements: 2.1, 2.2, 8.4, 9.2_

  - [x] 4.3 Implement `handlePlaySelection` method in `room.ts`
    - Validate sender is a player, phase is PICKING
    - Call `recordPlaySelection(playerId, matchupId, play)`
    - On error "Already picked" → silently ignore; other errors → sendError
    - On success → send PICK_ACK, if `resolved` → call `resolveMatchupDown`, broadcastState
    - If `allDrivesComplete()` → cancel timer, call `advancePlaycallerBracket()`
    - _Requirements: 2.3, 2.4, 2.5, 3.1, 3.2, 9.1_

  - [x] 4.4 Implement `resolvePlaycallerTimeout` method in `room.ts`
    - Guard on phase === "PICKING"
    - Cancel deadline timer
    - Call `fillMissingPicks()` to get matchup IDs
    - Resolve all filled matchups via `resolveMatchupDown`
    - Call `clearDownPicks()`
    - If `allDrivesComplete()` → `advancePlaycallerBracket()`; else → `beginPlaycallerDown()`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.5 Implement `advancePlaycallerBracket` method in `room.ts`
    - Read winners from `getDriveStates()` completions
    - Build a `driveResolver` function that returns pre-determined winners
    - Call `resolveCurrentRound(bracket, driveResolver)` and `setPlaycallerState`
    - Call `resetDriveStates()`
    - Transition to RESULT phase with matchup outcomes in `this.state.round.result`
    - Score tournament if bracket is complete (using existing `scoreRound` logic)
    - Call `this.broadcastState()`
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 5. Checkpoint — Verify room integration compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Bot picks and round flow modifications
  - [x] 6.1 Implement `schedulePlaycallerBotPicks` method in `room.ts`
    - Get bot IDs from `this.botManager.getBotIds()`
    - For each bot in an active matchup, schedule a random-delay timer (300–1000ms)
    - On timer fire: select random play for bot's role, call `recordPlaySelection`
    - If resolved → `resolveMatchupDown`, check `allDrivesComplete`
    - Store timer IDs in `this.botPickTimerIds` for cancellation
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 6.2 Write property test for bot pick validity
    - **Property 7: Bot picks are valid for assigned role**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 6.3 Modify `beginRound` in `room.ts` for playcaller SKIP_GAMEPLAY=false path
    - After existing bracket initialization (roundNumber === 1), add check: if `SKIP_GAMEPLAY === false`, call `initializeDrives(currentRound.matchups)` and `beginPlaycallerDown()`, then return early
    - _Requirements: 1.1, 8.1, 8.3_

  - [x] 6.4 Modify `handleStartRound` in `room.ts` for playcaller next-round advancement
    - When game is playcaller, phase is RESULT, and `SKIP_GAMEPLAY === false`: initialize drives for next bracket round, increment round number, call `beginPlaycallerDown()`, return early
    - _Requirements: 6.3, 8.3_

  - [x] 6.5 Wire `resolvePlaycallerTimeout` into the deadline timer path
    - In `scheduleResolve` or the timer callback, detect playcaller drive mode and call `resolvePlaycallerTimeout()` instead of the standard `resolveRound()`
    - _Requirements: 4.1, 8.1, 8.2_

  - [x] 6.6 Add `"playcaller"` no-op case to `BotManager.generatePicks` for standard bot path
    - Ensure the standard `scheduleBotPicks` path does not crash for playcaller (bots handled via `schedulePlaycallerBotPicks` instead)
    - _Requirements: 5.1_

- [x] 7. Checkpoint — Verify end-to-end flow compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. State broadcasting and integration tests
  - [x] 8.1 Extend `getPublicState` in `room.ts` to include `driveStates` in PlaycallerGameState
    - In the playcaller section of `getPublicState`, add `driveStates: getDriveStates() ?? null` to the `playcallerGameState` object
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 8.2 Write property test for SKIP_GAMEPLAY=true producing null driveStates
    - **Property 2: SKIP_GAMEPLAY=true produces null driveStates**
    - **Validates: Requirements 1.4**

  - [x]* 8.3 Write property test for bracket advancement using drive winners
    - **Property 8: Bracket advancement uses drive completion winners**
    - **Validates: Requirements 6.1**

  - [x]* 8.4 Write property test for down loop phase transitions
    - **Property 5: Down loop phase transitions are correct**
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [x]* 8.5 Write property test for per-down deadline and picks reset
    - **Property 10: Per-down deadline and picks reset between downs**
    - **Validates: Requirements 8.4, 9.2**

- [x] 9. Final wiring and cleanup
  - [x] 9.1 Ensure `resetDriveStates()` is called in `handleEndGame` alongside `resetPlaycallerState()`
    - Add call to `resetDriveStates()` in the existing reset block at end-of-game
    - _Requirements: 8.1_

  - [x] 9.2 Handle STATE_SYNC for mid-drive reconnection
    - Verify that `getPublicState()` already includes current driveStates via the extension in 8.1
    - New clients connecting mid-drive will receive current drive data through existing `onConnect` → `STATE_SYNC` flow
    - _Requirements: 7.3_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The drive engine (`packages/server/src/games/playcaller/drive/`) is already implemented and tested — this plan wires it into the plugin and room lifecycle
- TypeScript is the implementation language (matching the existing codebase)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.9"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "2.7"] },
    { "id": 3, "tasks": ["2.4", "2.6", "2.8"] },
    { "id": 4, "tasks": ["4.1", "6.6"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5"] },
    { "id": 6, "tasks": ["6.1", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["6.2", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 9, "tasks": ["9.1", "9.2"] }
  ]
}
```
