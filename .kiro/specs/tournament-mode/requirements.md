# Requirements Document

## Introduction

Tournament Mode introduces a second, independent gameplay toggle on the room creation screen alongside the existing "Chips" vs "Grand Prix" scoring mode. The new toggle selects between "Endless" mode (current unrestricted behavior) and "Tournament" mode (structured progression where games are played once, then locked, culminating in a finale game that ends the session). The system is designed to be plugin-agnostic, with a generic unlock criteria harness that determines availability for each registered game plugin.

## Glossary

- **Lobby**: The room instance where players gather and games are selected/played
- **Progression_Mode**: The gameplay mode toggle ("endless" or "tournament") selected at room creation, independent of Scoring_Mode
- **Scoring_Mode**: The existing "chips" or "grand-prix" toggle that determines how points accumulate
- **Game_Plugin**: A registered game implementation in the GameRegistry (e.g., coin-toss, battle-bots, big-wheel)
- **Unlock_Criteria**: A set of conditions defined per Game_Plugin that determine whether the game is available for play in Tournament mode
- **Locked_Game**: A Game_Plugin that has been completed in the current Tournament session and cannot be played again
- **Finale_Game**: A Game_Plugin designated as the final game in Tournament mode, playable only after all prerequisite games are completed
- **END_State**: A terminal lobby state reached after the Finale_Game completes, displaying final results
- **Game_Tile**: A UI element in the GameTileGrid representing a selectable Game_Plugin
- **Unlock_Criteria_Harness**: The extensible system that evaluates whether each Game_Plugin is currently playable based on its registered Unlock_Criteria
- **Tournament_Progress**: The server-side record of which games have been completed in the current Tournament session

## Requirements

### Requirement 1: Progression Mode Selection at Room Creation

**User Story:** As a host, I want to choose between Endless and Tournament progression modes when creating a room, so that I can control whether games have structured progression or unrestricted play.

#### Acceptance Criteria

1. THE Landing_Page SHALL display a "Progression Mode" toggle with two options: "Endless" and "Tournament", independent of the Scoring_Mode toggle
2. WHEN the host selects "Endless", THE Lobby SHALL store "endless" as the Progression_Mode in the room configuration
3. WHEN the host selects "Tournament", THE Lobby SHALL store "tournament" as the Progression_Mode in the room configuration
4. THE Landing_Page SHALL default the Progression_Mode selection to "Endless"
5. WHEN a room is created, THE Room_Config SHALL include the selected Progression_Mode alongside the existing Scoring_Mode

### Requirement 2: Endless Mode Behavior

**User Story:** As a player, I want Endless mode to behave exactly as the current system does, so that existing gameplay is preserved without restriction.

#### Acceptance Criteria

1. WHILE Progression_Mode is "endless", THE Lobby SHALL allow all active Game_Plugins to be selected without restriction
2. WHILE Progression_Mode is "endless", THE Lobby SHALL allow any Game_Plugin to be played multiple times
3. WHILE Progression_Mode is "endless", THE Lobby SHALL remain in an active state indefinitely with no terminal condition

### Requirement 3: Tournament Mode Game Locking

**User Story:** As a player, I want each game in Tournament mode to be playable only once, so that the tournament progresses through all available games.

#### Acceptance Criteria

1. WHILE Progression_Mode is "tournament", THE Server SHALL maintain a Tournament_Progress record tracking which Game_Plugins have been completed
2. WHEN a game ends in Tournament mode, THE Server SHALL mark that Game_Plugin as locked in the Tournament_Progress record
3. WHILE a Game_Plugin is marked as locked, THE Lobby SHALL prevent that Game_Plugin from being selected or started
4. WHILE a Game_Plugin is marked as locked, THE Game_Tile SHALL display a locked visual indicator to all players

### Requirement 4: Unlock Criteria Harness

**User Story:** As a developer, I want a generic unlock criteria system integrated with the GameRegistry, so that each game plugin can define its own availability conditions for Tournament mode.

#### Acceptance Criteria

1. THE Unlock_Criteria_Harness SHALL evaluate unlock conditions for each registered Game_Plugin when the Lobby is in Tournament mode
2. THE Unlock_Criteria_Harness SHALL accept a function per Game_Plugin that receives the current Tournament_Progress and returns a boolean indicating whether the game is playable
3. WHEN the Unlock_Criteria_Harness determines a Game_Plugin is not playable, THE Game_Tile SHALL display that game as unavailable
4. THE Unlock_Criteria_Harness SHALL re-evaluate all Game_Plugin availability after each game completion
5. IF a Game_Plugin does not define custom Unlock_Criteria, THEN THE Unlock_Criteria_Harness SHALL default to allowing the game when it has not been previously played in the current tournament

### Requirement 5: Finale Game Designation

**User Story:** As a host, I want a finale game that is only available after all other games are completed, so that the tournament builds toward a climactic ending.

#### Acceptance Criteria

1. THE Game_Plugin interface SHALL support a "finale" designation flag indicating the game is a Finale_Game
2. WHILE any non-finale Game_Plugin remains unplayed in the current tournament, THE Unlock_Criteria_Harness SHALL mark the Finale_Game as unavailable
3. WHEN all non-finale Game_Plugins have been completed, THE Unlock_Criteria_Harness SHALL mark the Finale_Game as available for play
4. THE Game_Tile for a Finale_Game SHALL display distinct visual treatment indicating it is the finale

### Requirement 6: Lobby END State Transition

**User Story:** As a player, I want the lobby to transition to a final results screen after the finale game ends, so that the tournament has a definitive conclusion with celebration.

#### Acceptance Criteria

1. WHEN the Finale_Game ends in Tournament mode, THE Server SHALL transition the Lobby to the END_State
2. WHILE the Lobby is in END_State, THE Server SHALL prevent any new games from being started
3. WHILE the Lobby is in END_State, THE Client SHALL display the final session leaderboard as the definitive tournament results
4. WHILE the Lobby is in END_State, THE Client SHALL display celebratory visual presentation (animation, fanfare) for the tournament winner
5. THE END_State SHALL be a terminal state from which the Lobby does not return to active game selection

### Requirement 7: Tournament Progress Synchronization

**User Story:** As a player, I want to see which games have been played, which are available, and which are locked, so that I understand the tournament progression at a glance.

#### Acceptance Criteria

1. THE Server SHALL include the Tournament_Progress in the STATE_SYNC payload broadcast to all clients
2. WHEN the client receives a STATE_SYNC with Tournament_Progress, THE GameTileGrid SHALL update each Game_Tile to reflect its current status (available, locked, or unavailable)
3. THE GameTileGrid SHALL distinguish between three tile states in Tournament mode: playable, locked (already played), and unavailable (unlock criteria not met)

### Requirement 8: Plugin-Agnostic Design

**User Story:** As a developer, I want the tournament system to work with any number of game plugins without hardcoding game-specific logic, so that new games can be added without modifying the tournament infrastructure.

#### Acceptance Criteria

1. THE Unlock_Criteria_Harness SHALL derive the total game count and completion status from the GameRegistry dynamically
2. THE Unlock_Criteria_Harness SHALL operate correctly when Game_Plugins are added or removed from the GameRegistry
3. THE Tournament_Progress tracking SHALL use Game_Plugin identifiers from the GameRegistry rather than hardcoded game type strings
4. WHEN a new Game_Plugin is registered, THE Unlock_Criteria_Harness SHALL include the new plugin in tournament progression without code changes to the harness
