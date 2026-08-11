# Implementation Plan: Leaderboard Standardization

## Overview

Unify the four per-game leaderboard implementations into a shared `BaseLeaderboard` component with a slot-based extension system. Introduces compact variant, session standings popover, risers/fallers indicators, and a redesigned Game Complete Screen. Implementation follows a bottom-up approach: shared types/utilities first, then the base component, then plugin migrations, then server-side rank snapshots, and finally the new screens.

## Tasks

- [ ] 1. Extend shared types and theme system
  - [-] 1.1 Add `preGameRanks` field to `RoomState` in shared types
    - Add `preGameRanks: Record<string, number>` to the `RoomState` interface in `packages/shared/src/types.ts`
    - Ensure it defaults to an empty object in any state initialization
    - _Requirements: 5.7_

  - [-] 1.2 Add rank badge and currentPlayerRing tokens to `ThemeDefinition`
    - Add `currentPlayerRing`, `rankBadge1`, `rankBadge2`, `rankBadge3`, `rankBadgeDefault` fields to the `ThemeDefinition` interface
    - Populate values in each existing theme (retro-casino, etc.)
    - _Requirements: 1.2, 1.4, 1.5, 1.9_

  - [x] 1.3 Create `computeRankChanges` utility
    - Create `packages/client/src/utils/rankChange.ts`
    - Implement the `computeRankChanges(preGameRanks, currentSessionLeaderboard)` function
    - Returns `Record<string, number>` — positive = riser, negative = faller, 0 = unchanged or unknown
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.9_

  - [ ]* 1.4 Write property test for rank change computation (Property 8)
    - **Property 8: Rank change computation correctness**
    - Generator: random `Record<string, number>` for preGameRanks + random `SessionLeaderboardEntry[]` for post-game
    - Assert: result equals `preRank - postRank` for known players, 0 for unknown
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.9**

- [x] 2. Implement BaseLeaderboard component
  - [x] 2.1 Create `BaseLeaderboard` component with core rendering
    - Create `packages/client/src/components/game/BaseLeaderboard.tsx`
    - Accept `entries`, `currentPlayerId`, `variant`, `renderRow`, `renderHeader` props
    - Return `null` when entries is empty
    - Render `<ul>` with `<motion.li layoutId={entry.playerId}>` for each entry
    - Each row: rank badge, player name + "(you)" indicator + streak, row slot, score (right-aligned tabular-nums)
    - Apply theme tokens for card background, text colors, accent colors
    - Apply `currentPlayerRing` theme token ring on matching player row
    - Rank badge styling: rank 1/2/3 use `rankBadge1`/`rankBadge2`/`rankBadge3`, rank 4+ uses `rankBadgeDefault`
    - Entrance animation: opacity 0→1, y 8→0, duration 300ms, easeOut (default variant only)
    - Layout animation: `layout` prop on each li, transition 400ms for rank reordering
    - Truncate player names with ellipsis via CSS `truncate`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13_

  - [x] 2.2 Implement compact variant behavior
    - When `variant="compact"`: reduce padding to py-1, text to text-[11px], badges to h-4 w-4 text-[9px]
    - Suppress row slot content in compact mode even when `renderRow` is provided
    - Skip entrance animation but keep layout animations for rank changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.3 Implement slot rendering (renderRow and renderHeader)
    - Call `renderHeader(entries)` above the list if provided
    - Call `renderRow(entry)` within each row between name area and score column if provided
    - Maintain score column alignment regardless of slot content presence/height
    - Allow row-level slot overflow to wrap below player name without pushing score out of alignment
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.4 Write property test for entry rendering completeness (Property 1)
    - **Property 1: Entry rendering completeness**
    - Generator: `fc.array(arbGameLeaderboardEntry(), { minLength: 1, maxLength: 20 })`
    - Assert: rendered row count === entries.length; each row contains rank, name, score
    - **Validates: Requirements 1.1**

  - [ ]* 2.5 Write property test for current player identification (Property 2)
    - **Property 2: Current player identification**
    - Generator: entries array + `fc.constantFrom(...entries.map(e => e.playerId))`
    - Assert: exactly one row has ring + "(you)", matching currentPlayerId
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.6 Write property test for rank badge tier styling (Property 3)
    - **Property 3: Rank badge tier styling**
    - Generator: entries with rank in range [1, 20]
    - Assert: badge class matches rank tier (1/2/3/default)
    - **Validates: Requirements 1.4, 1.5**

  - [ ]* 2.7 Write property test for slot rendering contract (Property 4)
    - **Property 4: Slot rendering contract**
    - Generator: entries + boolean flags for renderRow/renderHeader presence
    - Assert: slot content present iff prop provided; base fields always present
    - **Validates: Requirements 1.10, 1.11, 2.1, 2.2, 2.3, 2.4**

  - [ ]* 2.8 Write property test for compact variant behavior (Property 5)
    - **Property 5: Compact variant behavior**
    - Generator: entries + renderRow function
    - Assert: compact padding/size classes present, slot content suppressed, base fields present
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement SessionStandingsPopover
  - [x] 4.1 Create `SessionStandingsPopover` component
    - Create `packages/client/src/components/game/SessionStandingsPopover.tsx`
    - Accept `trigger` prop (ReactNode for the toggle button)
    - Render floating panel (absolute/portal positioning) that does not occupy document flow
    - Toggle visibility on trigger click
    - Display session entries sorted by sessionPoints descending, ties broken by humans-before-bots
    - Each entry shows: rank, connection dot (green/gray), bot icon (🤖 for bots), player name, host badge, session score
    - Gate scores behind `useDeferredRevealValue` — show stale values until roundAnimationDone or phase is PICKING/LOBBY/END_GAME
    - Close on outside click — return focus to trigger
    - Close on Escape key — return focus to trigger
    - Internal scroll (`max-h-[70vh] overflow-y-auto`) when content exceeds viewport
    - Default to closed on each phase transition away from LOBBY
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.2 Write property test for session popover entry completeness (Property 6)
    - **Property 6: Session popover entry completeness**
    - Generator: session entries with random connected/bot/host flags
    - Assert: all required fields (rank, connection indicator, bot icon, name, host badge, score) rendered per entry
    - **Validates: Requirements 4.3**

- [x] 5. Implement server-side pre-game rank snapshot
  - [x] 5.1 Add preGameRanks capture in `handleStartRound`
    - In `packages/server/src/room.ts`, when transitioning from LOBBY to PICKING (first round of a new game):
    - Capture each player's current session leaderboard rank into `LiveRoomState.preGameRanks`
    - On first game of session (empty session leaderboard): assign all players rank 1
    - Include `preGameRanks` in the `RoomState` payload sent via STATE_SYNC
    - _Requirements: 5.1, 5.7, 5.8_

  - [ ]* 5.2 Write property test for pre-game snapshot (Property 7)
    - **Property 7: Pre-game snapshot captures current ranks**
    - Generator: random player arrays with session ranks
    - Assert: snapshot contains all players with correct ranks; first-game → all rank 1
    - **Validates: Requirements 5.1, 5.8**

- [x] 6. Implement Game Complete Screen and Congratulations Screen
  - [x] 6.1 Create `GameCompleteScreen` component
    - Create `packages/client/src/components/game/GameCompleteScreen.tsx`
    - Display heading "Game complete!" and subtext "Updated standings"
    - Show session leaderboard as ranked list with: rank, player name, session points, riser/faller indicator
    - Use `computeRankChanges` utility to calculate deltas from `preGameRanks` in room state
    - Riser: green `↑N` indicator; Faller: red `↓N` indicator; Unchanged/first-game: no indicator
    - "Return to Lobby" button — visible only to the host
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.2 Create `CongratulationsScreen` component
    - Create `packages/client/src/components/game/CongratulationsScreen.tsx`
    - Retain existing podium layout from current `FinalResultsScreen` (1st/2nd/3rd place positions)
    - Shown only for the END_TOURNAMENT phase (finale game)
    - _Requirements: 6.5, 6.6_

  - [x] 6.3 Update `GameView` routing logic for END_GAME phase
    - In `packages/client/src/components/game/GameView.tsx`:
    - `phase === "END_GAME"` + `isFinale` (from tournamentProgress) → render `CongratulationsScreen`
    - `phase === "END_GAME"` + NOT finale → render `GameCompleteScreen`
    - `progressionMode === "endless"` → always render `GameCompleteScreen`
    - Remove or deprecate old `FinalResultsScreen` usage for non-finale cases
    - _Requirements: 6.6, 6.7_

  - [ ]* 6.4 Write unit tests for GameCompleteScreen and screen routing
    - Test heading/subtext text content
    - Test host-only button visibility
    - Test routing decision: END_TOURNAMENT → Congratulations, END_GAME → GameComplete, endless → GameComplete
    - _Requirements: 6.1, 6.2, 6.4, 6.6, 6.7_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Migrate plugin leaderboards to BaseLeaderboard
  - [x] 8.1 Migrate CoinTossLeaderboard
    - Refactor `packages/client/src/games/coin-toss/CoinTossLeaderboard.tsx` to wrap `BaseLeaderboard`
    - Provide `renderHeader` with toss sequence row (H/T coin tokens)
    - Provide `renderRow` with per-player pick accuracy tokens (green/red), streak indicators (🔥/🧊), and +delta label
    - Preserve any existing `useDeferredRevealValue` gating
    - _Requirements: 7.1, 7.5, 7.6_

  - [x] 8.2 Migrate BigWheelLeaderboard
    - Refactor `packages/client/src/games/big-wheel/BigWheelLeaderboard.tsx` (or create if using generic GameLeaderboard) to wrap `BaseLeaderboard`
    - Provide `renderRow` with spin result badges (+N), turn-order indicators (▶/◆/✓), and status labels
    - Preserve any existing deferred-reveal gating
    - _Requirements: 7.2, 7.5, 7.6_

  - [x] 8.3 Migrate BattleBotsLeaderboard
    - Refactor `packages/client/src/games/battle-bots/BattleBotsLeaderboard.tsx` (or create wrapper) to use `BaseLeaderboard` without custom slot content
    - _Requirements: 7.3, 7.5_

  - [x] 8.4 Migrate PlaycallerLeaderboard to compact variant
    - In the PlaycallerHeader dropdown, render `BaseLeaderboard` with `variant="compact"` and session entries mapped to `GameLeaderboardEntry` shape
    - _Requirements: 7.4, 7.5_

  - [x] 8.5 Wire SessionStandingsPopover into game layouts
    - Integrate `SessionStandingsPopover` into the appropriate game view components (replacing any inline session leaderboard toggle)
    - Ensure trigger button is accessible and popover is positioned correctly
    - _Requirements: 4.1, 4.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration tasks (8.x) should be verified visually against the original components during development
- TypeScript is used throughout — matching the existing project language

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] }
  ]
}
```
