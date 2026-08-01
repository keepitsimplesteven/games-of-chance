# Implementation Plan: Host Control Panel

## Overview

Implement a full-screen host control panel with extensible action registry pattern. The panel provides kick player, reassign host, and adjust score actions through self-registering modules. Server-side handlers follow the existing auth/dispatch pattern in `room.ts`, and all state changes propagate via STATE_SYNC broadcasts.

## Tasks

- [x] 1. Shared types and server-side message handlers
  - [x] 1.1 Add shared types and extend ClientMessage union
    - Add `AdjustmentLogEntry` interface to `packages/shared/src/types.ts`
    - Add `REASSIGN_HOST` and `ADJUST_SCORE` variants to the `ClientMessage` union type
    - Add `adjustmentLog: AdjustmentLogEntry[]` field to the `RoomState` interface
    - _Requirements: 4.4, 4.5, 6.4_

  - [x] 1.2 Implement KICK_PLAYER handler in room.ts
    - Add `case "KICK_PLAYER"` to the `onMessage` switch (currently falls through to default)
    - Implement `handleKickPlayer` private method with host authorization guard
    - Remove player from state, close their WebSocket connection
    - Re-evaluate PICKING phase early resolution when applicable
    - Broadcast STATE_SYNC after successful kick
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 6.1, 6.3_

  - [x] 1.3 Implement REASSIGN_HOST handler in room.ts
    - Add `case "REASSIGN_HOST"` to the `onMessage` switch
    - Implement `handleReassignHost` private method with host authorization guard
    - Validate target exists and is connected, reject with INVALID_TARGET if not
    - Swap roles: target becomes host, sender becomes player
    - Broadcast STATE_SYNC after successful reassignment
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.3, 6.4_

  - [x] 1.4 Implement ADJUST_SCORE handler in room.ts
    - Add `case "ADJUST_SCORE"` to the `onMessage` switch
    - Implement `handleAdjustScore` private method with host authorization guard
    - Apply delta to game or session score, validate delta is integer
    - Append entry to `adjustmentLog` array on server state
    - Rebuild leaderboards after score change
    - Include `adjustmentLog` in `getPublicState()` return value
    - Initialize `adjustmentLog: []` in `onStart()`
    - Broadcast STATE_SYNC after successful adjustment
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.3, 6.4_

  - [x] 1.5 Write property tests for server-side authorization
    - **Property 2: Host-control authorization**
    - Generate random non-host senders and all host-control message types (KICK_PLAYER, REASSIGN_HOST, ADJUST_SCORE); verify server rejects with NOT_HOST error and state is unchanged
    - **Validates: Requirements 2.5, 3.4, 4.6, 6.1, 6.2**

  - [x] 1.6 Write property tests for kick removes player
    - **Property 3: Kick removes player from state**
    - Generate rooms with 2-10 players, random valid kick targets; verify target is removed and player count decreases by 1
    - **Validates: Requirements 2.2**

  - [x] 1.7 Write property tests for kick during PICKING early resolution
    - **Property 5: Kick during PICKING triggers early resolution**
    - Generate rooms in PICKING phase with various pick states; kick a non-picker when all others have picked; verify round transitions to RESOLVING
    - **Validates: Requirements 2.7**

  - [x] 1.8 Write property tests for reassign host
    - **Property 6: Reassign host swaps roles**
    - Generate rooms with various player compositions; verify target becomes host, sender becomes player, exactly one host exists
    - **Validates: Requirements 3.2**

  - [x] 1.9 Write property tests for reassign rejects disconnected target
    - **Property 7: Reassign rejects disconnected target**
    - Generate rooms with disconnected targets; verify INVALID_TARGET error and no role changes
    - **Validates: Requirements 3.5**

  - [x] 1.10 Write property tests for score adjustment delta
    - **Property 8: Score adjustment applies delta correctly**
    - Generate random deltas (-1000 to +1000), all score types, all players; verify score equals previous + delta
    - **Validates: Requirements 4.3**

  - [x] 1.11 Write property tests for adjustment log growth
    - **Property 9: Adjustment log grows monotonically**
    - Generate sequences of ADJUST_SCORE operations; verify log length increases by exactly one per operation with correct entry fields
    - **Validates: Requirements 4.4**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Client-side Action Registry and store additions
  - [x] 3.1 Create ActionRegistry module
    - Create `packages/client/src/host-panel/ActionRegistry.ts`
    - Implement `HostAction` interface with id, label, icon, isAvailable predicate, and component
    - Implement `ActionRegistry` class with register, getAll, get methods
    - Export singleton `actionRegistry` instance
    - Maintain insertion order and enforce unique IDs (duplicate overwrites without duplicating slot)
    - _Requirements: 5.1, 5.4, 5.6_

  - [x] 3.2 Write property tests for Action Registry
    - **Property 10: Action Registry maintains ordered unique entries**
    - Generate random action registration sequences; verify insertion order preserved and duplicate IDs overwrite without duplicating
    - **Validates: Requirements 5.1, 5.4, 5.6**

  - [x] 3.3 Add Zustand store actions for host-control messages
    - Add `kickPlayer(playerId: string)` action to `useGameStore`
    - Add `reassignHost(targetPlayerId: string)` action to `useGameStore`
    - Add `adjustScore(targetPlayerId: string, delta: number, scoreType: "game" | "session", reason?: string)` action to `useGameStore`
    - Each action sends the corresponding `ClientMessage` via `_socketSend`
    - _Requirements: 2.1, 3.1, 4.2_

- [x] 4. HostControlPanel scaffold and LobbyShell integration
  - [x] 4.1 Create HostControlPanel component
    - Create `packages/client/src/host-panel/HostControlPanel.tsx`
    - Implement full-screen overlay with header, close button, and action list
    - Render trigger button (fixed position) only for host role
    - Auto-close panel when role changes from host to player (reactive via Zustand selector)
    - Render actions from `actionRegistry.getAll()`, disable those where `isAvailable` returns false
    - Show action component view when an action is selected, with back navigation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.7, 5.2, 5.3_

  - [x] 4.2 Integrate HostControlPanel into LobbyShell
    - Import and render `<HostControlPanel />` inside `packages/client/src/components/lobby/LobbyShell.tsx`
    - Place it at the bottom of the component tree so it renders as an overlay across all phases
    - _Requirements: 1.1_

  - [x] 4.3 Write property tests for registry-driven rendering
    - **Property 11: Registry-driven rendering**
    - Generate room states and registered actions; verify panel renders exactly those actions whose `isAvailable` predicate returns true
    - **Validates: Requirements 5.2, 5.3, 5.5**

- [x] 5. Self-registering action modules and views
  - [x] 5.1 Create KickPlayer action module and view
    - Create `packages/client/src/host-panel/actions/kickPlayer.ts` (self-registering)
    - Create `packages/client/src/host-panel/actions/icons/KickPlayerIcon.tsx`
    - Create `packages/client/src/host-panel/actions/views/KickPlayerView.tsx`
    - View displays connected non-host players as targets with confirmation dialog
    - Calls `useGameStore.kickPlayer()` on confirm
    - _Requirements: 2.1, 2.6_

  - [x] 5.2 Create ReassignHost action module and view
    - Create `packages/client/src/host-panel/actions/reassignHost.ts` (self-registering)
    - Create `packages/client/src/host-panel/actions/icons/ReassignHostIcon.tsx`
    - Create `packages/client/src/host-panel/actions/views/ReassignHostView.tsx`
    - View displays connected non-host players as targets with confirmation dialog
    - Calls `useGameStore.reassignHost()` on confirm
    - _Requirements: 3.1, 3.6_

  - [x] 5.3 Create AdjustScore action module and view
    - Create `packages/client/src/host-panel/actions/adjustScore.ts` (self-registering)
    - Create `packages/client/src/host-panel/actions/icons/AdjustScoreIcon.tsx`
    - Create `packages/client/src/host-panel/actions/views/AdjustScoreView.tsx`
    - View displays all players as targets, score type picker (game/session), delta input, optional reason, and confirmation dialog showing target name + delta + type
    - Calls `useGameStore.adjustScore()` on confirm
    - _Requirements: 4.1, 4.2, 4.7_

  - [x] 5.4 Import self-registering action modules in HostControlPanel
    - Add side-effect imports for `./actions/kickPlayer`, `./actions/reassignHost`, `./actions/adjustScore` in `HostControlPanel.tsx`
    - Ensures actions are registered when the panel module loads
    - _Requirements: 5.5_

- [x] 6. Score adjustment notification component
  - [x] 6.1 Create ScoreAdjustmentNotification component
    - Create `packages/client/src/host-panel/ScoreAdjustmentNotification.tsx`
    - Displays a toast/banner notification to all players when a score adjustment occurs
    - Reads `adjustmentLog` from `roomState` and detects new entries to display
    - Shows target player name, delta value, and score type
    - Auto-dismisses after a timeout
    - _Requirements: 4.8_

  - [x] 6.2 Integrate notification into LobbyShell
    - Import and render `<ScoreAdjustmentNotification />` in `LobbyShell.tsx`
    - Positioned as an overlay toast visible to all players regardless of role
    - _Requirements: 4.8_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all code should be in TypeScript
- The Action Registry side-effect import pattern mirrors the existing `CoinTossPlugin` registration pattern in the server

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "3.1"] },
    { "id": 2, "tasks": ["1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
