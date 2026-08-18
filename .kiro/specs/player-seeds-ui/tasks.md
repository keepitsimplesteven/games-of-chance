# Implementation Plan: Player Seeds UI

## Overview

Add a "Set Seeds" host action to the control panel, enabling drag-and-drop seed assignment via framer-motion Reorder. Follows the existing action pattern (side-effect registration, icon component, view component). Server change is a minimal sort at lottery init.

## Tasks

- [x] 1. Create utility functions and icon component
  - [x] 1.1 Create pure utility functions for seed logic
    - Create `packages/client/src/host-panel/actions/utils/seedUtils.ts`
    - Implement `buildSeedsRecord(orderedIds: string[]): Record<string, number>` — maps each ID at position `i` to seed `i + 1`
    - Implement `sortBySeed(playerIds: string[], seeds: Record<string, number>): string[]` — returns a new array sorted ascending by seed value, using `?? Infinity` for missing entries
    - Export both functions for use in the view component and server-side logic
    - _Requirements: 5.1, 7.1_

  - [ ]* 1.2 Write property tests for seedUtils
    - **Property 4: Seed submission produces a complete correct mapping**
    - Test that `buildSeedsRecord` output has exactly N keys matching input, values are 1..N
    - **Property 5: Seed-aware lottery ordering sorts ascending by seed value**
    - Test that `sortBySeed` output is sorted by seed ascending
    - **Property 6: Empty seeds fallback preserves join order**
    - Test that `sortBySeed(ids, {})` returns the same order as input
    - **Validates: Requirements 5.1, 5.3, 7.1, 7.2, 8.1**

  - [x] 1.3 Create SetSeedsIcon component
    - Create `packages/client/src/host-panel/actions/icons/SetSeedsIcon.tsx`
    - Render an SVG numbered-list icon using `h-5 w-5` sizing and `currentColor` stroke (matching existing icon pattern)
    - Use `aria-hidden="true"` on the SVG element
    - _Requirements: 1.1_

- [x] 2. Implement the SetSeedsView component and action registration
  - [x] 2.1 Create SetSeedsView component
    - Create `packages/client/src/host-panel/actions/views/SetSeedsView.tsx`
    - Import `Reorder` from `framer-motion`, `useGameStore` from the store
    - Initialize local state `orderedIds` from `roomState.players.map(p => p.id)`
    - Render `Reorder.Group` (axis="y") with `Reorder.Item` for each player
    - Display seed number badge (`index + 1`) and player name in each item
    - Style with zinc-* dark theme classes: `bg-zinc-800`, `border-zinc-600`, `text-zinc-200`
    - Import and use `buildSeedsRecord` from `../utils/seedUtils`
    - Add "Set Seeds" submit button that calls `_socketSend({ type: "SET_PLAYER_SEEDS", payload: { seeds } })`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [x] 2.2 Create setSeeds action registration module
    - Create `packages/client/src/host-panel/actions/setSeeds.ts`
    - Import `actionRegistry` from `../ActionRegistry`
    - Import `SetSeedsIcon` and `SetSeedsView`
    - Register with id `"set-seeds"`, label `"Set Seeds"`
    - Implement `isAvailable`: return `roomState.round.phase === "LOBBY" && roomState.players.length >= 2`
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [x] 2.3 Add side-effect import to HostControlPanel
    - In `packages/client/src/host-panel/HostControlPanel.tsx`, add `import "./actions/setSeeds"` alongside the existing action imports
    - _Requirements: 1.2_

  - [ ]* 2.4 Write unit tests for isAvailable logic
    - Test returns true when phase is "LOBBY" and players.length >= 2
    - Test returns false when phase is not "LOBBY"
    - Test returns false when players.length < 2
    - **Property 1: isAvailable is true if and only if LOBBY phase with 2+ players**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3. Checkpoint - Verify client builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Server-side lottery init integration
  - [x] 4.1 Edit lottery init block in room.ts
    - In `packages/server/src/room.ts` at the lottery init block (~line 1693), replace `rankedPlayerIds = playerIds` with seed-aware sorting
    - When `Object.keys(this.state.playerSeeds).length > 0`: sort `playerIds` by `playerSeeds[id]` ascending using `?? Infinity` fallback
    - When playerSeeds is empty: keep existing behavior (`rankedPlayerIds = playerIds`)
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_

  - [ ]* 4.2 Write unit tests for server-side seed sorting
    - Test that non-empty seeds produces sorted order (seed 1 first, seed 2 second, etc.)
    - Test that empty seeds preserves original array order
    - Test that missing seed entries sort to the end
    - **Validates: Requirements 7.1, 7.2, 8.1**

- [x] 5. Final checkpoint - Verify full build and integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `SET_PLAYER_SEEDS` message type and server handler already exist — no new message definitions needed
- `framer-motion` is already installed — no dependency additions required
- Use `& .\scripts\run.ps1 "<pnpm-args>" ["<pipe>"]` for typecheck/test commands
- Pure utility functions (`buildSeedsRecord`, `sortBySeed`) are extracted for testability per design
- The server edit is intentionally minimal (3-line conditional sort) to reduce risk

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] }
  ]
}
```
