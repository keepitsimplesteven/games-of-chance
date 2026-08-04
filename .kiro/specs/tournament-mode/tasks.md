# Implementation Plan: Tournament Mode

## Overview

Implement a Tournament Mode progression system that adds a "Progression Mode" toggle (Endless/Tournament) orthogonal to the existing Scoring Mode. In Tournament mode, games are played once each in sequence, locked after completion, and build toward a designated finale game that triggers a terminal END_TOURNAMENT celebration state. The implementation covers: shared types, server-side tournament progress tracking with an Unlock Criteria Harness, server guards for game locking, GamePlugin interface extension, client-side UI updates (LandingPage toggle, GameTileGrid tile states, END_TOURNAMENT celebration view), and full integration into the existing room lifecycle.

## Tasks

- [x] 1. Define shared types and extend interfaces
  - [x] 1.1 Add tournament-related shared types to `packages/shared/src/types.ts`
    - Add `ProgressionMode` type (`"endless" | "tournament"`)
    - Add `TournamentTileStatus` type (`"available" | "locked" | "unavailable"`)
    - Add `TournamentProgress` interface (`completedGames: string[]`, `availability: Record<string, TournamentTileStatus>`)
    - Add `progressionMode: ProgressionMode` to the `RoomConfig` interface
    - Add `tournamentProgress?: TournamentProgress | null` to the `RoomState` interface
    - Add `"END_TOURNAMENT"` to the `RoundPhase` union type
    - Add `progressionMode?: ProgressionMode` to the JOIN payload in `ClientMessage`
    - _Requirements: 1.5, 3.1, 7.1, 7.3_

  - [x] 1.2 Extend the `GamePlugin` interface in `packages/server/src/games/GamePlugin.ts`
    - Add optional `isFinale?: boolean` property
    - Add optional `unlockCriteria?: (progress: TournamentProgress) => boolean` method
    - _Requirements: 4.2, 5.1, 8.1_

- [x] 2. Implement the Unlock Criteria Harness
  - [x] 2.1 Create `packages/server/src/tournament/UnlockCriteriaHarness.ts`
    - Implement `evaluateAvailability(progress: TournamentProgress): Record<string, TournamentTileStatus>`
    - Import registry from `GameRegistry`
    - For each registered game: return "locked" if in completedGames, apply finale gate logic for isFinale games, invoke custom `unlockCriteria` if defined, else default to "available" if not completed
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.2, 5.3, 8.1, 8.2_

  - [x]* 2.2 Write property test for unlock criteria harness — custom vs default rules
    - **Property 5: Unlock criteria harness applies custom or default rules**
    - **Validates: Requirements 4.2, 4.5**

  - [x]* 2.3 Write property test for finale availability gate
    - **Property 6: Finale availability equals all non-finale games complete**
    - **Validates: Requirements 5.2, 5.3**

- [x] 3. Implement server-side tournament progress tracking
  - [x] 3.1 Extend `LiveRoomState` in `packages/server/src/room.ts` to include `tournamentProgress: TournamentProgress`
    - Initialize `tournamentProgress` with empty `completedGames` and full availability map when progressionMode is "tournament"
    - Set `tournamentProgress` to null when progressionMode is "endless"
    - _Requirements: 3.1, 7.1_

  - [x] 3.2 Update `handleJoin` in `packages/server/src/room.ts` to accept and store `progressionMode`
    - Read `progressionMode` from the JOIN payload (default to "endless" if not provided)
    - Store it in `state.config.progressionMode`
    - Initialize tournament progress on first join if tournament mode
    - Call `evaluateAvailability` to compute initial tile states
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 3.3 Update `handleEndGame` in `packages/server/src/room.ts` to lock games in tournament mode
    - After existing end-game logic, if progressionMode is "tournament": push current gameType to `completedGames`, call `evaluateAvailability` to refresh availability map
    - Check if the completed game was a finale (`plugin.isFinale`) — if so, set `round.phase = "END_TOURNAMENT"`
    - _Requirements: 3.2, 3.3, 6.1_

  - [x]* 3.4 Write property test for tournament game completion locking
    - **Property 3: Tournament game completion locks the game**
    - **Validates: Requirements 3.1, 3.2**

  - [x]* 3.5 Write property test for finale completion triggering END_TOURNAMENT
    - **Property 7: Finale completion triggers END_TOURNAMENT**
    - **Validates: Requirements 6.1**

- [x] 4. Implement server-side guards and terminal state
  - [x] 4.1 Add tournament guard to `handleGameTypeChange` in `packages/server/src/room.ts`
    - If progressionMode is "tournament", look up the requested game's availability from `tournamentProgress.availability`
    - Reject with `GAME_LOCKED` error if status is "locked"
    - Reject with `GAME_UNAVAILABLE` error if status is "unavailable"
    - _Requirements: 3.3, 4.3_

  - [x] 4.2 Add END_TOURNAMENT guard to `handleStartRound` in `packages/server/src/room.ts`
    - If `round.phase === "END_TOURNAMENT"`, reject with `TOURNAMENT_ENDED` error
    - _Requirements: 6.2, 6.5_

  - [x]* 4.3 Write property test for locked game rejection
    - **Property 4: Locked games are unselectable**
    - **Validates: Requirements 3.3**

  - [x]* 4.4 Write property test for END_TOURNAMENT terminal state
    - **Property 8: END_TOURNAMENT is a terminal state**
    - **Validates: Requirements 6.2, 6.5**

- [x] 5. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Include tournament progress in state sync
  - [x] 6.1 Update `getPublicState()` in `packages/server/src/room.ts` to include `tournamentProgress`
    - When progressionMode is "tournament", include `tournamentProgress` in the STATE_SYNC payload
    - When "endless", omit or send null
    - _Requirements: 7.1, 7.2_

  - [x]* 6.2 Write property tests for endless mode behavior
    - **Property 1: Endless mode imposes no restrictions**
    - **Property 2: Endless mode has no terminal state**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 7. Update client-side LandingPage with Progression Mode toggle
  - [x] 7.1 Add Progression Mode toggle to `packages/client/src/pages/LandingPage.tsx`
    - Add state for `progressionMode` (default "endless")
    - Render a two-button toggle ("♾️ Endless" / "🏆 Tournament") matching the existing Scoring Mode toggle pattern
    - Pass `progressionMode` in the navigation state alongside `scoringMode` and `roomSize`
    - _Requirements: 1.1, 1.4_

  - [x] 7.2 Update room connection logic to send `progressionMode` in the JOIN payload
    - Read `progressionMode` from navigation state in the room page
    - Include it in the JOIN message payload when the host creates the room
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 8. Update GameTileGrid for tournament tile states
  - [x] 8.1 Update `packages/client/src/components/lobby/GameTileGrid.tsx` to render tournament tile states
    - Read `tournamentProgress` from the game store
    - When in tournament mode, use `availability` map to determine each tile's visual state
    - Render "locked" tiles with a lock icon overlay and disabled interaction
    - Render "unavailable" tiles with a dimmed/greyed appearance and "Not Yet" indicator
    - Keep "available" tiles with normal interactive styling
    - _Requirements: 3.4, 4.3, 5.4, 7.2, 7.3_

  - [x] 8.2 Add the finale tile distinct visual treatment
    - Identify the finale game tile and render a special visual indicator (e.g., crown/star icon) when available
    - Show an "Unlock all games first" indicator when unavailable
    - _Requirements: 5.4_

- [x] 9. Implement END_TOURNAMENT celebration view
  - [x] 9.1 Create `packages/client/src/components/lobby/TournamentEndView.tsx`
    - Display the final session leaderboard as definitive tournament results
    - Highlight the tournament winner with celebratory visual treatment (animation/confetti)
    - Render podium-style layout with player names and scores
    - _Requirements: 6.3, 6.4_

  - [x] 9.2 Integrate TournamentEndView into the lobby/game view routing
    - When `round.phase === "END_TOURNAMENT"`, render the TournamentEndView instead of the normal lobby UI
    - Hide game selection UI and start buttons in this state
    - _Requirements: 6.2, 6.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Wire everything together and integration
  - [x] 11.1 Update the game store (`packages/client/src/store/useGameStore.ts`) to expose tournament state
    - Add selectors for `progressionMode` and `tournamentProgress` from `roomState`
    - Ensure STATE_SYNC updates propagate tournament progress to the UI
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Ensure the `createDefaultConfig` function includes `progressionMode: "endless"` as default
    - Update `createDefaultConfig` in `packages/server/src/room.ts`
    - _Requirements: 1.4_

  - [x]* 11.3 Write integration test for full tournament flow
    - Test: create room in tournament mode → play each non-finale game → verify locking → finale unlocks → play finale → verify END_TOURNAMENT state
    - Test: verify scoring mode and progression mode compose independently
    - _Requirements: 1.5, 3.1, 3.2, 5.2, 5.3, 6.1, 6.2_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- The design is plugin-agnostic — no hardcoded game types in tournament logic
- Progression Mode is orthogonal to Scoring Mode; both toggles compose freely

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1", "11.2"] },
    { "id": 6, "tasks": ["7.2", "8.1", "11.1"] },
    { "id": 7, "tasks": ["8.2", "9.1"] },
    { "id": 8, "tasks": ["9.2"] },
    { "id": 9, "tasks": ["11.3"] }
  ]
}
```
