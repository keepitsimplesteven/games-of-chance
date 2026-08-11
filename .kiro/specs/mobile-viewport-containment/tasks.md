# Implementation Plan: Mobile Viewport Containment

## Overview

This plan implements a systematic viewport containment layer across the games-of-chance platform. The approach creates a reusable `ViewportContainer` component using `100svh` + CSS `env(safe-area-inset-*)`, validates it via a standalone test harness route, then migrates all game plugins to use it. Overlays, host controls, typography, and large-screen capping are refined as final steps.

## Tasks

- [x] 1. Foundation: ViewportContainer component and meta tag
  - [x] 1.1 Update `index.html` meta viewport tag to include `viewport-fit=cover`
    - Modify the existing viewport meta tag to add `viewport-fit=cover`
    - This enables `env(safe-area-inset-*)` values on notched devices
    - _Requirements: 1.4_

  - [x] 1.2 Create CSS custom properties on `:root` for safe area insets and viewport caps
    - Add `--safe-area-top`, `--safe-area-bottom`, `--safe-area-left`, `--safe-area-right` using `env()` with `0px` fallback
    - Add `--viewport-max-w: 1024px` and `--viewport-max-h: 1366px`
    - _Requirements: 1.3, 9.2_

  - [x] 1.3 Create `ViewportContainer` component at `packages/client/src/components/layout/ViewportContainer.tsx`
    - Implement `ViewportContainerProps` interface with `children`, `className`, and `gridRows` props
    - Apply CSS: `height: 100vh` then `height: 100svh` then `height: min(100svh, 1366px)` for progressive enhancement
    - Apply `width: 100vw` then `width: min(100vw, 1024px)`
    - Apply `overflow: hidden`, `overscroll-behavior: none`
    - Apply safe area padding with `env()` fallbacks to `0px`
    - Set up CSS Grid with configurable `grid-template-rows` (default: `auto 1fr auto`)
    - Center with `margin: 0 auto` and absolute positioning on large screens
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2_

  - [x] 1.4 Create viewport constants file at `packages/client/src/components/layout/viewport-constants.ts`
    - Export `VIEWPORT_MAX_WIDTH`, `VIEWPORT_MAX_HEIGHT`, `MIN_VIEWPORT_HEIGHT`, `OVERLAY_MAX_HEIGHT_PERCENT`, `OVERLAY_EDGE_CLEARANCE`, `DIAGNOSTIC_UPDATE_MS`
    - Export `GAME_GRID_CONFIGS` record for per-game grid row configurations
    - _Requirements: 3.5, 3.6, 5.1, 8.1_

  - [ ]* 1.5 Write property test: CSS fallback ordering (Property 8)
    - **Property 8: CSS fallback ordering**
    - Verify that for any rendered ViewportContainer, the `100vh` fallback is declared before `100svh` in source order
    - **Validates: Requirements 9.1**

  - [ ]* 1.6 Write property test: Overflow mode determined by viewport height threshold (Property 3)
    - **Property 3: Overflow mode determined by viewport height threshold**
    - For any positive integer viewport height, verify overflow is `auto` when height < 600px and `hidden` when height >= 600px
    - **Validates: Requirements 3.6**

- [x] 2. Test Harness: `/viewport-test` route
  - [x] 2.1 Create `ViewportTestPage` component at `packages/client/src/pages/ViewportTestPage.tsx`
    - Wrap content in `ViewportContainer`
    - Render CSS Grid with at least 3 rows: header, content area, card grid (4 placeholder cards)
    - Add visible boundary indicators (borders) at safe area edges and container boundary
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Add diagnostic overlay to `ViewportTestPage`
    - Display computed viewport height (px), each safe area inset value (px), and scroll-detected boolean
    - Use `ResizeObserver` + event listeners to update within 200ms of resize/orientation change
    - Show red visual warning if `scrollHeight > clientHeight` (containment violation)
    - _Requirements: 2.5, 2.6_

  - [x] 2.3 Register `/viewport-test` route in `App.tsx`
    - Add route entry for `ViewportTestPage` at `/viewport-test`
    - No room connection or game state required
    - _Requirements: 2.1_

  - [ ]* 2.4 Write property test: Containment violation detection (Property 1)
    - **Property 1: Containment violation detection**
    - For any pair (scrollHeight, clientHeight), violation detector returns `true` iff scrollHeight > clientHeight
    - **Validates: Requirements 2.6**

- [x] 3. Checkpoint - Validate foundation and test harness on device
  - STOP and wait for user confirmation. The `/viewport-test` page is now live — user should view it on a real mobile device to confirm containment behavior before proceeding to game plugin migration.

- [x] 3A. Fix ViewportContainer large-screen centering
  - [x] 3A.1 Fix vertical centering when viewport exceeds max bounds
    - The current `position: absolute` + `top: 50%; left: 50%; transform: translate(-50%, -50%)` in the large-screen media query fails because the parent has no explicit height context
    - Change to `position: fixed` in the media query so the container references the viewport directly, OR use a flexbox/grid centering approach on the body/root
    - Verify the container is visually centered both horizontally AND vertically when viewport exceeds 1024px wide or 1366px tall
    - On smaller viewports (below max bounds), the container should fill available space without centering offsets
    - _Requirements: 8.2, 8.4_

- [x] 3B. Landscape orientation interstitial
  - [x] 3B.1 Create `LandscapeInterstitial` component at `packages/client/src/components/layout/LandscapeInterstitial.tsx`
    - Render a full-screen fixed overlay with a rotate-phone icon and "Please rotate to portrait" message
    - Show ONLY when device is in landscape orientation AND viewport height < 480px (too short for game UI)
    - Use `window.matchMedia('(orientation: landscape)')` and a height check
    - Style: dark background matching platform theme, centered content, subtle animation on the rotate icon
    - The game state is preserved underneath — no unmounting of game content
    - _Requirements: 3.6_

  - [x] 3B.2 Integrate `LandscapeInterstitial` into `ViewportContainer`
    - Render `LandscapeInterstitial` inside `ViewportContainer` so it covers the game content when in landscape + short viewport
    - Should NOT appear in the lobby (only during active game phases)
    - Should NOT appear on tablets/desktops in landscape (only when height is genuinely too short)
    - _Requirements: 3.6_

- [x] 4. Game Plugin Migration: LobbyShell layout switching
  - [x] 4.1 Refactor `LobbyShell` to wrap ALL active games in `ViewportContainer`
    - Replace the current playcaller-only `h-[100dvh]` approach with `ViewportContainer`
    - When phase is not LOBBY and not END_TOURNAMENT, render `ViewportContainer` wrapping `GameView` for all game types
    - Keep scrollable lobby layout (`min-h-screen overflow-y-auto`) for LOBBY phase
    - Restore scroll position to top when returning to LOBBY
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Add per-game grid configurations to `ViewportContainer` usage
    - Pass appropriate `gridRows` prop based on `gameType` from `GAME_GRID_CONFIGS`
    - Coin-toss: `auto minmax(40svh, 1fr) auto`
    - Battle-bots: `auto minmax(40svh, 1fr) auto`
    - Big-wheel: `auto minmax(45svh, 1fr) auto`
    - Playcaller: `auto minmax(40svh, 1fr) auto`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Implement sub-600px scroll fallback in `ViewportContainer`
    - Add media query or JS check: if viewport height < 600px, switch to `overflow: auto`
    - Ensures interactive elements remain tappable on very short viewports
    - _Requirements: 3.6_

  - [ ]* 4.4 Write property test: Grid configuration allocates sufficient primary area (Property 2)
    - **Property 2: Grid configuration allocates sufficient primary area**
    - For any game type in GAME_GRID_CONFIGS, the grid row config allocates at least 40svh to the primary area
    - **Validates: Requirements 3.5**

  - [ ]* 4.5 Write property test: ViewportContainer applied to all game types (Property 7)
    - **Property 7: ViewportContainer applied to all game types**
    - For any game type in {coin-toss, battle-bots, big-wheel, playcaller} when phase is not LOBBY/END_TOURNAMENT, LobbyShell renders ViewportContainer
    - **Validates: Requirements 7.3**

- [x] 5. Host Controls: FAB overlay isolation
  - [x] 5.1 Refactor `HostControlPanel` to render as a fixed-position FAB overlay
    - Use CSS `position: fixed` so it doesn't participate in document flow
    - Position within safe-area-inset bounds
    - Ensure non-host players see zero layout impact (no placeholder gaps)
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 5.2 Implement host controls panel overlay behavior
    - When host activates controls, panel overlays game at highest stacking context (`z-index`)
    - No shifting or resizing of underlying game layout
    - When host role is reassigned, remove FAB/panel from former host in same render frame
    - _Requirements: 4.3, 4.5_

- [x] 6. Checkpoint - Validate game migration and host controls
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Overlay Element Containment
  - [x] 7.1 Create `OverlayContainer` wrapper component at `packages/client/src/components/layout/OverlayContainer.tsx`
    - Implement `OverlayContainerProps` with `maxHeightPercent` (default 60), `edgeClearance` (default 8px), `autoReposition`
    - Enforce max-height of `maxHeightPercent`% of viewport height
    - Enable internal vertical scrolling when content exceeds max-height
    - Maintain minimum 8px clearance from each viewport edge
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Implement auto-reposition logic in `OverlayContainer`
    - If default position (below/rightward) would clip viewport edge, reposition to opposite direction
    - Calculate available space in all directions, pick direction with most room
    - _Requirements: 5.5_

  - [x] 7.3 Apply `OverlayContainer` to `HistoryDrawer` in playcaller
    - Wrap or constrain `HistoryDrawer` to respect viewport bounds regardless of entry count
    - _Requirements: 5.4_

  - [ ]* 7.4 Write property test: Overlay bounded height with internal scroll (Property 4)
    - **Property 4: Overlay bounded height with internal scroll**
    - For any viewport height and content height, overlay max-height ≤ 60% viewport height, and if content exceeds it, overflow-y is `auto`
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 7.5 Write property test: Overlay edge containment with auto-reposition (Property 5)
    - **Property 5: Overlay edge containment with auto-reposition**
    - For any overlay dimensions, anchor position, and safe-area insets, all edges stay ≥ 8px inside safe-area bounds
    - **Validates: Requirements 5.3, 5.5**

- [x] 8. Typography Optimization
  - [x] 8.1 Create `ResponsiveText` component at `packages/client/src/components/layout/ResponsiveText.tsx`
    - Implement `ResponsiveTextProps` with `minSize` (14px), `maxSize` (24px), `truncate`, `className`
    - Use CSS `clamp()` with viewport-relative units for fluid scaling between 375px and 1280px
    - Apply `text-overflow: ellipsis` + `white-space: nowrap` + `overflow: hidden` when `truncate` is true
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 8.2 Apply `ResponsiveText` to `SpectatorView` matchup cards
    - Wrap player names and match status text in `ResponsiveText`
    - Reduce container padding to no less than 8px when space allows larger text
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.3 Write property test: Fluid typography clamping (Property 6)
    - **Property 6: Fluid typography clamping**
    - For any viewport width: size = 14px at ≤ 375px, 24px at ≥ 1280px, linearly interpolated between
    - **Validates: Requirements 6.1, 6.3**

- [x] 9. Large Screen Scaling
  - [x] 9.1 Add dark background fill for large screens surrounding the `ViewportContainer`
    - Set body/root background to match the platform dark theme
    - Viewport_Container centers within the viewport when exceeding max bounds
    - When viewport is smaller than max bounds, container fills available space without centering offsets
    - _Requirements: 8.2, 8.4, 8.5_

  - [ ]* 9.2 Write unit tests for large-screen centering behavior
    - Test that container centers when viewport > 1024px wide or > 1366px tall
    - Test that container fills viewport without dead space when below max bounds
    - _Requirements: 8.2, 8.4_

- [x] 10. Cross-Browser Compatibility Verification
  - [x] 10.1 Verify CSS fallback declarations in `ViewportContainer`
    - Ensure `height: 100vh` appears before `height: 100svh` in the CSS output
    - Ensure all `env()` calls include `0px` fallback value
    - Verify `overflow: hidden` is always applied regardless of svh support
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 10.2 Write integration tests for fallback behavior
    - Test that layout is functional with vh-only (simulating no svh support)
    - Test that missing viewport-fit=cover still produces overflow: hidden layout
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design (fast-check library)
- Unit tests validate specific examples and edge cases
- The `/viewport-test` route enables real-device manual validation without game state
- The existing playcaller-only `100dvh` approach in LobbyShell is replaced by the universal ViewportContainer

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.5", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["3A.1", "3B.1"] },
    { "id": 5, "tasks": ["3B.2", "2.4", "4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3"] },
    { "id": 7, "tasks": ["4.4", "4.5", "5.1"] },
    { "id": 8, "tasks": ["5.2", "7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 10, "tasks": ["7.4", "7.5", "8.2"] },
    { "id": 11, "tasks": ["8.3", "9.1"] },
    { "id": 12, "tasks": ["9.2", "10.1"] },
    { "id": 13, "tasks": ["10.2"] }
  ]
}
```
