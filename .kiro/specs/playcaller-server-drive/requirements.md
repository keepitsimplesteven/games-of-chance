# Requirements Document

## Introduction

This feature wires the existing drive engine into the PlaycallerPlugin server-side so that when the SKIP_GAMEPLAY setting is false, the server manages per-matchup DriveState objects, broadcasts them to clients, handles play_selection picks on a per-down basis, resolves downs when both players in a matchup submit picks, and advances the bracket when all drives in a round complete. The server implements an internal down loop within each bracket round, using the PICKING phase repeatedly per down rather than per bracket round.

## Glossary

- **PlaycallerPlugin**: The server-side game plugin registered in the GameRegistry that manages the playcaller tournament bracket and round resolution.
- **DriveState**: A data structure representing the current state of a single offensive drive between two players, including yard line, down, yards to go, play history, and completion status.
- **DriveEngine**: The existing module at `packages/server/src/games/playcaller/drive/` exporting `createDriveState`, `resolveDown`, `isDriveComplete`, `getDriveCompletion`, and `selectRandomPlay`.
- **SKIP_GAMEPLAY**: A boolean tuning setting (default true) that controls whether interactive drive mechanics are used or matches resolve randomly.
- **MatchupId**: A string identifier for a specific pairing of two players in the current bracket round.
- **PlaySelection**: A client message of type "play_selection" containing a matchupId and a play identifier (OffensivePlayId or DefensivePlayId).
- **DownLoop**: The internal per-down cycle within a single bracket round where PICKING repeats for each down until all matchup drives complete.
- **PlayClock**: The PICK_WINDOW_MS timer (3000ms) that limits how long players have to submit a play selection per down.
- **BotManager**: The server-side class responsible for managing bot personas and generating bot picks across game types.
- **BracketRound**: A single round of the elimination bracket containing one or more matchups resolved simultaneously.
- **RoomServer**: The PartyKit server class (GameRoom in room.ts) that orchestrates game phases, message handling, and state broadcasting.

## Requirements

### Requirement 1: Drive Initialization

**User Story:** As the server, I want to initialize DriveState objects for each matchup when SKIP_GAMEPLAY is false, so that the interactive drive experience can begin.

#### Acceptance Criteria

1.1. WHEN a bracket round begins and SKIP_GAMEPLAY is false, THE PlaycallerPlugin SHALL create one DriveState per active matchup by calling `createDriveState` with the assigned offense player, defense player, and appropriate seed values.

1.2. WHEN creating DriveState objects for a bracket round, THE PlaycallerPlugin SHALL randomly assign one player as offense and the other as defense for each matchup.

1.3. WHEN DriveState objects are created, THE PlaycallerPlugin SHALL store them in a Record keyed by matchupId and include them in the PlaycallerGameState broadcast to all clients.

1.4. WHILE SKIP_GAMEPLAY is true, THE PlaycallerPlugin SHALL resolve matches using the existing randomResolver without creating DriveState objects and SHALL set driveStates to null in the broadcast.

### Requirement 2: Per-Down Picking Phase

**User Story:** As a player in an active matchup, I want a per-down picking window so that I can choose my offensive or defensive play each down.

#### Acceptance Criteria

2.1. WHEN a down begins in any active matchup, THE RoomServer SHALL enter the PICKING phase with a pickDeadlineMs set to the current time plus PICK_WINDOW_MS (3000ms).

2.2. WHEN the PICKING phase starts for a down, THE RoomServer SHALL broadcast the current DriveState for each matchup so clients can render the field position and down information.

2.3. WHEN a player submits a play_selection message, THE RoomServer SHALL validate that the player belongs to an active matchup, has not already submitted a pick for the current down, and that the play identifier matches the player's assigned role (offensive play for offense, defensive play for defense).

2.4. IF a player submits a play_selection for a matchup the player does not belong to, THEN THE RoomServer SHALL reject the pick with an error message.

2.5. IF a player submits an offensive play while assigned to defense or a defensive play while assigned to offense, THEN THE RoomServer SHALL reject the pick with an error message.

### Requirement 3: Down Resolution

**User Story:** As the server, I want to resolve a down when both players in a matchup have submitted picks, so that the drive advances.

#### Acceptance Criteria

3.1. WHEN both the offense and defense player in a matchup have submitted picks for the current down, THE PlaycallerPlugin SHALL call `resolveDown` with the current DriveState, the offensive play, and the defensive play.

3.2. WHEN a down is resolved, THE PlaycallerPlugin SHALL update the stored DriveState for that matchup with the result from `resolveDown` and broadcast the updated state to all clients.

3.3. WHEN a down is resolved and the drive is not complete, THE RoomServer SHALL begin a new per-down PICKING phase for the next down.

3.4. WHEN all active matchup drives have completed for the current bracket round, THE RoomServer SHALL transition to the RESULT phase for that bracket round.

3.5. WHEN a matchup drive completes before other drives in the same round, THE PlaycallerPlugin SHALL continue the down loop for remaining active matchups and exclude the completed matchup from further picking.

### Requirement 4: Play Clock Expiry

**User Story:** As the server, I want to handle play clock expiry so that the game progresses even if a player does not submit a pick in time.

#### Acceptance Criteria

4.1. WHEN the play clock (PICK_WINDOW_MS) expires and a player has not submitted a pick for the current down, THE RoomServer SHALL assign a random valid play for that player using `selectRandomPlay`.

4.2. WHEN the play clock expires, THE RoomServer SHALL assign random plays only to players who have not yet submitted, preserving picks already submitted by other players.

4.3. WHEN random plays have been assigned for all missing picks in a matchup, THE PlaycallerPlugin SHALL proceed to resolve the down as normal.

### Requirement 5: Bot Pick Generation

**User Story:** As the server, I want bots to automatically submit play selections so that matchups involving bots progress without blocking.

#### Acceptance Criteria

5.1. WHEN a per-down PICKING phase begins and a bot is a participant in an active matchup, THE BotManager SHALL generate a valid play_selection pick for the bot after a short random delay.

5.2. THE BotManager SHALL select a random play from the appropriate play set (offensive plays for offense role, defensive plays for defense role) for the playcaller game type.

5.3. WHEN a bot submits a pick and the opposing player has already submitted, THE RoomServer SHALL resolve the down immediately without waiting for the play clock.

5.4. WHEN the play clock expires and a bot has not yet submitted a pick, THE RoomServer SHALL assign a random valid play for the bot using the same mechanism as human play clock expiry.

### Requirement 6: Bracket Advancement

**User Story:** As the server, I want to advance the bracket when all drives in a round complete, so the tournament progresses.

#### Acceptance Criteria

6.1. WHEN all matchup drives in the current bracket round are complete, THE PlaycallerPlugin SHALL determine the winner of each matchup from the DriveCompletion result and advance the bracket to the next round.

6.2. WHEN the bracket advances to the next round, THE RoomServer SHALL transition to the RESULT phase, broadcast the round results (matchup outcomes), and pause until the host clicks "Next Round."

6.3. WHEN the host sends a START_ROUND message while in the RESULT phase of a playcaller bracket round, THE RoomServer SHALL initialize drives for the next bracket round and begin the down loop.

6.4. WHEN the final bracket round completes and the bracket is complete, THE PlaycallerPlugin SHALL compute final placements and score the tournament using the existing scoreRound logic.

### Requirement 7: State Broadcasting

**User Story:** As a client, I want to receive updated DriveState data after each down resolves, so I can render the drive in real time.

#### Acceptance Criteria

7.1. WHEN a down resolves in any matchup, THE RoomServer SHALL broadcast the full PlaycallerGameState including the updated driveStates Record to all connected clients.

7.2. THE PlaycallerGameState broadcast SHALL include the bracket structure, spectator list, active competitor list, and driveStates (when SKIP_GAMEPLAY is false).

7.3. WHEN a new client connects mid-drive, THE RoomServer SHALL send the current PlaycallerGameState including all in-progress DriveState objects via the STATE_SYNC message.

### Requirement 8: Per-Down Loop Integration with Room Lifecycle

**User Story:** As the server, I want the per-down loop to work within the existing room phase system without conflicting with the standard resolveRound flow.

#### Acceptance Criteria

8.1. WHILE SKIP_GAMEPLAY is false and a bracket round is in progress, THE RoomServer SHALL use playcaller-specific per-down resolution logic instead of calling the standard resolveRound method.

8.2. WHEN SKIP_GAMEPLAY is false, THE PlaycallerPlugin resolveRound method SHALL not be called for individual downs; bracket advancement SHALL occur only when all drives in the round are complete.

8.3. WHEN entering a new bracket round with SKIP_GAMEPLAY false, THE RoomServer SHALL skip the standard beginRound flow and enter the playcaller down loop directly.

8.4. THE RoomServer SHALL maintain a separate per-down deadline timer that resets after each down resolves, independent of the standard round deadline timer.

### Requirement 9: Pick Immutability Per Down

**User Story:** As the server, I want to ensure each player can only submit one pick per down, preventing duplicate submissions.

#### Acceptance Criteria

9.1. WHEN a player has already submitted a pick for the current down in their matchup, THE RoomServer SHALL silently ignore subsequent play_selection messages from that player for the same down.

9.2. WHEN a new down begins, THE RoomServer SHALL clear all recorded picks for the previous down so players can submit fresh selections.

### Requirement 10: Offense/Defense Role Assignment

**User Story:** As the server, I want offense and defense roles assigned per matchup so players know which play set to select from.

#### Acceptance Criteria

10.1. WHEN initializing drives for a bracket round, THE PlaycallerPlugin SHALL assign offense and defense roles randomly for each matchup (random selection between the two players).

10.2. THE PlaycallerPlugin SHALL include the offense and defense player assignments in the DriveState broadcast so clients can determine which play set to display.

10.3. THE offense and defense roles SHALL remain fixed for the duration of a single matchup drive (roles do not swap between downs).
