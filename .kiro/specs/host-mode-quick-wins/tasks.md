# Implementation Plan: Host Mode Quick Wins

## Overview

Three targeted improvements implemented incrementally: (1) replace the FAB with a gear icon in the header, (2) add a rename-player host action, and (3) introduce a `playerSeeds` field on RoomState. All changes follow existing patterns — zustand store slices, ActionRegistry side-effect registration, typed ClientMessage handling, host auth checks, and STATE_SYNC broadcasting.

## Tasks

- [x] 1. Shared types: add new ClientMessage variants and playerSeeds field
  - [x] 1.1 Add `RENAME_PLAYER` and `SET_PLAYER_SEEDS` to ClientMessage union
    - Add `| { type: "RENAME_PLAYER"; payload: { playerId: string; newName: string } }` to the ClientMessage type in `packages/shared/src/types.ts`
    - Add `| { type: "SET_PLAYER_SEEDS"; payload: { seeds: Record<string, number> } }` to the ClientMessage type
    - _Requirements: 2.8, 3.4_

  - [x] 1.2 Add `playerSeeds` field to RoomState interface
    - Add `playerSeeds: Record<string, number>` to the RoomState interface in `packages/shared/src/types.ts`
    - Add JSDoc comment noting future intent: manual override of default join-order seeding in Playcaller Lottery mode
    - _Requirements: 3.1, 3.7_

- [x] 2. Server: handle RENAME_PLAYER, SET_PLAYER_SEEDS, and init playerSeeds
  - [x] 2.1 Initialize `playerSeeds` in room state and include in getPublicState
    - Set `playerSeeds: {}` in the initial room state (where other fields are initialized)
    - Include `playerSeeds: this.state.playerSeeds ?? {}` in `getPublicState()` return
    - Add code comment on the handler noting future intent for lottery mode
    - _Requirements: 3.2, 3.3, 3.7_

  - [x] 2.2 Implement `handleRenamePlayer` server handler
    - Add `handleRenamePlayer(sender, payload)` method following the same pattern as `handleKickPlayer`
    - Check sender is host (use existing host auth pattern), send ERROR with code `"NOT_HOST"` if not
    - Validate target player exists, send ERROR with code `"INVALID_TARGET"` if not found
    - Update target player's `name` field and call `this.broadcastState()`
    - Add `case "RENAME_PLAYER"` to the message switch
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 2.3 Implement `handleSetPlayerSeeds` server handler
    - Add `handleSetPlayerSeeds(sender, payload)` method
    - Check sender is host, send ERROR with code `"NOT_HOST"` if not
    - Replace `this.state.playerSeeds` with `payload.seeds` and call `this.broadcastState()`
    - Add code comment noting future intent for lottery seed overrides
    - Add `case "SET_PLAYER_SEEDS"` to the message switch
    - _Requirements: 3.5, 3.6, 3.7_

  - [ ]* 2.4 Write property tests for server handlers
    - **Property 2: Host-only authorization for RENAME_PLAYER**
    - **Property 5: Host-only authorization for SET_PLAYER_SEEDS**
    - **Property 3: RENAME_PLAYER mutates only the target player's name**
    - **Property 6: SET_PLAYER_SEEDS replaces the seeds map**
    - **Property 7: STATE_SYNC always includes playerSeeds**
    - **Validates: Requirements 2.4, 2.5, 2.6, 3.5, 3.6, 3.3**

- [x] 3. Checkpoint - Ensure shared types and server changes compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Client: replace FAB with gear icon trigger
  - [x] 4.1 Add `hostPanelOpen` slice to useGameStore
    - Add `hostPanelOpen: boolean` and `setHostPanelOpen: (open: boolean) => void` to the GameStore interface in `packages/client/src/store/useGameStore.ts`
    - Initialize `hostPanelOpen: false` in the store creation
    - Add `setHostPanelOpen: (open) => set({ hostPanelOpen: open })` action
    - _Requirements: 1.4, 1.5_

  - [x] 4.2 Create `GearIconTrigger` component
    - Create `packages/client/src/components/shared/GearIconTrigger.tsx`
    - Read `role` from store — return `null` if not host
    - On click, call `setHostPanelOpen(true)`
    - Use a 16×16 gear/cog SVG icon matching the style of existing header icons (like StandingsTriggerIcon)
    - Style with `inline-flex items-center justify-center p-1.5 rounded hover:bg-white/10 transition-colors` and theme `mutedText`
    - Add `aria-label="Open Host Controls"`
    - _Requirements: 1.1, 1.3, 1.6_

  - [x] 4.3 Add GearIconTrigger to all LobbyShell header variants
    - Import `GearIconTrigger` in `packages/client/src/components/lobby/LobbyShell.tsx`
    - Add `<GearIconTrigger />` adjacent to `<ConnectionStatus />` in the lobby header `<div className="flex items-center gap-1.5">`
    - Add `<GearIconTrigger />` in the active game header (non-playcaller branch)
    - Add `<GearIconTrigger />` in the `PlaycallerHeader` component
    - _Requirements: 1.2, 1.6_

  - [x] 4.4 Refactor HostControlPanel to use store-driven open state
    - Remove `useState(false)` for `isOpen` and the FAB button rendering from `packages/client/src/host-panel/HostControlPanel.tsx`
    - Read `isOpen` from `useGameStore((s) => s.hostPanelOpen)` and `setHostPanelOpen` from store
    - Auto-close logic: if role !== "host" and isOpen, call `setHostPanelOpen(false)` and return null
    - Close button in overlay calls `setHostPanelOpen(false)` (and resets activeAction)
    - If `!isOpen`, return `null` (no FAB rendered)
    - _Requirements: 1.4, 1.5_

  - [ ]* 4.5 Write unit tests for GearIconTrigger visibility
    - Test that GearIconTrigger renders only when role is "host"
    - Test that clicking triggers `setHostPanelOpen(true)`
    - **Property 1: Rename action availability matches non-host player existence** (verify gear icon visibility is independent of rename action)
    - **Validates: Requirements 1.1, 1.3**

- [x] 5. Client: implement rename-player host action
  - [x] 5.1 Create RenamePlayerIcon component
    - Create `packages/client/src/host-panel/actions/icons/RenamePlayerIcon.tsx`
    - Return a pencil/edit SVG icon matching the style of existing action icons (KickPlayerIcon, etc.)
    - _Requirements: 2.1_

  - [x] 5.2 Create RenamePlayerView component
    - Create `packages/client/src/host-panel/actions/views/RenamePlayerView.tsx`
    - Follow the same structure as `KickPlayerView` — list targets, select one, show input, submit
    - Filter targets: all players where `p.id !== playerId && p.role !== "host"` (include disconnected players)
    - Show text input for new name, submit button
    - On submit, call `send({ type: "RENAME_PLAYER", payload: { playerId: selectedTarget, newName: newName.trim() } })`
    - Show confirmation state after sending
    - _Requirements: 2.2, 2.3, 2.7_

  - [x] 5.3 Register rename-player action in ActionRegistry
    - Create `packages/client/src/host-panel/actions/renamePlayer.ts`
    - Import `actionRegistry`, `RenamePlayerIcon`, `RenamePlayerView`
    - Register with id `"rename-player"`, label `"Rename Player"`
    - `isAvailable`: return `true` when `roomState.players.some(p => p.id !== currentPlayerId && p.role !== "host")`
    - _Requirements: 2.1, 2.7_

  - [x] 5.4 Add side-effect import in HostControlPanel
    - Add `import "./actions/renamePlayer"` in `packages/client/src/host-panel/HostControlPanel.tsx` alongside existing action imports
    - _Requirements: 2.1_

  - [ ]* 5.5 Write property tests for rename action availability
    - **Property 1: Rename action availability matches non-host player existence**
    - **Property 4: Rename player list excludes the host**
    - **Validates: Requirements 2.2, 2.7**

- [x] 6. Final checkpoint - Ensure all code compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design
- The `playerSeeds` field is scaffolded only (no UI for setting seeds in this iteration per Requirement 3.8)
- Follow existing patterns exactly: side-effect action registration, typed ClientMessage handling, host auth checks, broadcastState

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "4.1"] },
    { "id": 2, "tasks": ["2.4", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["4.5", "5.2"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["5.4", "5.5"] }
  ]
}
```
