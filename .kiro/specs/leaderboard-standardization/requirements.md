# Requirements Document

## Introduction

Standardize all leaderboard components across the games-of-chance platform into a unified architecture. A shared base leaderboard component handles consistent rendering of ranks, names, scores, animations, and theming while a slot system allows each game plugin to inject its own UI. Additional features include a compact variant, popover-based session standings, risers/fallers rank change indicators, and updated "game complete" between-game screen styling.

## Glossary

- **Base_Leaderboard**: A shared, presentational React component that renders player ranks, names, scores, and animations consistently across all game plugins
- **Slot**: A designated render area within the Base_Leaderboard where plugin-specific UI content is injected via React children or render props
- **Compact_View**: A reduced-height variant of the Base_Leaderboard that displays essential information (rank, name, score) in a denser layout
- **Session_Standings_Popover**: A floating popover UI element that displays the session leaderboard without occupying space in the normal document flow
- **Riser**: A player whose rank improved (lower rank number) between the pre-game snapshot and post-game standings, displayed as a positive indicator (e.g., +3)
- **Faller**: A player whose rank worsened (higher rank number) between the pre-game snapshot and post-game standings, displayed as a negative indicator (e.g., -2)
- **Pre_Game_Snapshot**: A copy of each player's session leaderboard rank captured before a game begins, used as baseline for risers/fallers comparison
- **Game_Complete_Screen**: The between-game screen displayed when a game finishes but the session is not over, replacing the current FinalResultsScreen during END_GAME phase
- **Congratulations_Screen**: The final screen shown after the last game in a session, which retains the podium layout
- **Plugin_Leaderboard**: A game-specific leaderboard component (CoinTossLeaderboard, BigWheelLeaderboard, etc.) that extends the Base_Leaderboard with custom slot content
- **GameLeaderboardEntry**: The shared type containing playerId, playerName, score, rank, streak, coldStreak, and lastMultiplier fields
- **SessionLeaderboardEntry**: The shared type containing playerId, playerName, sessionPoints, gamesPlayed, and rank fields
- **Theme_System**: The existing useTheme() hook providing consistent card, text, and accent color tokens across components

## Requirements

### Requirement 1: Base Leaderboard Component

**User Story:** As a developer, I want a shared base leaderboard component that renders player standings consistently, so that all game plugins have uniform styling and behavior without duplicating code.

#### Acceptance Criteria

1. THE Base_Leaderboard SHALL accept an ordered array of GameLeaderboardEntry objects (via an `entries` prop) and a `currentPlayerId` string prop, and render each entry as a list item showing rank badge, player name, and score
2. THE Base_Leaderboard SHALL highlight the current player's row (matched via `currentPlayerId`) with a themed ring defined by the Theme_System's `currentPlayerRing` token
3. THE Base_Leaderboard SHALL display a "(you)" indicator next to the current player's name
4. THE Base_Leaderboard SHALL render rank 1 with a first-place badge, rank 2 with a second-place badge, and rank 3 with a third-place badge, each using Theme_System tokens so that themes can define their own top-3 visual treatment (e.g., gold/silver/bronze in default theme, thematic alternatives in other themes)
5. THE Base_Leaderboard SHALL render ranks below 3 with a neutral badge styled via Theme_System tokens
6. THE Base_Leaderboard SHALL display scores right-aligned using tabular-nums font variant
7. THE Base_Leaderboard SHALL apply framer-motion entrance animation (opacity 0→1 and translateY 8px→0) with a duration of 300ms and easeOut easing to the container on mount
8. WHEN player ranks change between renders, THE Base_Leaderboard SHALL animate each player row to its new position using framer-motion layout animation with a duration of 400ms so that rising players slide upward and falling players slide downward
9. THE Base_Leaderboard SHALL apply the Theme_System tokens for card background, text colors, and accent colors
10. WHEN a row-level Slot render prop is provided, THE Base_Leaderboard SHALL render the Slot content within each player row between the player name/streak area and the score column
11. WHEN a header Slot is provided, THE Base_Leaderboard SHALL render the header content above the player list
12. WHEN the entries array is empty, THE Base_Leaderboard SHALL render nothing (return null)
13. THE Base_Leaderboard SHALL truncate player names that exceed the available row width with an ellipsis

### Requirement 2: Plugin Slot System

**User Story:** As a game plugin developer, I want to inject custom UI into the base leaderboard via slots, so that each game can display its unique data (coin toss sequences, spin results) within the standardized layout.

#### Acceptance Criteria

1. THE Base_Leaderboard SHALL expose a `renderRow` prop (render prop function) that receives the current GameLeaderboardEntry and returns ReactNode content rendered inline within the player row between the name area and the score column
2. THE Base_Leaderboard SHALL expose a `renderHeader` prop (render prop function) that receives the full entries array and returns ReactNode content rendered above the player list
3. WHEN neither `renderRow` nor `renderHeader` props are provided, THE Base_Leaderboard SHALL render rows without plugin-specific content and display only base fields (rank, name, score)
4. THE `renderRow` prop function SHALL receive the typed GameLeaderboardEntry object for the corresponding player row
5. THE Base_Leaderboard SHALL maintain consistent score column right-alignment regardless of whether Slot content is present or varies in height between players
6. WHEN row-level Slot content overflows the available horizontal space, THE Base_Leaderboard SHALL allow the slot area to wrap to a second line below the player name rather than pushing the score column out of alignment

### Requirement 3: Compact View Variant

**User Story:** As a player on a small screen, I want a compact leaderboard variant, so that the standings take up less space while still showing essential information.

#### Acceptance Criteria

1. WHEN a compact variant is requested, THE Base_Leaderboard SHALL render each row with vertical padding no greater than 4px (py-1) and text at the text-[11px] size, reducing total row height compared to the default variant's py-2 and text-xs sizing
2. WHEN a compact variant is requested, THE Base_Leaderboard SHALL suppress rendering of Slot content to conserve space
3. WHEN a compact variant is requested, THE Base_Leaderboard SHALL render rank badges at 16×16px (h-4 w-4) with text-[9px] font size, reduced from the default variant's 20×20px (h-5 w-5) badges
4. WHEN a compact variant is requested, THE Base_Leaderboard SHALL still display rank, player name (truncated with ellipsis if it exceeds the available row width), and score for each entry
5. THE Base_Leaderboard SHALL accept a variant prop with allowed values "default" and "compact", where "default" is applied when the prop is omitted
6. WHILE the variant prop is set to "compact", THE Base_Leaderboard SHALL preserve framer-motion layout animations for rank changes but SHALL skip the entrance animation (fade-in and slide-up) on mount

### Requirement 4: Session Standings Popover

**User Story:** As a player, I want the session standings to appear as a floating popover, so that toggling the standings does not shift the surrounding layout.

#### Acceptance Criteria

1. THE Session_Standings_Popover SHALL render as a floating element positioned relative to its trigger button without occupying space in the document flow
2. WHEN the trigger button is activated, THE Session_Standings_Popover SHALL toggle visibility of the session leaderboard panel
3. THE Session_Standings_Popover SHALL display each entry with: rank, connection indicator (connected or disconnected), bot icon (for bot or bot-controlled players), player name, host badge (for host role), and session score, sorted by session score descending with ties broken by humans before bots
4. WHEN the user clicks outside the popover area, THE Session_Standings_Popover SHALL close and return focus to the trigger button
5. WHEN the user presses the Escape key while the popover is open, THE Session_Standings_Popover SHALL close and return focus to the trigger button
6. THE Session_Standings_Popover SHALL gate displayed session scores behind useDeferredRevealValue so that scores reflect the previous value until roundAnimationDone is true or phase is PICKING, LOBBY, or END_GAME
7. WHILE a game is active (phase is not LOBBY), THE Session_Standings_Popover SHALL default to closed state on each phase transition away from LOBBY, but remain manually toggleable by the user thereafter
8. IF the popover content exceeds the viewport height, THEN THE Session_Standings_Popover SHALL scroll internally to keep all entries accessible without overflowing the viewport

### Requirement 5: Risers and Fallers Indicators

**User Story:** As a player, I want to see how my rank changed after each game, so that I can track my progress through the session at a glance.

#### Acceptance Criteria

1. WHEN a game begins (phase transitions from LOBBY to an active game phase), THE Server SHALL capture a Pre_Game_Snapshot containing each player's current session leaderboard rank at that moment
2. WHEN a game ends and session scores update, THE Server SHALL compute the rank change for each player by subtracting the post-game rank from the Pre_Game_Snapshot rank (positive = improved, negative = worsened)
3. WHEN a player's rank improved (rank number decreased), THE Game_Complete_Screen SHALL display a green upward-pointing Riser indicator showing the magnitude of improvement (e.g., "↑3")
4. WHEN a player's rank worsened (rank number increased), THE Game_Complete_Screen SHALL display a red downward-pointing Faller indicator showing the magnitude of decline (e.g., "↓2")
5. WHEN a player's rank did not change, THE Game_Complete_Screen SHALL display no rank change indicator for that player
6. THE rank change indicators SHALL be displayed exclusively on the Game_Complete_Screen and SHALL NOT appear on the in-game leaderboard or the Congratulations_Screen
7. THE Pre_Game_Snapshot SHALL be included in the RoomState (as a `preGameRanks` field of type Record<string, number>) so clients can access rank change data
8. WHEN it is the first game of the session (no prior session rankings exist), THE Server SHALL assign all players the same initial rank (1) in the Pre_Game_Snapshot so no risers/fallers appear on the first Game_Complete_Screen
9. WHEN a player joins mid-session and has no entry in the Pre_Game_Snapshot, THE Game_Complete_Screen SHALL display no rank change indicator for that player

### Requirement 6: Game Complete Screen Redesign

**User Story:** As a player, I want the between-game screen to feel encouraging and clearly communicate that the session continues, so that I understand the game is done but more games remain.

#### Acceptance Criteria

1. THE Game_Complete_Screen SHALL display the heading text "Game complete!" instead of "🏆 Final Results"
2. THE Game_Complete_Screen SHALL display the subtext "Updated standings" below the heading
3. THE Game_Complete_Screen SHALL display the session leaderboard as a ranked list where each entry shows the player name, session points, and a riser indicator (up arrow) if the player's rank improved compared to their rank before the just-completed game, a faller indicator (down arrow) if the player's rank worsened, or no indicator if the rank is unchanged or if it is the first game of the session
4. THE Game_Complete_Screen SHALL retain the "Return to Lobby" button visible only to the host
5. THE Congratulations_Screen (shown after the final game in a session) SHALL retain the podium layout with 1st, 2nd, and 3rd place positions
6. WHEN the system transitions to the END_TOURNAMENT phase (i.e., the completed game has the isFinale flag in tournament mode), THE system SHALL display the Congratulations_Screen with podium instead of the Game_Complete_Screen
7. WHILE the session progressionMode is "endless", THE system SHALL always display the Game_Complete_Screen at the END_GAME phase, since there is no final game in endless mode

### Requirement 7: Plugin Leaderboard Migration

**User Story:** As a developer, I want each existing game plugin to use the Base_Leaderboard with its custom slot content, so that visual consistency is achieved without losing plugin-specific features.

#### Acceptance Criteria

1. THE CoinToss Plugin_Leaderboard SHALL use the Base_Leaderboard with a header Slot containing the toss sequence row (H/T coin tokens showing each round outcome) and a row Slot containing per-player pick accuracy tokens (green token for correct pick, red token for incorrect pick, one per round), streak indicators (🔥 for hot streak of 2+, 🔥🔥 for 3+, 🧊 for cold streak of 2+, 🧊🧊 for 3+), and a +delta label showing points gained in the most recent round
2. THE BigWheel Plugin_Leaderboard SHALL use the Base_Leaderboard with a row Slot containing per-player spin result badges (one badge per spin showing +N value), turn-order indicators (▶ for active spinner, ◆ for up-next player, ✓ for players who have completed their spin), and status labels ("Spinning" for the active player, "Up Next" for the next player in spin order)
3. THE BattleBots Plugin_Leaderboard SHALL use the Base_Leaderboard without custom Slot content (base rendering only)
4. THE Playcaller Plugin_Leaderboard SHALL use the Base_Leaderboard in Compact_View variant, rendered within the PlaycallerHeader dropdown menu displaying session standings in the full-viewport layout
5. WHEN a plugin provides Slot content, THE Base_Leaderboard SHALL render that content while maintaining rank badges left-aligned, scores right-aligned with tabular-nums, and row items vertically centered within each player row
6. WHEN a plugin's Slot data is gated behind useDeferredRevealValue in the current implementation, THE migrated Plugin_Leaderboard SHALL preserve the same deferred-reveal gating so that scores and slot content do not reveal outcomes before animations complete
