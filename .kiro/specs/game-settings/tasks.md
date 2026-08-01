# Implementation Plan: Game Settings

## Overview

Implement a schema-driven game settings system that lets the host configure round count, pick window duration, scoring mode, auto-mode, and per-game tuning constants from the lobby. Settings are declared via a `settingsSchema` on each `GamePlugin`, rendered generically by a `SettingsPanel` component, locked during active game phases, and broadcast to all clients via `STATE_SYNC`.

## Tasks

- [x] 1. Add shared types and message definitions
  - [x] 1.1 Add SettingsFieldSchema, SettingsSchema, and GameSettings interfaces to `packages/shared/src/types.ts`
    - Add `SettingsFieldSchema` interface with key, label, type, defaultValue, and constraints
    - Add `SettingsSchema` type alias (array of `SettingsFieldSchema`)
    - Add `GameSettings` interface with roundCount, pickWindowMs, and tuning record
    - Add `UPDATE_SETTINGS` to the `ClientMessage` union type
    - Extend `RoomState` with `gameSettings: GameSettings` and `settingsLocked: boolean` fields
    - _Requirements: 1.1, 1.2, 10.2_

- [x] 2. Extend GamePlugin interface and update CoinToss plugin
  - [x] 2.1 Add optional `settingsSchema` property to `GamePlugin` interface in `packages/server/src/games/GamePlugin.ts`
    - Add `settingsSchema?: SettingsSchema` property
    - Add `settings: GameSettings` parameter to `resolveRound` and `scoreRound` method signatures
    - Import `SettingsSchema` and `GameSettings` from shared types
    - _Requirements: 1.1, 6.3_

  - [x] 2.2 Declare `COIN_TOSS_SETTINGS_SCHEMA` in `packages/server/src/games/coin-toss/constants.ts`
    - Export the schema array with fields for CORRECT_GUESS_CHIPS, STREAK_MULTIPLIER, and STREAK_THRESHOLD
    - Each field declares key, label, type, defaultValue (from COIN_TOSS constants), and constraints (min, max, step)
    - _Requirements: 1.2, 1.4, 6.1_

  - [x] 2.3 Update `CoinTossPlugin` to implement the new interface
    - Add `settingsSchema: COIN_TOSS_SETTINGS_SCHEMA` property
    - Update `resolveRound` signature to accept `settings: GameSettings` parameter
    - Update `scoreRound` to accept `settings: GameSettings` and use `settings.tuning.CORRECT_GUESS_CHIPS` instead of the hardcoded constant
    - _Requirements: 1.1, 6.3_

- [x] 3. Implement server-side settings management
  - [x] 3.1 Create `packages/server/src/settings/validateSettings.ts` with `validateSettingsUpdate` function
    - Validate `roundCount` is integer in [1, 50]
    - Validate `pickWindowMs` is integer in [3000, 60000]
    - Validate tuning keys against the plugin's settingsSchema constraints
    - Return `{ valid: true, sanitized }` or `{ valid: false, error }` result
    - Ignore unknown tuning keys
    - _Requirements: 2.3, 3.3, 5.4, 11.3_

  - [x] 3.2 Add `gameSettings` and `settingsLocked` fields to `LiveRoomState` in `packages/server/src/room.ts`
    - Initialize `gameSettings` from plugin defaults in `onStart()`
    - Initialize `settingsLocked: false`
    - Add helper function to build default GameSettings from the active plugin
    - _Requirements: 9.1, 10.2_

  - [x] 3.3 Implement `handleUpdateSettings` method in `GameRoom`
    - Authorize sender is host (return `NOT_HOST` error if not)
    - Guard against locked settings (return `SETTINGS_LOCKED` error if locked)
    - Call `validateSettingsUpdate` with current schema
    - Merge sanitized changes into `this.state.gameSettings`
    - Handle scoring mode and auto-mode changes by updating `RoomConfig` accordingly
    - Broadcast updated state via `STATE_SYNC`
    - Add `UPDATE_SETTINGS` case to the `onMessage` switch
    - _Requirements: 2.2, 3.2, 4.2, 5.3, 6.2, 7.3, 8.2, 10.1_

  - [x] 3.4 Integrate settings lock/unlock into the round lifecycle
    - Set `this.state.settingsLocked = true` in `beginRound()`
    - Set `this.state.settingsLocked = false` in `handleEndGame()` and `autoEndGame()`
    - _Requirements: 7.1, 7.4_

  - [x] 3.5 Implement game type change handling for settings
    - When game type changes, reset tuning to new plugin schema defaults
    - Retain shared settings (roundCount) across game type switches
    - Reset pickWindowMs to new plugin's default
    - _Requirements: 9.3_

  - [x] 3.6 Update `beginRound()` to use `gameSettings.pickWindowMs` instead of `plugin.pickWindowMs`
    - Replace the hardcoded `plugin.pickWindowMs` with `this.state.gameSettings.pickWindowMs` for deadline calculation
    - Update `getMaxRounds()` to use `this.state.gameSettings.roundCount`
    - _Requirements: 3.5, 2.4_

  - [x] 3.7 Update `resolveRound()` to pass `gameSettings` to plugin methods
    - Pass `this.state.gameSettings` to `plugin.resolveRound(picks, settings)`
    - Pass `this.state.gameSettings` to `plugin.scoreRound(picks, result, players, settings)`
    - _Requirements: 6.3_

  - [x] 3.8 Update `getPublicState()` to include `gameSettings` and `settingsLocked` in the broadcast payload
    - Add `gameSettings: this.state.gameSettings` to the returned `RoomState`
    - Add `settingsLocked: this.state.settingsLocked` to the returned `RoomState`
    - _Requirements: 10.2, 10.3_

  - [x] 3.9 Write property tests for settings validation and lock behavior
    - **Property 1: Settings update stores valid values** — generate random valid field values within constraints, verify they are stored after UPDATE_SETTINGS
    - **Property 2: Range validation rejects out-of-bounds values** — generate random values outside [min, max] for numeric fields, verify rejection/clamping
    - **Property 5: Settings locked during active game** — for any active phase and any UPDATE_SETTINGS payload, verify rejection with SETTINGS_LOCKED
    - **Property 7: Non-host settings rejection** — for any player role "player", verify NOT_HOST error regardless of phase or payload
    - **Validates: Requirements 2.2, 2.3, 3.2, 3.3, 5.4, 7.1, 7.3, 8.2**

  - [x] 3.10 Write unit tests for `validateSettingsUpdate`
    - Test valid roundCount values are accepted
    - Test out-of-range roundCount is rejected
    - Test valid pickWindowMs values are accepted
    - Test out-of-range pickWindowMs is rejected
    - Test tuning keys validated against schema constraints
    - Test unknown tuning keys are ignored
    - _Requirements: 2.3, 3.3, 11.3_

- [x] 4. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement client-side Zustand store additions
  - [x] 5.1 Add `updateSettings` action to the Zustand store in `packages/client/src/store/useGameStore.ts`
    - Add `updateSettings: (changes: Partial<GameSettings>) => void` to the `GameStore` interface
    - Implement the action to send `UPDATE_SETTINGS` message via socket
    - Import `GameSettings` type from shared
    - _Requirements: 2.2, 3.2, 6.2_

- [x] 6. Implement SchemaField component
  - [x] 6.1 Create `packages/client/src/components/lobby/SchemaField.tsx`
    - Accept props: `field: SettingsFieldSchema`, `value`, `onChange`, `disabled`
    - Render `<input type="number">` with min/max/step for "number" type fields
    - Render toggle switch for "boolean" type fields
    - Render `<select>` dropdown for "select" type fields
    - Clamp number values to valid range on blur (client-side validation)
    - Show inline validation message when value is out of range
    - Use 44px minimum tap targets for mobile accessibility
    - _Requirements: 11.1, 11.3, 11.4, 12.2_

  - [x] 6.2 Write unit tests for SchemaField component
    - Test number input renders with correct min/max/step attributes
    - Test boolean toggle renders and fires onChange
    - Test select dropdown renders options from schema
    - Test disabled state renders read-only controls
    - Test value clamping on out-of-range input
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 7. Implement SettingsPanel component
  - [x] 7.1 Create `packages/client/src/components/lobby/SettingsPanel.tsx`
    - Read `roomState.gameSettings`, `roomState.settingsLocked`, and player role from Zustand store
    - Return null if player is not host (host-only access control)
    - Render shared settings: round count input, pick window duration input (display in seconds, store in ms)
    - Render scoring mode selector (Grand Prix / Chips)
    - Render auto-mode toggle; reveal interval input when auto-mode is enabled
    - Render collapsible "Game Tuning" section using the settingsSchema from the current plugin
    - Use `SchemaField` for each tuning field
    - Display lock indicator and disable all inputs when `settingsLocked` is true
    - Use single-column stacked layout for mobile (320px+ viewports)
    - Call `updateSettings` action on value changes
    - _Requirements: 2.1, 3.1, 4.1, 4.3, 5.1, 5.2, 6.1, 6.4, 7.2, 7.5, 8.1, 8.3, 11.1, 11.2, 12.1, 12.3_

  - [x] 7.2 Write unit tests for SettingsPanel component
    - Test panel renders only for host role
    - Test panel does not render for player role
    - Test locked state shows lock indicator and disables inputs
    - Test scoring mode dropdown shows current value
    - Test auto-mode toggle reveals interval input when enabled
    - Test tuning section is collapsible
    - _Requirements: 7.2, 8.1, 8.3, 5.1, 5.2_

- [x] 8. Integrate SettingsPanel into LobbyShell
  - [x] 8.1 Import and render `SettingsPanel` in `packages/client/src/components/lobby/LobbyShell.tsx`
    - Place SettingsPanel inline in the lobby layout (between GameTileGrid and HostControls)
    - Ensure it's accessible without route navigation
    - Pass the active plugin's settingsSchema to SettingsPanel (via store or registry lookup)
    - _Requirements: 12.3, 11.2_

- [x] 9. Property-based tests for persistence and game type change
  - [x] 9.1 Write property test for settings persistence across games
    - **Property 8: Settings persist across game sessions** — for any valid GameSettings, after END_GAME → START_ROUND without changes, verify same settings are applied
    - **Property 6: Settings unlocked after game end** — after END_GAME, verify UPDATE_SETTINGS from host is accepted
    - **Validates: Requirements 9.1, 9.2, 7.4**

  - [x] 9.2 Write property test for game type change behavior
    - **Property 9: Game type change resets tuning, retains shared** — for any two game types, verify roundCount retained, pickWindowMs reset, tuning reset to new defaults
    - **Validates: Requirements 9.3**

  - [x] 9.3 Write property test for pick window usage at runtime
    - **Property 3: Configured pick window is used at runtime** — for any pickWindowMs in [3000, 60000], verify beginRound sets deadline to now + configured value
    - **Validates: Requirements 3.5**

  - [x] 9.4 Write property test for tuning constants in scoring
    - **Property 4: Configured tuning constants are used in scoring** — for any CORRECT_GUESS_CHIPS in [1, 100], verify scoreRound uses configured value
    - **Validates: Requirements 6.3**

  - [x] 9.5 Write property test for broadcast on change
    - **Property 10: Settings broadcast on every change** — for any valid settings update, verify STATE_SYNC is broadcast containing updated gameSettings
    - **Validates: Requirements 10.1, 10.3**

  - [x] 9.6 Write property test for schema-driven rendering
    - **Property 11: Schema-driven field type rendering** — for any schema with N fields of mixed types, verify exactly N controls rendered with correct types
    - **Property 12: Client-side clamping to valid range** — for any out-of-range numeric input, verify clamping to [min, max]
    - **Validates: Requirements 6.1, 11.1, 11.3, 11.4**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations target the existing monorepo package structure
- Settings validation runs on both server (authoritative) and client (UX optimization)
- The SettingsPanel receives schema data from the shared types; no per-game UI code is needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.5", "3.6", "6.1"] },
    { "id": 4, "tasks": ["3.7", "3.8", "3.9", "3.10", "6.2"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "8.1"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6"] }
  ]
}
```
