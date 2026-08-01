# Requirements Document

## Introduction

The Host Control Panel is a full-screen panel accessible exclusively to the host player, serving as a centralized command interface for room administration during an active session. The panel is available at every game phase (LOBBY, PICKING, RESOLVING, RESULT) and provides actions such as kicking players, reassigning the host role, and manually adjusting scores. The panel architecture follows a registry/plugin pattern so new host actions can be added without modifying the panel scaffold — functioning as a command palette for the host.

## Glossary

- **Host_Control_Panel**: The full-screen UI panel accessible only to the host, providing centralized room administration actions across all game phases
- **Host**: The player with `role: "host"` in the room state; the only user authorized to open and use the Host_Control_Panel
- **Action_Registry**: A client-side registry that maps action identifiers to their UI components and metadata, enabling new host actions to be added without modifying the panel scaffold
- **Host_Action**: A discrete command registered in the Action_Registry, consisting of an identifier, label, icon, availability predicate, and execution handler
- **Kick_Player**: A Host_Action that removes a target player from the room by sending a KICK_PLAYER message to the server
- **Reassign_Host**: A Host_Action that promotes a target connected player to the host role and demotes the current host to a regular player
- **Score_Adjustment**: A Host_Action that adds or subtracts points from a target player's game score or session score, with the adjustment logged and visible to all players
- **Adjustment_Log**: A record of all Score_Adjustment operations performed, including the target player, delta amount, score type, timestamp, and reason; broadcast to all clients via STATE_SYNC
- **Game_Score**: The cumulative score a player has earned within the current active game instance; resets when a new game begins
- **Session_Score**: The cumulative points a player has earned across all games in the current session; persists until the room is destroyed
- **RoomState**: The server-authoritative state object broadcast to all clients via STATE_SYNC after any state change

## Requirements

### Requirement 1: Panel Access and Visibility

**User Story:** As the host, I want a dedicated full-screen control panel accessible at any game phase, so that I can manage the room without being restricted to a specific phase.

#### Acceptance Criteria

1. THE Host_Control_Panel SHALL be accessible to the host via a persistent UI trigger visible at all game phases (LOBBY, PICKING, RESOLVING, RESULT)
2. WHEN a non-host player attempts to access the Host_Control_Panel, THE system SHALL block access and not render the panel trigger
3. WHEN the host opens the Host_Control_Panel, THE system SHALL display the panel as a full-screen overlay optimized for mobile viewports
4. WHEN the host closes the Host_Control_Panel, THE system SHALL return to the previous game view without disrupting game state
5. WHILE the Host_Control_Panel is open, THE system SHALL continue to receive and process STATE_SYNC messages so the panel reflects current room state

### Requirement 2: Kick Player Action

**User Story:** As the host, I want to remove a player from the room, so that I can manage disruptive participants during a session.

#### Acceptance Criteria

1. WHEN the host selects Kick_Player and chooses a target player, THE Host_Control_Panel SHALL send a KICK_PLAYER message to the server with the target player ID
2. WHEN the server receives a KICK_PLAYER message from the host, THE server SHALL remove the target player from the room state players list
3. WHEN the server removes a kicked player, THE server SHALL close the WebSocket connection for the kicked player
4. WHEN the server removes a kicked player, THE server SHALL broadcast an updated STATE_SYNC to all remaining connected clients
5. IF a non-host player sends a KICK_PLAYER message, THEN THE server SHALL reject the message and return a NOT_HOST error
6. THE Kick_Player action SHALL display only connected players (excluding the host) as valid kick targets
7. WHILE the game phase is PICKING and the kicked player had not submitted a pick, THE server SHALL re-evaluate whether all remaining connected players have picked and resolve the round early if true

### Requirement 3: Reassign Host Action

**User Story:** As the host, I want to promote another connected player to the host role, so that I can hand off room control without leaving the session.

#### Acceptance Criteria

1. WHEN the host selects Reassign_Host and chooses a target player, THE Host_Control_Panel SHALL send a REASSIGN_HOST message to the server with the target player ID
2. WHEN the server receives a REASSIGN_HOST message from the current host, THE server SHALL set the target player role to "host" and set the sender role to "player"
3. WHEN the server completes a host reassignment, THE server SHALL broadcast an updated STATE_SYNC to all connected clients reflecting the new host
4. IF a non-host player sends a REASSIGN_HOST message, THEN THE server SHALL reject the message and return a NOT_HOST error
5. IF the target player of a REASSIGN_HOST message is not connected, THEN THE server SHALL reject the message and return an INVALID_TARGET error
6. THE Reassign_Host action SHALL display only connected non-host players as valid reassignment targets
7. WHEN the current host is demoted to player after reassignment, THE Host_Control_Panel SHALL close automatically and the panel trigger SHALL no longer be visible to the demoted player

### Requirement 4: Manual Score Adjustment Action

**User Story:** As the host, I want to manually add or subtract points from any player's game score or session score, so that I can correct errors or apply custom rewards and penalties during a session.

#### Acceptance Criteria

1. WHEN the host selects Score_Adjustment, THE Host_Control_Panel SHALL display all players in the room as valid targets with the option to select game score or session score
2. WHEN the host submits a Score_Adjustment, THE Host_Control_Panel SHALL send an ADJUST_SCORE message to the server containing the target player ID, delta amount (positive or negative integer), score type ("game" or "session"), and an optional reason string
3. WHEN the server receives an ADJUST_SCORE message from the host, THE server SHALL apply the delta to the specified score for the target player
4. WHEN the server applies a Score_Adjustment, THE server SHALL append an entry to the Adjustment_Log containing the target player ID, delta, score type, timestamp, and reason
5. WHEN the server applies a Score_Adjustment, THE server SHALL broadcast an updated STATE_SYNC to all connected clients with the modified scores and the updated Adjustment_Log
6. IF a non-host player sends an ADJUST_SCORE message, THEN THE server SHALL reject the message and return a NOT_HOST error
7. THE Score_Adjustment UI SHALL require the host to confirm the adjustment before sending, displaying the target player name, delta value, and score type in the confirmation prompt
8. WHEN a Score_Adjustment is applied, THE client SHALL display a visible notification to all players indicating the adjustment (target player, delta, score type)

### Requirement 5: Extensible Action Registry

**User Story:** As a developer, I want the Host Control Panel to use a registry pattern for actions, so that new host commands can be added without modifying the panel scaffold component.

#### Acceptance Criteria

1. THE Action_Registry SHALL allow registration of Host_Action entries, each specifying an identifier, display label, icon component, an availability predicate function, and an execution handler
2. THE Host_Control_Panel scaffold SHALL render registered Host_Action entries dynamically from the Action_Registry without hard-coded references to specific actions
3. WHEN a Host_Action availability predicate returns false for the current room state, THE Host_Control_Panel SHALL hide or disable that action in the panel
4. THE Action_Registry SHALL maintain insertion order so that registered actions appear in a predictable sequence in the panel
5. WHEN a new Host_Action is registered in the Action_Registry, THE Host_Control_Panel SHALL display the new action without requiring changes to the panel scaffold component
6. THE Action_Registry SHALL enforce unique identifiers; registering a duplicate identifier SHALL overwrite the previous entry

### Requirement 6: Server Authorization Pattern

**User Story:** As a developer, I want all host-control messages to follow the existing authorization pattern, so that the server-side implementation is consistent and secure.

#### Acceptance Criteria

1. THE server SHALL validate that the sender of any host-control message (KICK_PLAYER, REASSIGN_HOST, ADJUST_SCORE) is the current host by comparing the sender connection ID against the host player's connection ID
2. IF an unauthorized player sends a host-control message, THEN THE server SHALL return an ERROR message with code "NOT_HOST" and a descriptive message
3. WHEN the server processes a host-control message successfully, THE server SHALL broadcast a STATE_SYNC message to all connected clients
4. THE server handler for REASSIGN_HOST and ADJUST_SCORE messages SHALL follow the same dispatch pattern used by existing message handlers (KICK_PLAYER, START_ROUND, END_GAME) in the room server

