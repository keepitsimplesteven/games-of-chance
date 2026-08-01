# Implementation Plan: Lobby Bot Personas

## Overview

This plan implements server-managed lobby bots that automatically fill empty player slots in a game room. The approach starts with shared types and the core `BotManager` class, then integrates it into the existing `GameRoom` server, adds bot pick generation, wires up client-side rendering, and finishes with the room size control UI. Property-based tests validate the correctness properties defined in the design.

## Tasks

- [x] 1. Define shared types and BotManager core
  - [x] 1.1 Add `UPDATE_ROOM_SIZE` message type and `roomSize` config field to shared types
    - Add `roomSize: number` to the `RoomConfig` interface in `packages/shared/src/types.ts`
    - Add `| { type: "UPDATE_ROOM_SIZE"; payload: { roomSize: number } }` to the `ClientMessage` union
    - _Requirements: 1.2, 1.4_

  - [x] 1.2 Create `BotManager` class with reconcile logic
    - Create `packages/server/src/bots/BotManager.ts`
    - Implement `BotPersona` interface and `BOT_NAMES` constant array (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India)
    - Implement `reconcile(players, roomSize)` that adds/removes bots to maintain the invariant: humans + bots === roomSize
    - Implement `removeLowestBot(players)` to remove the lowest-numbered bot
    - Implement `isBot(playerId)` using the `bot:` prefix check
    - Implement `getBotIds()` to return all active bot IDs
    - Bot IDs follow format `bot:{name_lowercase}` (e.g., `bot:alpha`)
    - Bot display names follow format `[BOT] {Name}` (e.g., `[BOT] Alpha`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2_

  - [x] 1.3 Write property tests for BotManager reconcile logic
    - **Property 1: Room Size Invariant** — For any room size (2–10) and any sequence of join/disconnect/kick operations, humans + bots always equals the configured room size
    - **Validates: Requirements 2.1, 2.4, 4.1, 4.2, 8.1, 8.2**

  - [x] 1.4 Write property tests for bot identity
    - **Property 2: Bot Identity Correctness** — For any bot created, its ID starts with `bot:` and is unique, and its display name starts with `[BOT] `
    - **Validates: Requirements 2.2, 2.3**

  - [x] 1.5 Write property test for slot ordering on human join
    - **Property 3: Slot Ordering on Human Join** — When a human joins a room with bots, the lowest-numbered bot is removed
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Integrate BotManager into GameRoom server
  - [x] 2.1 Add BotManager lifecycle to GameRoom
    - Add `private botManager: BotManager` field to `GameRoom` class in `packages/server/src/room.ts`
    - Initialize `botManager` in `onStart()` method
    - Set default `roomSize: 4` in `createDefaultConfig()`
    - Call `botManager.reconcile()` after `handleJoin()` completes (remove a bot to make room for the human)
    - Call `botManager.reconcile()` after `onClose()` disconnects a player (add a bot to replace the human)
    - Call `botManager.reconcile()` after `handleKickPlayer()` removes a player (add a bot to replace the kicked human)
    - Initialize bot game scores to 0 when bots are added
    - Remove bot scores from gameScores, sessionScores, gameLeaderboard, and sessionLeaderboard when bots are removed
    - _Requirements: 2.1, 3.1, 3.4, 4.1, 4.2, 4.3, 6.4, 8.1, 8.2_

  - [x] 2.2 Add `UPDATE_ROOM_SIZE` message handler
    - Add `case "UPDATE_ROOM_SIZE"` to the `onMessage` switch in `room.ts`
    - Implement `handleUpdateRoomSize(sender, payload)` method
    - Validate sender is host (reject with `NOT_HOST` error)
    - Validate `roomSize` is integer between 2 and 10 (reject with `INVALID_ROOM_SIZE` error)
    - Reject if settings are locked / game in progress (reject with `SETTINGS_LOCKED` error)
    - Reject if new room size < current human player count (reject with `ROOM_SIZE_TOO_SMALL` error)
    - On success: update `state.config.roomSize`, call `botManager.reconcile()`, broadcast state
    - _Requirements: 1.4, 8.3, 8.4_

  - [x] 2.3 Write property test for room size validation
    - **Property 7: Room Size Validation** — The server accepts a room size value if and only if it is an integer in [2, 10]
    - **Validates: Requirements 1.4**

  - [x] 2.4 Write property test for room size change preserving humans
    - **Property 8: Room Size Change Preserves Humans** — For any valid room size change (new size ≥ H humans), all humans remain and only bot count adjusts
    - **Validates: Requirements 8.3**

  - [x] 2.5 Write property test for room size reduction rejection
    - **Property 9: Room Size Reduction Rejection** — Room size values less than the current human count are rejected and state stays unchanged
    - **Validates: Requirements 8.4**

- [x] 3. Checkpoint - Core server integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement bot pick generation
  - [x] 4.1 Add `generatePicks` method to BotManager
    - Implement `generatePicks(gameType, settings)` method in `BotManager`
    - For coin-toss: randomly select "HEADS" or "TAILS" with equal probability
    - For battle-bots: randomly select a valid robot from available templates
    - Return a `Record<string, unknown>` map of botId → pick
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Integrate bot picks into round lifecycle
    - In `beginRound()` in `room.ts`, after transitioning to PICKING phase, schedule bot picks with random delays (500–2000ms per bot)
    - Each bot's pick is written directly to `state.round.picks[botId]`
    - For battle-bots round 1: include bot player IDs in the robot options generation
    - After bot picks are submitted, check if all players (human + bot) have picked to trigger early resolution
    - Ensure bot picks use the same validation logic as human picks (via plugin `validatePick`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.3 Write property test for bot pick validity
    - **Property 4: Bot Picks Are Valid** — For any game type and any bot, the generated pick passes the plugin's `validatePick` function
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 4.4 Write property test for bot scoring equality
    - **Property 5: Bot Scoring Equality** — For any resolved round, bots get score deltas computed by the same `scoreRound` function as humans, and appear in leaderboards
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 4.5 Write property test for bot removal cleaning leaderboards
    - **Property 6: Bot Removal Cleans Leaderboards** — When a bot is removed, its entries are absent from both game and session leaderboards
    - **Validates: Requirements 3.4, 6.4**

  - [x] 4.6 Write property test for replacement bot zero score
    - **Property 11: Replacement Bot Zero Score** — Any bot created to replace a departed human during an active game starts with a score of zero
    - **Validates: Requirements 4.3**

- [x] 5. Checkpoint - Bot picks and scoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement client-side bot rendering
  - [x] 6.1 Update PlayerList component to distinguish bots
    - Modify the PlayerList component (or equivalent player roster UI) in `packages/client/src/components/`
    - Detect bot players by checking if `player.id` starts with `bot:`
    - Render a 🤖 robot icon next to bot player names
    - Sort player list so human players appear above bots
    - Ensure bot score/rank updates render in real time via existing `STATE_SYNC` subscription
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Write property test for player roster ordering
    - **Property 10: Player Roster Ordering** — In any rendered list containing humans and bots, all humans appear before all bots
    - **Validates: Requirements 7.3**

- [x] 7. Implement Room Size Control UI
  - [x] 7.1 Create RoomSizeControl component
    - Create `packages/client/src/components/lobby/RoomSizeControl.tsx`
    - Render a numeric input (or stepper) with min=2, max=10
    - Default value: 4
    - Disable the control when settings are locked (game in progress)
    - On change: send `UPDATE_ROOM_SIZE` message via WebSocket connection
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 7.2 Integrate RoomSizeControl into lobby UI
    - Add the `RoomSizeControl` component to the lobby shell / room creation area
    - Wire up the `onSizeChange` handler to dispatch the `UPDATE_ROOM_SIZE` client message
    - Only show the control to the host player
    - Read current room size from the game store (populated via STATE_SYNC)
    - _Requirements: 1.1, 1.2_

  - [x] 7.3 Write unit tests for RoomSizeControl component
    - Test renders with default value of 4
    - Test min/max bounds (2 and 10)
    - Test disabled state when settings are locked
    - Test change handler emits correct message payload
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 8. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–11)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all code should be TypeScript
- Bot IDs use the `bot:` prefix convention — no changes to the `Player` interface are needed
- Existing test infrastructure (Vitest + fast-check) is reused for property-based tests
- Test file for property tests: `packages/server/src/__tests__/lobbyBotPersonas.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "6.2", "7.1"] },
    { "id": 6, "tasks": ["4.3", "4.4", "4.5", "4.6", "7.2"] },
    { "id": 7, "tasks": ["7.3"] }
  ]
}
```
