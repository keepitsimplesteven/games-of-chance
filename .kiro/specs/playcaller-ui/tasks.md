# Implementation Plan: Playcaller UI

## Overview

Build the Phase 2 client-side interactive drive experience for the Playcaller football game. The implementation extends the existing `PlaycallerContainer.tsx` with new components for field visualization, play selection cards with SVG art, ball animation, and spectator views. All pure utility functions are built and tested first, then composed into the React component tree.

## Tasks

- [ ] 1. Define shared types and pure utility functions
  - [ ] 1.1 Create play-names type definitions and classify function
    - Create `packages/client/src/games/playcaller/play-names/types.ts` with `Circumstance`, `PlayNameEntry`, `PlayNamePool`, `PlayNameMap` types
    - Create `packages/client/src/games/playcaller/play-names/classify.ts` with the `classifyCircumstance(down, yardsToGo)` pure function
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ]* 1.2 Write property test for classifyCircumstance
    - **Property 5: Circumstance classification is exhaustive and deterministic**
    - Test that for any valid down (1–4) and positive yardsToGo: returns "short_yardage" when yardsToGo ≤ 3, "desperation" when down === 4 and yardsToGo > 5, "standard" otherwise
    - Create test file at `packages/client/src/games/playcaller/play-names/__tests__/classify.property.test.ts`
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

  - [ ] 1.3 Create animation types and timing utilities
    - Create `packages/client/src/games/playcaller/animations/types.ts` with `BallAnimationType`, `BallAnimationConfig`, `DramaLevel` types
    - Create `packages/client/src/games/playcaller/animations/timing.ts` with `getDramaLevel`, `getAnimationDuration`, and `getBallAnimationType` pure functions
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 1.4 Write property test for animation variant selection
    - **Property 3: Animation variant selection is determined by play outcome and axis**
    - Test that getBallAnimationType returns "turnover" for interception/fumble, "pass" for non-turnover pass axis, "run" for non-turnover run axis; getAnimationDuration always returns a positive number
    - Create test file at `packages/client/src/games/playcaller/animations/__tests__/timing.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ] 1.5 Create field utility functions
    - Create `packages/client/src/games/playcaller/field-utils.ts` with `yardLineToY`, `formatDownDistance`, `getRoundName`, `formatPlayResult`, and `computeDriveSummary` pure functions
    - _Requirements: 2.2, 2.4, 10.1, 7.1, 11.3_

  - [ ]* 1.6 Write property tests for field utility functions
    - **Property 1: Ball position maps yard line to Y coordinate**
    - **Property 2: Down/distance formatting produces correct ordinal text**
    - **Property 12: Round name derivation is correct for all bracket sizes**
    - **Property 13: Drive summary computes correct totals from play history**
    - Create test file at `packages/client/src/games/playcaller/__tests__/field-utils.property.test.ts`
    - **Validates: Requirements 2.2, 2.4, 10.1, 11.3**

  - [ ]* 1.7 Write property test for play result formatting
    - **Property 7: Play result formatting includes play name and outcome**
    - Test that formatPlayResult always returns a non-empty string containing a recognizable outcome descriptor
    - Add to `packages/client/src/games/playcaller/__tests__/field-utils.property.test.ts`
    - **Validates: Requirements 7.1**

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Build play name pools and play art data
  - [ ] 3.1 Create offense and defense play name pools
    - Create `packages/client/src/games/playcaller/play-names/offense-names.ts` with play name entries for all 4 offensive plays × 3 circumstances
    - Create `packages/client/src/games/playcaller/play-names/defense-names.ts` with play name entries for all 4 defensive plays × 3 circumstances
    - Export a combined `getPlayName(playId, circumstance, role)` lookup function
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ] 3.2 Create play art type definitions
    - Create `packages/client/src/games/playcaller/play-art/types.ts` with `Point`, `RouteSegment`, `PlayerMarker`, `CoverageZone`, `PlayArtData`, `PlayArtVariants` interfaces
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 3.3 Create offensive play art SVG data (4 plays × 3 circumstances)
    - Create `packages/client/src/games/playcaller/play-art/offense.ts` with play art data for Inside Run, Outside Run, Short Pass, Deep Pass across standard/short_yardage/desperation
    - Each variant defines formation markers and route arrows appropriate to the situation
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7_

  - [ ] 3.4 Create defensive play art SVG data (4 plays × 3 circumstances)
    - Create `packages/client/src/games/playcaller/play-art/defense.ts` with play art data for Run Contain, Blitz, Zone Coverage, Man Press across standard/short_yardage/desperation
    - Each variant defines formation markers, coverage zones or blitz arrows
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 3.5 Create PlayArtSvg renderer component
    - Create `packages/client/src/games/playcaller/play-art/PlayArtSvg.tsx` that accepts `PlayArtData` and renders an inline SVG with line of scrimmage, player markers (circles/squares), route paths with arrow markers, and coverage zones
    - Use theme tokens for all colors via the `useTheme` hook
    - _Requirements: 5.1, 5.2, 5.3, 13.1_

- [ ] 4. Build hooks for state derivation
  - [ ] 4.1 Create useDriveState hook
    - Create `packages/client/src/games/playcaller/hooks/useDriveState.ts` that reads `DriveState` from `useGameStore` for a given matchupId
    - Returns `DriveState | null`
    - _Requirements: 14.1, 14.2_

  - [ ] 4.2 Create useCircumstance hook
    - Create `packages/client/src/games/playcaller/hooks/useCircumstance.ts` that derives the current `Circumstance` from `DriveState.down` and `DriveState.yardsToGo` using `classifyCircumstance`
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ] 4.3 Create usePlayCards hook
    - Create `packages/client/src/games/playcaller/hooks/usePlayCards.ts` that combines play art data + play names + current circumstance to produce an array of 4 card data objects for the active player's role (offense or defense)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.4_

  - [ ]* 4.4 Write property test for play set correctness
    - **Property 4: Play set correctness by player role**
    - Test that usePlayCards returns exactly 4 offensive play IDs when the player is on offense, and exactly 4 defensive play IDs when on defense
    - Create test file at `packages/client/src/games/playcaller/hooks/__tests__/usePlayCards.property.test.ts`
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 5. Build Framer Motion animation variants
  - [ ] 5.1 Create animation variant definitions
    - Create `packages/client/src/games/playcaller/animations/variants.ts` with Framer Motion variant objects: `ballVariants` (idle, run, pass, turnover, touchdown), `playCardVariants` (idle, selected, unselected, disabled), `historyDrawerVariants` (collapsed, expanded)
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 6.2, 7.6, 12.1, 12.3_

- [ ] 6. Build core UI components
  - [ ] 6.1 Create BallMarker component
    - Create `packages/client/src/games/playcaller/BallMarker.tsx` as a Framer Motion `motion.g` element using `ballVariants` and accepting `BallAnimationConfig`
    - Animates between positions based on play outcome
    - _Requirements: 2.3, 3.1, 3.2, 3.4, 3.5, 12.1_

  - [ ] 6.2 Create FieldPanel component
    - Create `packages/client/src/games/playcaller/FieldPanel.tsx` — a 125px-wide vertical SVG field with yard markers at 10-yard intervals, end zone at top, current ball position via BallMarker, and down/distance text
    - Port reference SVG code from `FieldComp.tsx` demo page
    - Use `yardLineToY` for ball positioning, theme tokens for colors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 13.1_

  - [ ] 6.3 Create MiniScoreboard component
    - Create `packages/client/src/games/playcaller/MiniScoreboard.tsx` displaying down number, yards-to-go, yard line, and offense/defense player names
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 6.4 Create PlayCard component
    - Create `packages/client/src/games/playcaller/PlayCard.tsx` with tappable card showing PlayArtSvg, play name, formation label; uses `playCardVariants` for selection feedback
    - _Requirements: 4.2, 4.3, 4.4, 6.1, 6.2, 12.3, 13.3_

  - [ ] 6.5 Create PlayCardGrid component
    - Create `packages/client/src/games/playcaller/PlayCardGrid.tsx` rendering 4 PlayCards in a 2×2 grid, managing selection state and lock-in logic
    - On tap: calls `submitPick`, sets `pickSubmitted`, disables further taps
    - _Requirements: 4.1, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 14.3_

  - [ ]* 6.6 Write property test for lock-in disabling
    - **Property 6: Lock-in disables further play selection**
    - Test that when pickSubmitted is true, all 4 play cards are in disabled state
    - Create test file at `packages/client/src/games/playcaller/__tests__/PlayCardGrid.property.test.ts`
    - **Validates: Requirements 6.3**

  - [ ] 6.7 Create PlayResultLine component
    - Create `packages/client/src/games/playcaller/PlayResultLine.tsx` showing the formatted last play result with a tappable history toggle indicator, using AnimatePresence for transitions
    - _Requirements: 7.1, 7.2, 7.3, 12.2_

  - [ ] 6.8 Create HistoryDrawer component
    - Create `packages/client/src/games/playcaller/HistoryDrawer.tsx` with expandable/collapsible list of all play results using `historyDrawerVariants`
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ]* 6.9 Write property test for history drawer ordering
    - **Property 8: History drawer shows all play history entries in order**
    - Test that given N play history entries, the drawer renders exactly N entries in chronological order
    - Create test file at `packages/client/src/games/playcaller/__tests__/HistoryDrawer.property.test.ts`
    - **Validates: Requirements 7.4**

  - [ ] 6.10 Create DriveCompletionOverlay component
    - Create `packages/client/src/games/playcaller/DriveCompletionOverlay.tsx` showing touchdown celebration or turnover indicator, drive summary stats, and signaling `roundAnimationDone` after animation completes
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Build composed views and integrate
  - [ ] 8.1 Create DriveView layout component
    - Create `packages/client/src/games/playcaller/DriveView.tsx` composing RoundHeader, FieldPanel + MiniScoreboard (row), PlayResultLine, and PlayCardGrid in a mobile-first layout constrained to 470px max viewport height
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 8.2 Create SpectatorGrid component
    - Create `packages/client/src/games/playcaller/SpectatorGrid.tsx` rendering a card per active matchup with player names and drive progress, tappable to view a specific matchup
    - _Requirements: 9.1, 9.5_

  - [ ]* 8.3 Write property test for spectator grid card count
    - **Property 10: Spectator grid renders one card per active matchup**
    - Test that for N active matchups, exactly N cards are rendered
    - Create test file at `packages/client/src/games/playcaller/__tests__/SpectatorGrid.property.test.ts`
    - **Validates: Requirements 9.1**

  - [ ] 8.4 Create SpectatorDriveView component
    - Create `packages/client/src/games/playcaller/SpectatorDriveView.tsx` — read-only drive view with FieldPanel, MiniScoreboard, PlayResultLine, HistoryDrawer, and a back button; no PlayCardGrid rendered
    - _Requirements: 9.2, 9.3, 9.4_

  - [ ]* 8.5 Write property test for spectator play card absence
    - **Property 11: Spectators cannot see or interact with play cards**
    - Test that the SpectatorDriveView renders zero play card elements
    - Create test file at `packages/client/src/games/playcaller/__tests__/SpectatorDriveView.property.test.ts`
    - **Validates: Requirements 9.3**

  - [ ] 8.6 Extend PlaycallerContainer with Phase 2 drive routing
    - Modify `packages/client/src/games/playcaller/PlaycallerContainer.tsx` to check for `driveStates` in the game state:
      - If `driveStates` exists and player is active competitor → render `DriveView`
      - If `driveStates` exists and player is spectator → render `SpectatorGrid` / `SpectatorDriveView`
      - If no `driveStates` → keep existing Phase 1 bracket fallback behavior
    - _Requirements: 14.1, 14.2, 14.4_

  - [ ] 8.7 Extend PlaycallerGameState shared type to include driveStates
    - Add optional `driveStates?: Record<string, DriveState> | null` field to `PlaycallerGameState` in `packages/shared/src/types.ts`
    - Re-export `DriveState` related types from shared package for client consumption
    - _Requirements: 14.1, 14.2_

  - [ ]* 8.8 Write property test for scoreboard state reflection
    - **Property 9: Scoreboard reflects current drive state**
    - Test that MiniScoreboard displays values matching driveState.down, driveState.yardsToGo, and driveState.yardLine
    - Create test file at `packages/client/src/games/playcaller/__tests__/MiniScoreboard.property.test.ts`
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All components use the existing theme system (`useTheme` hook) — no hardcoded colors
- The existing Phase 1 bracket code (BracketVisualization, MatchPanel, SideMatchPanels) is preserved as fallback
- Server-side drive integration is a separate spec — this spec is CLIENT-SIDE ONLY
- Play art SVG data needs 24 total definitions (4 offense × 3 + 4 defense × 3 circumstances)
- Mobile viewport constraint: entire gameplay layout must fit without scroll at 390×844px (max 470px height)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5", "3.2"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6", "1.7", "3.1", "3.3", "3.4"] },
    { "id": 2, "tasks": ["3.5", "4.1", "4.2", "5.1"] },
    { "id": 3, "tasks": ["4.3", "6.1"] },
    { "id": 4, "tasks": ["4.4", "6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "6.7", "6.8", "6.10"] },
    { "id": 6, "tasks": ["6.6", "6.9", "8.7"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.4"] },
    { "id": 8, "tasks": ["8.3", "8.5", "8.6", "8.8"] }
  ]
}
```
