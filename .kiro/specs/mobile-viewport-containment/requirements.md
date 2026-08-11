# Requirements Document

## Introduction

Mobile Viewport Containment enforces strict no-scroll, no-clip viewport-fit across all game plugins in the Games of Chance party game platform. The system guarantees that every game UI fits entirely within the visible mobile viewport—accounting for browser chrome, notches, and home indicators—without any element being scrolled off-screen or clipped. This eliminates the unreliable `100dvh` approach in favor of `100svh` combined with CSS `env(safe-area-inset-*)` values, validated through a dedicated test harness before rolling changes into production game plugins.

## Glossary

- **Viewport_Container**: The outermost DOM element wrapping a game plugin's UI, responsible for constraining all child content to the visible viewport
- **Safe_Area**: The device screen region excluding hardware obstructions (notches, home indicators, rounded corners), accessed via `env(safe-area-inset-*)` CSS values
- **Browser_Chrome**: Mobile browser UI elements (address bar, toolbar, navigation bar) that reduce available viewport height
- **SVH**: Small Viewport Height CSS unit (`svh`) representing the viewport height when browser chrome is fully visible—the smallest guaranteed available space
- **Game_Plugin**: A self-contained game module (coin-toss, battle-bots, big-wheel, playcaller) rendered within the platform
- **Host_Controls**: UI buttons and actions available only to the room host for managing game flow (start round, end game, advance bracket)
- **Overlay_Element**: A floating UI component (popover, drawer, modal) that renders above the main game content layer
- **Test_Harness**: A standalone route (`/viewport-test`) containing a sample UI page that validates viewport containment behavior on real devices without connecting to game logic
- **Viewport_Fit_Meta**: The HTML meta tag attribute `viewport-fit=cover` that extends the layout viewport into device safe areas, enabling `env()` inset values
- **Max_Bounds**: The maximum dimensions (1024px width × 1366px height) beyond which the Viewport_Container stops growing and centers within the available screen space

## Requirements

### Requirement 1: Viewport Container Foundation

**User Story:** As a mobile player, I want the game UI to always fit within my visible screen, so that I never have to scroll to see game content.

#### Acceptance Criteria

1. THE Viewport_Container SHALL set its height to `100svh` and its width to `100vw` to fill the entire visible viewport without triggering horizontal or vertical scrollbars
2. THE Viewport_Container SHALL apply `overflow: hidden` to prevent any scroll behavior on the game container
3. THE Viewport_Container SHALL apply padding using `env(safe-area-inset-top, 0px)`, `env(safe-area-inset-bottom, 0px)`, `env(safe-area-inset-left, 0px)`, and `env(safe-area-inset-right, 0px)` to prevent content from rendering behind device obstructions while falling back to zero padding on browsers that do not support safe area insets
4. WHEN the HTML document loads, THE Viewport_Fit_Meta tag SHALL include `viewport-fit=cover` to enable safe area inset values

### Requirement 2: Test Harness Validation

**User Story:** As a developer, I want a standalone test page that proves viewport containment works on real devices, so that I can validate the approach before modifying production game plugins.

#### Acceptance Criteria

1. THE Test_Harness SHALL be accessible at the `/viewport-test` route without requiring a room connection or game state
2. THE Test_Harness SHALL apply the Viewport_Container (height `100svh`, `overflow: hidden`, safe area padding per Requirement 1) and render its content using CSS Grid with `svh`-based row tracks comprising at least 3 rows (header, content, card grid)
3. THE Test_Harness SHALL include visual boundary indicators rendered as visible lines or borders at each safe area edge (top, bottom, left, right) and at the viewport container boundary
4. THE Test_Harness SHALL include a mock header row, a content area, and a play card grid containing at least 4 placeholder cards to simulate typical game plugin structure
5. THE Test_Harness SHALL display the computed viewport height (in pixels), each safe area inset value (in pixels), and a scroll-detected boolean as a diagnostic overlay, updating these values within 200ms of any viewport resize or orientation change event
6. IF the Viewport_Container's scrollHeight exceeds its clientHeight or any child element renders outside the container bounds, THEN THE Test_Harness SHALL display a red visual warning indicating a containment violation

### Requirement 3: Game Plugin Migration

**User Story:** As a mobile player, I want every game in the platform to respect viewport containment, so that my experience is consistent across all games.

#### Acceptance Criteria

1. WHEN the coin-toss Game_Plugin is active, THE Viewport_Container SHALL render all coin-toss UI elements (pick controls, animation area, leaderboard, and round controls) within the viewport height using `overflow: hidden` on the game container, producing no vertical scrollbar on devices with a viewport height of 600px or greater
2. WHEN the battle-bots Game_Plugin is active, THE Viewport_Container SHALL render all battle-bots UI elements (pick controls, animation area, leaderboard, and round controls) within the viewport height using `overflow: hidden` on the game container, producing no vertical scrollbar on devices with a viewport height of 600px or greater
3. WHEN the big-wheel Game_Plugin is active, THE Viewport_Container SHALL render all big-wheel UI elements (wheel animation, spin controls, leaderboard, and spin-order indicator) within the viewport height using `overflow: hidden` on the game container, producing no vertical scrollbar on devices with a viewport height of 600px or greater
4. WHEN the playcaller Game_Plugin is active, THE Viewport_Container SHALL render all playcaller UI elements (field panel, play cards, scoreboard, and play-by-play) within the viewport height using `overflow: hidden` on the game container, producing no vertical scrollbar on devices with a viewport height of 600px or greater
5. WHEN any Game_Plugin is active, THE Viewport_Container SHALL use CSS Grid with `svh`-based row sizing to distribute vertical space among game sections such that the header row uses a fixed height, the primary game area occupies at least 40% of the viewport height, and interactive controls occupy the remaining space
6. IF the viewport height is less than 600px, THEN THE Viewport_Container SHALL allow vertical scrolling rather than clipping content that would become untappable

### Requirement 4: Host Controls Isolation

**User Story:** As a regular player, I want the game viewport to use all available screen space for gameplay, so that host-only buttons do not consume my viewport real estate.

#### Acceptance Criteria

1. THE Host_Controls SHALL render as a fixed-position floating action button (FAB) overlaid on the game viewport, using CSS fixed or absolute positioning so that it does not participate in normal document flow or occupy inline layout space
2. WHILE a non-host player views the game, THE Viewport_Container SHALL allocate the same width and height to game content as the host's Viewport_Container (no placeholder gaps, margins, or reserved regions where host controls would otherwise appear)
3. WHEN the host activates Host_Controls, THE Host_Controls panel SHALL overlay the game content at the highest stacking context (above all game UI elements) without shifting or resizing the underlying game layout
4. THE Host_Controls floating element SHALL position itself within the CSS safe-area-inset bounds to remain fully visible and fully interactive on notched and rounded-corner devices
5. WHEN the host role is reassigned to another player, THE Host_Controls FAB and panel SHALL be removed from the former host's view within the same render frame as the role change, leaving zero residual layout footprint

### Requirement 5: Overlay Element Containment

**User Story:** As a player viewing drive history, I want the popover to show all entries without clipping off-screen, so that I can review my full play history.

#### Acceptance Criteria

1. WHEN an Overlay_Element opens, THE Overlay_Element SHALL set a bounded maximum height of no more than 60% of the viewport height to keep the element within the Safe_Area
2. WHEN an Overlay_Element content exceeds its bounded maximum height, THE Overlay_Element SHALL enable internal vertical scrolling within its own container
3. THE Overlay_Element SHALL position itself so that no edge extends beyond the Safe_Area bounds on any side, maintaining a minimum clearance of 8px from each viewport edge
4. WHEN the HistoryDrawer opens in the playcaller Game_Plugin, THE HistoryDrawer SHALL constrain its height to remain visible within the viewport regardless of the number of play entries
5. IF an Overlay_Element would be clipped by the viewport edge at its default position, THEN THE Overlay_Element SHALL reposition itself to the opposite direction (open upward instead of downward, or leftward instead of rightward) to remain fully visible

### Requirement 6: Typography Optimization

**User Story:** As a spectator watching other games, I want text to be sized proportionally to its container, so that I can read game information without squinting.

#### Acceptance Criteria

1. WHEN the SpectatorView renders game matchup cards, THE SpectatorView SHALL size player names and match status text using relative units that scale with the card container width, with a minimum computed size of 14px at viewport widths of 375px or below and a maximum computed size of 24px at viewport widths of 1280px or above
2. IF the matchup card container width allows text to be rendered at a larger size within current bounds, THEN THE SpectatorView SHALL reduce container padding to no less than 8px to maximize the space available for text content
3. WHEN a text element is inside a matchup card container, THE text element SHALL use viewport-relative or container-relative sizing units to scale proportionally between the defined minimum (14px) and maximum (24px) bounds as the container dimensions change
4. IF a player name exceeds the available container width at the current computed font size, THEN THE SpectatorView SHALL truncate the name with an ellipsis rather than wrapping to a second line

### Requirement 7: LobbyShell Integration

**User Story:** As a player transitioning between lobby and game, I want the viewport containment to activate seamlessly when a game starts, so that I experience no layout jump or scroll flash.

#### Acceptance Criteria

1. WHEN a Game_Plugin becomes active (phase transitions from LOBBY), THE LobbyShell SHALL switch from scrollable lobby layout to the fixed Viewport_Container layout (height `100svh`, `overflow: hidden`, safe area padding)
2. WHEN the game phase returns to LOBBY, THE LobbyShell SHALL restore scrollable lobby layout for game selection and settings, resetting scroll position to the top
3. THE LobbyShell SHALL apply the Viewport_Container to all Game_Plugin types (coin-toss, battle-bots, big-wheel, playcaller) during active game phases, not only playcaller
4. WHEN the layout transitions between lobby mode and game mode, THE LobbyShell SHALL complete the transition within a single React render pass (no intermediate frames showing scroll or layout shift)

### Requirement 8: Large Screen Scaling

**User Story:** As a player on a tablet or desktop, I want the game UI to remain tightly bounded and centered, so that elements do not stretch awkwardly across a large display.

#### Acceptance Criteria

1. THE Viewport_Container SHALL enforce a maximum width of 1024px and a maximum height of 1366px (matching iPad Pro portrait dimensions) to prevent unbounded stretching on large screens
2. WHEN the browser viewport exceeds the maximum width or maximum height, THE Viewport_Container SHALL center itself horizontally and vertically within the viewport, with the remaining space filled by a neutral background color
3. THE Viewport_Container SHALL use `min(100svh, 1366px)` for height and `min(100vw, 1024px)` for width so that the container scales fluidly up to the cap and stops growing beyond it
4. WHEN the viewport is smaller than the maximum bounds (width below 1024px or height below 1366px), THE Viewport_Container SHALL fill the available viewport dimensions without centering offsets or dead space
5. THE neutral background surrounding the centered Viewport_Container on large screens SHALL use a dark color consistent with the platform's existing dark theme (e.g., matching the body or root background)

### Requirement 9: Cross-Browser Compatibility

**User Story:** As a player using different mobile browsers, I want the viewport containment to work reliably regardless of my browser, so that I have a consistent experience.

#### Acceptance Criteria

1. THE Viewport_Container SHALL declare the fallback height (`height: 100vh`) before the modern height (`height: 100svh`) in the CSS cascade so that supporting browsers override the fallback while non-supporting browsers ignore the unrecognized `svh` declaration and retain `overflow: hidden`
2. THE Viewport_Container SHALL specify a fallback value of `0px` in each `env()` function call (e.g., `env(safe-area-inset-top, 0px)`) so that browsers lacking environment variable support resolve safe-area padding to zero rather than an invalid value
3. IF the browser does not support `viewport-fit=cover`, THEN THE Viewport_Container SHALL still enforce `overflow: hidden` and use the `100vh` fallback height to prevent scrolling
4. WHEN the Viewport_Container renders on a browser that lacks `svh` support, THE Viewport_Container SHALL produce a visible layout (no scroll, no content overflow beyond the viewport edge) that is functionally equivalent to the `svh`-based layout on supporting browsers
5. THE Viewport_Container SHALL support fallback behavior on mobile browsers released within the last 3 major versions of Safari (iOS), Chrome (Android), Samsung Internet, and Firefox (Android)
