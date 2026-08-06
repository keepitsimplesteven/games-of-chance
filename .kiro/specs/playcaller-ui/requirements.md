# Requirements Document

## Introduction

The Playcaller UI is the Phase 2 client interface for the Playcaller football game. It replaces the Phase 1 placeholder match panels with an interactive drive experience. Active competitors see a football field visualization, play selection cards with SVG play art, real-time ball animation, and play-by-play results. Spectators see a grid of active matchups they can tap into for a read-only view. The UI integrates with the existing Drive Engine (server) and PlaycallerPlugin bracket system, uses Framer Motion for animations, and targets a mobile-first viewport (no scroll during gameplay at ≤470px height). It uses the project's existing retro-casino theme system.

## Glossary

- **Playcaller_UI**: The client-side React component tree that renders the interactive football drive experience for the Playcaller game
- **Field_Panel**: A 125px-wide left-aligned panel displaying a vertical football field with yard markers, ball position, and down/distance indicator
- **Mini_Scoreboard**: A compact right-aligned panel next to the Field_Panel showing the current drive score context (offense/defense names, down, yards to go, yard line)
- **Play_Card**: A tappable UI card displaying a single play option with SVG play art, play name, and formation label arranged in a 2×2 grid below the field
- **Play_Art**: An inline SVG graphic depicting the play's formation and routes (offense) or coverage scheme (defense), rendered within a Play_Card
- **Ball_Marker**: An animated element on the Field_Panel representing the football's current position on the field
- **Play_Result_Line**: A single-line text element displaying the most recent play outcome (yards gained, turnover, etc.)
- **History_Drawer**: An expandable panel containing the full chronological list of play results for the current drive
- **Circumstance**: A game-state classification (standard, short_yardage, desperation) that determines which variant of Play_Art and play name the Play_Card displays
- **Drive_State**: The current state of the football drive received from the server (down, yards to go, yard line, play history, completion status)
- **Active_Competitor**: A player currently participating in a live drive matchup who can select plays
- **Spectator**: A player who has been eliminated or is on a bye, viewing other matchups in read-only mode
- **Lock_In**: The instant, irreversible submission of a play selection triggered by a single tap on a Play_Card

## Requirements

### Requirement 1: Game Layout Structure

**User Story:** As an active competitor, I want the game screen to fit entirely on my mobile device without scrolling, so that I can focus on play-calling without losing context.

#### Acceptance Criteria

1. WHILE an Active_Competitor is in a live drive, THE Playcaller_UI SHALL render a layout with the Field_Panel (125px width) on the left, the Mini_Scoreboard to the right of the Field_Panel, and a 2×2 grid of Play_Cards spanning full width below
2. THE Playcaller_UI SHALL constrain the entire gameplay layout to fit within a 470px maximum viewport height without vertical scrolling
3. THE Playcaller_UI SHALL render a header bar above the field area displaying the current round name and opponent name
4. THE Playcaller_UI SHALL render the Play_Result_Line between the field area and the Play_Card grid

### Requirement 2: Field Panel Visualization

**User Story:** As an active competitor, I want to see a football field showing the ball's position, so that I understand the drive's progress at a glance.

#### Acceptance Criteria

1. THE Field_Panel SHALL render a vertical football field representation with yard line markers at 10-yard intervals from 0 (end zone) to the starting yard line
2. THE Field_Panel SHALL display the Ball_Marker at the vertical position corresponding to the current yard line from Drive_State
3. WHEN a play resolves, THE Field_Panel SHALL animate the Ball_Marker from the previous yard line position to the new yard line position using Framer Motion
4. THE Field_Panel SHALL display the current down and yards-to-go text (e.g., "2nd & 7") within or adjacent to the field
5. WHEN the drive ends in a touchdown, THE Field_Panel SHALL animate the Ball_Marker into the end zone (yard line 0)

### Requirement 3: Ball Animation

**User Story:** As a player, I want the ball animation to visually distinguish runs from passes and build dramatic tension, so that play resolution feels exciting.

#### Acceptance Criteria

1. WHEN a run play resolves, THE Ball_Marker animation SHALL use a translate motion along the field axis from the previous position to the new position
2. WHEN a pass play resolves, THE Ball_Marker animation SHALL combine a scale increase and rotation with the translate motion to convey an airborne trajectory
3. THE Ball_Marker animation SHALL accept configurable duration timing to allow longer animations for high-drama moments (critical success, touchdown, turnover)
4. WHEN a turnover occurs, THE Ball_Marker animation SHALL use a distinct motion pattern (e.g., erratic path or shake) to signal the change of possession
5. THE Playcaller_UI SHALL use Framer Motion for all Ball_Marker animations

### Requirement 4: Play Card Display

**User Story:** As an active competitor, I want to see all four play options at once with clear visual play art, so that I can quickly evaluate and select my play.

#### Acceptance Criteria

1. WHILE an Active_Competitor is selecting a play, THE Playcaller_UI SHALL display exactly 4 Play_Cards in a 2×2 grid layout below the field area
2. WHEN the Active_Competitor is on offense, THE Play_Card SHALL display offense-specific Play_Art showing formation and route arrows for each of the 4 offensive plays (Inside Run, Outside Run, Short Pass, Deep Pass)
3. WHEN the Active_Competitor is on defense, THE Play_Card SHALL display defense-specific Play_Art showing formation and coverage zones or blitz arrows for each of the 4 defensive plays (Run Contain, Blitz, Zone Coverage, Man Press)
4. THE Play_Card SHALL display the play name text below or overlaying the Play_Art SVG
5. THE Playcaller_UI SHALL render all 4 Play_Cards simultaneously without requiring scrolling or pagination

### Requirement 5: Play Art SVG System

**User Story:** As a player, I want Madden-style play diagrams that change based on game situation, so that the UI feels polished and contextually relevant.

#### Acceptance Criteria

1. THE Playcaller_UI SHALL render Play_Art as inline SVG elements depicting formation positions and route/coverage paths
2. THE Play_Art for offensive plays SHALL show player position markers and directional route arrows representing the play's movement pattern
3. THE Play_Art for defensive plays SHALL show player position markers and coverage zone shading or blitz arrow paths representing the defensive scheme
4. THE Playcaller_UI SHALL select the Play_Art variant and display name based on the current Circumstance classification (standard, short_yardage, desperation)
5. WHEN the Circumstance is short_yardage (yards to go ≤ 3), THE Playcaller_UI SHALL display short-yardage-themed play names and Play_Art variants
6. WHEN the Circumstance is desperation (4th down with yards to go > 5), THE Playcaller_UI SHALL display desperation-themed play names and Play_Art variants
7. WHEN the Circumstance is standard (all other situations), THE Playcaller_UI SHALL display standard play names and Play_Art variants

### Requirement 6: Play Selection Interaction

**User Story:** As an active competitor, I want tapping a play card to instantly lock in my choice, so that the game feels fast and decisive.

#### Acceptance Criteria

1. WHEN an Active_Competitor taps a Play_Card, THE Playcaller_UI SHALL immediately submit that play selection to the server as a Lock_In action
2. WHEN a Lock_In occurs, THE Playcaller_UI SHALL visually indicate the selected Play_Card as chosen (e.g., highlighted border, opacity change on unselected cards)
3. WHEN a Lock_In occurs, THE Playcaller_UI SHALL disable further play selection for the current down (prevent double-tap or accidental re-selection)
4. THE Playcaller_UI SHALL provide no confirmation dialog or undo mechanism for play selection
5. WHILE waiting for the opponent to submit a play selection after Lock_In, THE Playcaller_UI SHALL display a waiting indicator on the selected Play_Card or field area

### Requirement 7: Play Result Display

**User Story:** As a player, I want to see what happened on the last play clearly, with access to full drive history, so that I stay informed without cluttering the screen.

#### Acceptance Criteria

1. WHEN a play resolves, THE Playcaller_UI SHALL display a single Play_Result_Line showing the outcome text (e.g., "Short Pass — 6 yards", "Inside Run — Fumble!")
2. THE Play_Result_Line SHALL remain visible until the next play resolves or the drive ends
3. THE Playcaller_UI SHALL provide a tappable indicator on the Play_Result_Line that expands the History_Drawer
4. WHEN the History_Drawer is expanded, THE Playcaller_UI SHALL display the full chronological list of play results for the current drive
5. WHEN the History_Drawer is expanded, THE Playcaller_UI SHALL allow the player to collapse the History_Drawer back to the single-line view
6. THE History_Drawer expansion and collapse SHALL use Framer Motion animated transitions

### Requirement 8: Mini Scoreboard

**User Story:** As an active competitor, I want a compact scoreboard showing down, distance, and yard line, so that I always know the game situation.

#### Acceptance Criteria

1. THE Mini_Scoreboard SHALL display the current down number (1st through 4th)
2. THE Mini_Scoreboard SHALL display the current yards-to-go value
3. THE Mini_Scoreboard SHALL display the current yard line as yards remaining to the end zone
4. THE Mini_Scoreboard SHALL display the offense player name and the defense player name
5. THE Mini_Scoreboard SHALL update in real-time as the Drive_State changes after each play resolution

### Requirement 9: Spectator Experience

**User Story:** As a spectator, I want to see all active matchups in a grid and tap into one to watch the drive unfold, so that I stay engaged after elimination.

#### Acceptance Criteria

1. WHILE a player is a Spectator, THE Playcaller_UI SHALL display a grid of all active matchup cards showing player names and current drive progress
2. WHEN a Spectator taps a matchup card in the grid, THE Playcaller_UI SHALL navigate to a read-only drive view showing the Field_Panel and Play_Result_Line for that matchup
3. WHILE a Spectator is viewing a specific matchup, THE Playcaller_UI SHALL hide the Play_Card grid (spectators cannot select plays)
4. WHILE a Spectator is viewing a specific matchup, THE Playcaller_UI SHALL display a back button to return to the matchup grid
5. THE Spectator matchup grid SHALL update in real-time as drive states change across all active matchups

### Requirement 10: Round Header

**User Story:** As a player, I want to see the current round and my opponent prominently, so that I know where I am in the tournament.

#### Acceptance Criteria

1. THE Playcaller_UI header SHALL display the tournament round name (e.g., "Quarterfinal", "Semifinal", "Final")
2. THE Playcaller_UI header SHALL display the opponent player name
3. THE Playcaller_UI header SHALL remain fixed at the top of the gameplay viewport without consuming significant vertical space

### Requirement 11: Drive Completion State

**User Story:** As a player, I want a clear visual outcome when the drive ends, so that I know who won and how.

#### Acceptance Criteria

1. WHEN the drive ends in a touchdown, THE Playcaller_UI SHALL display a touchdown celebration visual on the Field_Panel
2. WHEN the drive ends in a turnover (interception, fumble, or turnover on downs), THE Playcaller_UI SHALL display a turnover indicator on the Field_Panel
3. WHEN the drive completes, THE Playcaller_UI SHALL replace the Play_Card grid with a drive summary showing the final result and key stats (total plays, total yards)
4. WHEN the drive completes, THE Playcaller_UI SHALL signal roundAnimationDone to the game store after the completion animation finishes

### Requirement 12: Animation Framework

**User Story:** As a developer, I want all animations managed through Framer Motion, so that the codebase uses a single consistent animation approach.

#### Acceptance Criteria

1. THE Playcaller_UI SHALL use Framer Motion as the sole animation library for all motion effects (ball movement, card transitions, drawer expansion, result reveals)
2. THE Playcaller_UI SHALL use Framer Motion AnimatePresence for mounting and unmounting animated elements (play cards appearing, result line transitions)
3. THE Playcaller_UI SHALL apply animation variants to Play_Cards for selection feedback (scale, border glow, opacity changes)

### Requirement 13: Theme Integration

**User Story:** As a player, I want the playcaller UI to match the game's retro-casino visual style, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Playcaller_UI SHALL apply the project's existing theme system CSS variables and Tailwind classes for colors, borders, and typography
2. THE Playcaller_UI SHALL use the retro-casino theme as the default visual style
3. THE Play_Card backgrounds, borders, and text styles SHALL be derived from theme tokens rather than hardcoded color values

### Requirement 14: Server Integration

**User Story:** As a developer, I want the UI to consume Drive_State from the existing PlaycallerPlugin server broadcasts, so that the UI reflects the authoritative game state.

#### Acceptance Criteria

1. THE Playcaller_UI SHALL read Drive_State from the room state broadcast provided by the PlaycallerPlugin
2. WHEN the server broadcasts an updated Drive_State, THE Playcaller_UI SHALL re-render affected components (Field_Panel, Mini_Scoreboard, Play_Result_Line) to reflect the new state
3. THE Playcaller_UI SHALL submit play selections to the server using the existing pick submission mechanism (useGameStore submitPick)
4. IF the server does not provide Drive_State (fallback to Phase 1 bracket-only mode), THEN THE Playcaller_UI SHALL render the existing Phase 1 bracket visualization components
