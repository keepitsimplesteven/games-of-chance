# Requirements Document

## Introduction

The Game Settings feature provides a pre-game configuration screen accessible only to the host in the LOBBY phase. It allows the host to configure game rules (round count, pick window duration, scoring mode, auto-mode, and per-game tuning constants) before starting a game. Each GamePlugin declares a configuration schema that the UI renders generically, so new games get a settings panel for free. Settings are locked once the first round starts (START_ROUND) and can be changed between games without recreating the room.

## Glossary

- **Host**: The player with role "host" who controls game flow and settings
- **Settings_Panel**: The UI component that renders the game configuration form for the host
- **Settings_Schema**: A declarative description of configurable fields that a GamePlugin exposes, including field type, label, default value, and validation constraints
- **Game_Settings**: The resolved configuration values for the current game, derived from the Settings_Schema defaults overridden by host selections
- **Room_Server**: The PartyServer instance (GameRoom) that manages room state and broadcasts updates
- **GamePlugin**: A server-side module implementing game logic (picks, resolution, scoring) for a specific game type
- **GameRegistry**: The singleton registry that maps game type identifiers to their GamePlugin implementations
- **LOBBY_Phase**: The room phase before a game starts or after a game ends, during which settings are editable
- **Active_Phase**: Any phase other than LOBBY (PICKING, RESOLVING, RESULT) during which settings are locked
- **Settings_Lock**: The constraint that prevents setting modifications while a game is in progress

## Requirements

### Requirement 1: Plugin Configuration Schema Declaration

**User Story:** As a game plugin author, I want to declare which constants are configurable via a schema, so that the platform automatically generates a settings UI without per-game custom code.

#### Acceptance Criteria

1. THE GamePlugin interface SHALL include an optional `settingsSchema` property that describes configurable fields
2. WHEN a GamePlugin provides a settingsSchema, THE Settings_Schema SHALL include for each field: a unique key, display label, field type (number, boolean, or select), default value, and optional validation constraints (min, max, step for numbers; options list for select)
3. WHEN a GamePlugin does not provide a settingsSchema, THE Settings_Panel SHALL display no game-specific settings for that game type
4. THE Settings_Schema field keys SHALL correspond to the tuning constant names in the plugin's constants file

### Requirement 2: Round Count Configuration

**User Story:** As a host, I want to configure the number of rounds per game, so that I can run shorter or longer sessions based on player preference.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a round count input with the current value from Game_Settings
2. WHEN the host changes the round count value, THE Room_Server SHALL update the Game_Settings with the new round count
3. THE Game_Settings round count SHALL have a minimum value of 1 and a maximum value of 50
4. THE Game_Settings round count SHALL default to the value defined in the active GamePlugin's constants (e.g., COIN_TOSS.MAX_ROUNDS = 10)

### Requirement 3: Pick Window Duration Configuration

**User Story:** As a host, I want to configure how long players have to submit picks each round, so that I can adjust pacing for different group sizes.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a pick window duration input showing the value in seconds
2. WHEN the host changes the pick window duration, THE Room_Server SHALL update the Game_Settings with the new duration in milliseconds
3. THE Game_Settings pick window duration SHALL have a minimum value of 3000ms (3 seconds) and a maximum value of 60000ms (60 seconds)
4. THE Game_Settings pick window duration SHALL default to the value defined in the active GamePlugin's pickWindowMs property
5. WHEN a round starts, THE Room_Server SHALL use the configured pick window duration from Game_Settings instead of the hardcoded plugin constant

### Requirement 4: Scoring Mode Selection

**User Story:** As a host, I want to change the scoring mode between games without recreating the room, so that the group can try different scoring strategies.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a scoring mode selector with options "Grand Prix" and "Chips"
2. WHEN the host changes the scoring mode, THE Room_Server SHALL update the RoomConfig scoringMode field
3. THE Settings_Panel SHALL display the current scoringMode value from RoomConfig as the selected option
4. WHEN a new game starts after a scoring mode change, THE Room_Server SHALL apply the updated scoring mode for session score calculations

### Requirement 5: Auto-Mode Toggle and Interval Configuration

**User Story:** As a host, I want to enable auto-mode and set the round interval from the settings panel, so that games can run hands-free at a configurable pace.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display an auto-mode toggle reflecting the current autoMode value from RoomConfig
2. WHEN the host enables auto-mode, THE Settings_Panel SHALL reveal an interval input for configuring the delay between rounds
3. WHEN the host changes the auto-mode toggle or interval, THE Room_Server SHALL process a SET_AUTO_MODE message with the updated enabled state and intervalMs
4. THE auto-mode interval SHALL have a minimum value of 1000ms (1 second) and a maximum value of 30000ms (30 seconds)
5. THE auto-mode interval SHALL default to the current autoRoundIntervalMs value from RoomConfig (5000ms)

### Requirement 6: Per-Game Tuning Constants

**User Story:** As a host, I want to adjust game-specific scoring and balance values (e.g., points per correct guess, streak multiplier) before starting a game, so that I can customize the experience.

#### Acceptance Criteria

1. WHEN a GamePlugin's settingsSchema exposes tuning constant fields, THE Settings_Panel SHALL render an input for each exposed field using the schema-defined type, label, and constraints
2. WHEN the host changes a tuning constant value, THE Room_Server SHALL store the updated value in Game_Settings
3. WHEN a round is resolved, THE GamePlugin SHALL use the configured tuning constant values from Game_Settings instead of the hardcoded defaults
4. THE Settings_Panel SHALL group tuning constant fields under a collapsible "Game Tuning" section with the game type name as heading

### Requirement 7: Settings Lock During Active Game

**User Story:** As a host, I want settings to be locked once a game starts, so that rules remain consistent throughout a game and players have a fair experience.

#### Acceptance Criteria

1. WHEN the room phase transitions from LOBBY to PICKING (first START_ROUND), THE Room_Server SHALL lock all Game_Settings for the duration of the game
2. WHILE the room phase is in Active_Phase (PICKING, RESOLVING, or RESULT), THE Settings_Panel SHALL display all settings as read-only with a visual lock indicator
3. WHILE the room phase is in Active_Phase, THE Room_Server SHALL reject any UPDATE_SETTINGS messages and return an error with code "SETTINGS_LOCKED"
4. WHEN the room phase transitions back to LOBBY (via END_GAME), THE Room_Server SHALL unlock all Game_Settings for editing
5. WHEN settings are unlocked after a game ends, THE Settings_Panel SHALL restore interactive editing controls for the host

### Requirement 8: Host-Only Access Control

**User Story:** As a player, I want only the host to be able to change game settings, so that one person controls the rules and the game setup is not disrupted.

#### Acceptance Criteria

1. WHILE the current player's role is "player" (non-host), THE Settings_Panel SHALL NOT be rendered
2. WHEN a non-host player sends an UPDATE_SETTINGS message, THE Room_Server SHALL reject the message and return an error with code "NOT_HOST"
3. THE Settings_Panel SHALL be rendered only for the player whose role is "host"

### Requirement 9: Settings Persistence Within Session

**User Story:** As a host, I want my settings choices to persist between games in the same room session, so that I do not have to reconfigure after every game ends.

#### Acceptance Criteria

1. WHEN a game ends and the room returns to LOBBY phase, THE Room_Server SHALL retain the previously configured Game_Settings values
2. WHEN the host starts a new game without changing settings, THE Room_Server SHALL apply the previously configured Game_Settings
3. WHEN the host changes the game type in the lobby, THE Room_Server SHALL reset game-specific tuning constants to the new GamePlugin's schema defaults while retaining shared settings (round count, scoring mode, auto-mode)

### Requirement 10: Settings State Synchronization

**User Story:** As a player, I want to see the current game settings reflected in the room state, so that I know the rules before the game begins.

#### Acceptance Criteria

1. WHEN the host updates any setting, THE Room_Server SHALL broadcast an updated STATE_SYNC message containing the current Game_Settings to all connected clients
2. THE RoomState payload SHALL include the resolved Game_Settings so all clients can display current configuration
3. WHEN a new player joins the room, THE Room_Server SHALL send a STATE_SYNC containing the current Game_Settings as part of the initial state

### Requirement 11: Generic Schema-Driven UI Rendering

**User Story:** As a platform developer, I want the settings UI to render from the schema automatically, so that adding new configurable fields or new game types requires no UI code changes.

#### Acceptance Criteria

1. THE Settings_Panel SHALL iterate over the active GamePlugin's settingsSchema fields and render an appropriate input control for each field type (number input for "number", toggle for "boolean", dropdown for "select")
2. WHEN a new GamePlugin is registered with a settingsSchema, THE Settings_Panel SHALL render its settings without any code changes to the settings UI component
3. THE Settings_Panel SHALL validate user input against the schema-defined constraints (min, max, step) and prevent submission of invalid values
4. IF the host enters a value outside the schema-defined constraints, THEN THE Settings_Panel SHALL display an inline validation message and revert to the nearest valid value

### Requirement 12: Mobile-First Settings Layout

**User Story:** As a host on a mobile device, I want the settings panel to be easily usable on small screens, so that I can configure games without difficulty.

#### Acceptance Criteria

1. THE Settings_Panel SHALL use a single-column stacked layout optimized for viewports 320px wide and above
2. THE Settings_Panel SHALL use touch-friendly input controls with a minimum tap target size of 44x44 pixels
3. THE Settings_Panel SHALL be accessible from the lobby screen without navigating to a separate page or route
