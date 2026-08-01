# Requirements Document

## Introduction

This feature introduces platform-wide lobby bots that automatically fill empty player slots in a game room. The host configures a "Room Size" during room creation, and any slots not occupied by human players are filled by bot personas. Bots make random choices during gameplay, participate in scoring, and are seamlessly swapped in and out as humans join or leave. This ensures every session always has a full roster of entities making choices, regardless of human attendance.

## Glossary

- **Room_Server**: The PartyKit server-side room handler that manages room state, player connections, and game lifecycle
- **Room_Size_Control**: A UI control on the room creation screen that allows the host to set the total number of player slots (humans + bots) for the room
- **Lobby_Bot**: A server-managed virtual player that occupies a player slot not taken by a human, makes automated random picks during gameplay, and participates in scoring
- **Bot_Manager**: The server-side module responsible for creating, removing, and orchestrating Lobby_Bot lifecycle within a room
- **Host**: The human player who created the room and has administrative control
- **PICKING_Phase**: The game phase where all players (human and bot) must submit their choices within the pick window
- **Player_Roster**: The ordered list of all entities (human players and Lobby_Bots) occupying slots in the room

## Requirements

### Requirement 1: Room Size Configuration

**User Story:** As a host, I want to set the total number of player slots when creating a room, so that I can control the session size and ensure gameplay starts with a full roster.

#### Acceptance Criteria

1. WHILE the room is in LOBBY phase and no game has started, THE Room_Size_Control SHALL display a numeric input allowing the host to select a room size between 2 and 10 players inclusive
2. WHEN the host creates a room with a selected room size, THE Room_Server SHALL store the room size as part of the RoomConfig
3. THE Room_Size_Control SHALL default to a room size of 4 players
4. WHEN the host changes the room size value, THE Room_Server SHALL validate that the value is an integer between 2 and 10 inclusive

### Requirement 2: Automatic Bot Population on Room Creation

**User Story:** As a host, I want empty player slots to be automatically filled with bots after I create the room, so that I can immediately start a game without waiting for humans to join.

#### Acceptance Criteria

1. WHEN the host creates a room with a configured room size, THE Bot_Manager SHALL create Lobby_Bots to fill all player slots not occupied by human players
2. WHEN a Lobby_Bot is created, THE Bot_Manager SHALL assign the Lobby_Bot a unique identifier distinguishable from human player IDs
3. WHEN a Lobby_Bot is created, THE Bot_Manager SHALL assign the Lobby_Bot a display name with a "[BOT]" prefix (e.g., "[BOT] Alpha", "[BOT] Bravo")
4. THE Bot_Manager SHALL ensure the total count of human players plus Lobby_Bots equals the configured room size at all times during the LOBBY phase

### Requirement 3: Bot Replacement on Human Join

**User Story:** As a human player joining a room, I want to seamlessly take the next available slot in order, so that I can participate without the room needing to be reconfigured.

#### Acceptance Criteria

1. WHEN a human player joins a room that contains one or more Lobby_Bots, THE Bot_Manager SHALL remove the Lobby_Bot occupying the lowest-numbered available slot and assign the human player to that slot
2. WHEN the host occupies slot 1, THE Bot_Manager SHALL assign the first human player to join to slot 2, the second human player to slot 3, and so on in sequential order
3. WHEN a human player joins a room that contains zero Lobby_Bots and the Player_Roster is at capacity, THE Room_Server SHALL reject the join with a "ROOM_FULL" error
4. WHEN a Lobby_Bot is removed, THE Bot_Manager SHALL remove the Lobby_Bot's scores from the game leaderboard

### Requirement 4: Bot Insertion on Human Departure

**User Story:** As a host, I want a bot to replace any human player who leaves or is kicked, so that the game always maintains the correct number of participants.

#### Acceptance Criteria

1. WHEN a human player disconnects from a room, THE Bot_Manager SHALL create a new Lobby_Bot to occupy the vacated slot
2. WHEN a human player is kicked by the host, THE Bot_Manager SHALL create a new Lobby_Bot to occupy the vacated slot
3. WHEN a new Lobby_Bot is created to replace a departed human, THE Bot_Manager SHALL initialize the Lobby_Bot with a score of zero for the current game
4. IF the host disconnects and no other human players remain, THEN THE Room_Server SHALL retain all Lobby_Bots in the room and suspend game progression until a human reconnects

### Requirement 5: Bot Automated Picks During PICKING Phase

**User Story:** As a host, I want bots to automatically make random choices during the pick phase, so that the game progresses without requiring manual input for bot-held slots.

#### Acceptance Criteria

1. WHEN the PICKING_Phase begins, THE Bot_Manager SHALL submit a valid random pick for each Lobby_Bot within 2 seconds of the phase start
2. WHEN a Lobby_Bot submits a pick for a coin-toss game, THE Bot_Manager SHALL randomly select either "heads" or "tails" with equal probability
3. WHEN a Lobby_Bot submits a pick for a battle-bots game, THE Bot_Manager SHALL randomly select a valid robot from the available robot templates
4. THE Bot_Manager SHALL submit each Lobby_Bot's pick through the same server-side pick processing logic used for human players

### Requirement 6: Bot Participation in Scoring

**User Story:** As a player, I want bots to be scored the same way as humans, so that the leaderboard reflects the full game state including bot performance.

#### Acceptance Criteria

1. THE Room_Server SHALL include Lobby_Bot scores in the game leaderboard alongside human player scores
2. THE Room_Server SHALL include Lobby_Bot session points in the session leaderboard alongside human player session points
3. WHEN a round resolves, THE Room_Server SHALL calculate score deltas for Lobby_Bots using the same scoring logic applied to human players
4. WHEN a Lobby_Bot is removed from the room, THE Room_Server SHALL remove the Lobby_Bot's entries from both the game leaderboard and the session leaderboard

### Requirement 7: Bot Visual Distinction in Lobby

**User Story:** As a player, I want to clearly distinguish bots from human players in the lobby, so that I know which participants are automated.

#### Acceptance Criteria

1. THE Player_Roster display SHALL render Lobby_Bot entries with a "[BOT]" prefix on the display name
2. THE Player_Roster display SHALL render Lobby_Bot entries with a robot icon (🤖) next to the name
3. THE Player_Roster display SHALL visually group human players above Lobby_Bots in the list order
4. WHEN a Lobby_Bot's score or rank changes, THE Player_Roster display SHALL update the Lobby_Bot's entry in real time, consistent with human player updates

### Requirement 8: Room Size Invariant

**User Story:** As a host, I want the room to always maintain exactly the configured number of player slots filled, so that every game round has a predictable participant count.

#### Acceptance Criteria

1. THE Room_Server SHALL maintain the invariant that the total number of entities (human players plus Lobby_Bots) in the Player_Roster equals the configured room size
2. IF a state change causes the Player_Roster count to differ from the configured room size, THEN THE Bot_Manager SHALL add or remove Lobby_Bots to restore the invariant within 1 second
3. WHEN the host changes the room size during the LOBBY phase, THE Bot_Manager SHALL add or remove Lobby_Bots to match the new room size while preserving all existing human players
4. IF the host reduces the room size below the current number of human players, THEN THE Room_Server SHALL reject the room size change with a descriptive error message
