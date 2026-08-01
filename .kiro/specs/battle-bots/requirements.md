# Requirements Document

## Introduction

Battle Bots is a 3-round competitive game plugin for the Games of Chance platform. Players select robot combatants in a prep phase, then watch them fight in automated 1v1 battles followed by free-for-all elimination rounds. The game uses a server-side tick-based combat simulation with configurable stats (HP, accuracy, damage range). Final rankings are determined by elimination order across winners and losers brackets, integrating with the platform's Grand Prix and Chips scoring modes.

## Glossary

- **Battle_Bots_Plugin**: The GamePlugin implementation for the Battle Bots game, registered in the GameRegistry with gameType "battle-bots"
- **Robot**: A combatant entity with stats (HP, accuracy, damage range) that participates in battles; V1 uses a single template with identical stats for all instances
- **Robot_Template**: A data structure defining a robot's base stats (HP, accuracy percentage, damage min, damage max) and visual identifier; V1 contains one template, but the architecture supports a collection of individually-tuned templates
- **Prep_Phase**: Round 1 of the game where each player selects one robot from a set of 3 randomly generated options within a configurable time window
- **Battle_Phase**: Round 2 of the game where players are randomly paired for concurrent 1v1 battles resolved via tick-based simulation
- **FFA_Phase**: Round 3 of the game where winners and losers from the Battle Phase fight in separate free-for-all brackets to determine final rankings
- **Tick**: A discrete simulation step (default 250ms interval) during which each living robot performs one attack action
- **Bot_Persona**: A system-generated fake player added when an odd number of players are present, to ensure even pairing; distinct from the robot combatants
- **Winners_Bracket**: The FFA group composed of players who won their 1v1 battle in Round 2, competing for top rankings (1st through N/2)
- **Losers_Bracket**: The FFA group composed of players who lost their 1v1 battle in Round 2, competing for bottom rankings (N/2+1 through N)
- **Elimination_Order**: The sequence in which robots are knocked out during an FFA battle; last standing ranks highest within the bracket
- **Accuracy_Roll**: A random number generated on a 1-100 scale each tick to determine whether an attack connects, compared against the robot's accuracy percentage
- **Tick_Update**: A server-to-client message containing HP changes for all active battles after each simulation tick

## Requirements

### Requirement 1: Plugin Registration and Configuration

**User Story:** As a host, I want to select Battle Bots as a game type from the lobby, so that I can run a robot battle game with configurable settings.

#### Acceptance Criteria

1. THE Battle_Bots_Plugin SHALL register in the GameRegistry with gameType "battle-bots"
2. THE Battle_Bots_Plugin SHALL expose a settingsSchema containing tuning fields for prep timer duration (default 60000ms), bot HP (default 100), damage range minimum (default 1), damage range maximum (default 10), accuracy percentage (default 80), and chips-per-position multiplier (default 10)
3. THE Battle_Bots_Plugin SHALL set roundCount to 3 and pickWindowMs to 60000
4. THE Battle_Bots_Plugin SHALL implement the GamePlugin interface methods: validatePick, resolveRound, scoreRound, and computeGameLeaderboard

### Requirement 2: Robot Data Structure

**User Story:** As a developer, I want an extensible robot data structure that supports individual stat tuning per template, so that future versions can offer diverse robot choices with meaningful gameplay differences.

#### Acceptance Criteria

1. THE Robot_Template SHALL contain fields for: unique identifier, display name, HP, accuracy percentage, damage minimum, damage maximum, and a visual identifier
2. THE Battle_Bots_Plugin SHALL store Robot_Templates in a collection data structure that supports multiple entries with individual stat values
3. WHEN generating robot options for a player in the Prep_Phase, THE Battle_Bots_Plugin SHALL create 3 Robot instances from the available Robot_Template collection
4. FOR V1, THE Battle_Bots_Plugin SHALL use a single Robot_Template with stats derived from the active game settings (HP, accuracy, damage range from settingsSchema)

### Requirement 3: Prep Phase (Round 1)

**User Story:** As a player, I want to choose my battle robot from a set of options before combat begins, so that I feel engaged in the selection process.

#### Acceptance Criteria

1. WHEN Round 1 enters the PICKING phase, THE Battle_Bots_Plugin SHALL generate 3 Robot options per player using the Robot_Template collection and send the options to each respective player
2. WHEN a player submits a pick during the Prep_Phase, THE Battle_Bots_Plugin SHALL validate that the pick references one of the 3 Robot options assigned to that player
3. WHEN the prep timer expires and a player has not submitted a pick, THE Battle_Bots_Plugin SHALL randomly select one of the 3 assigned Robot options for that player
4. WHEN an odd number of players are present at the start of Round 1, THE Battle_Bots_Plugin SHALL create a Bot_Persona with a generated name, assign the Bot_Persona 3 Robot options, and randomly select one on the Bot_Persona's behalf
5. WHEN only 1 player is present, THE Battle_Bots_Plugin SHALL create a Bot_Persona to serve as their opponent in the Battle_Phase

### Requirement 4: Player Pairing for 1v1 Battles (Round 2 Setup)

**User Story:** As a player, I want to be randomly matched against another player for a 1v1 robot battle, so that matchups feel fair and unpredictable.

#### Acceptance Criteria

1. WHEN Round 2 begins, THE Battle_Bots_Plugin SHALL randomly pair all participants (players and Bot_Personas) into 1v1 matchups
2. THE Battle_Bots_Plugin SHALL ensure each participant appears in exactly one pairing
3. WHEN the total participant count is odd due to a Bot_Persona addition failure, THE Battle_Bots_Plugin SHALL return an error indicating pairing is impossible

### Requirement 5: Tick-Based Battle Simulation (1v1)

**User Story:** As a player, I want to watch my robot fight in a real-time tick-based battle, so that combat feels dynamic and exciting.

#### Acceptance Criteria

1. WHEN a 1v1 battle begins, THE Battle_Bots_Plugin SHALL initialize both robots with HP equal to the configured bot HP setting
2. THE Battle_Bots_Plugin SHALL advance the battle simulation by one tick at a configurable interval (default 250ms)
3. WHEN a tick is processed, THE Battle_Bots_Plugin SHALL perform an Accuracy_Roll for each living robot by generating a random integer from 1 to 100 and comparing the result against the robot's accuracy percentage
4. WHEN an Accuracy_Roll result is less than or equal to the robot's accuracy percentage, THE Battle_Bots_Plugin SHALL deal random damage to the opponent within the configured damage range (minimum to maximum, inclusive)
5. WHEN exactly one robot's HP reaches 0 or below, THE Battle_Bots_Plugin SHALL declare the opposing robot the winner and end that battle
6. WHEN both robots reach 0 HP or below on the same tick (simultaneous KO), THE Battle_Bots_Plugin SHALL perform up to 3 additional tiebreaker rolls where each robot attacks the other using normal accuracy and damage rules
7. IF after 3 tiebreaker rolls both robots are still at 0 HP or both survived equally, THE Battle_Bots_Plugin SHALL perform a 50/50 coin-flip roll to eliminate one robot while leaving the other's HP unchanged from before the tiebreaker
8. THE Battle_Bots_Plugin SHALL run all 1v1 battles concurrently within the same tick loop
9. AFTER each tick, THE Battle_Bots_Plugin SHALL emit a Tick_Update to all connected clients containing the current HP values for all active battles

### Requirement 6: 1v1 Battle Results and Scoring

**User Story:** As a player, I want to see the outcome of my 1v1 battle and know my standing before the final round, so that I understand the stakes for the free-for-all.

#### Acceptance Criteria

1. WHEN all 1v1 battles have concluded, THE Battle_Bots_Plugin SHALL transition the round to the RESULT phase
2. THE Battle_Bots_Plugin SHALL assign 1 intermediate point to each 1v1 winner and 0 points to each loser
3. THE Battle_Bots_Plugin SHALL categorize each participant as a winner or loser for bracket assignment in the FFA_Phase
4. WHILE in the RESULT phase after Round 2, THE Battle_Bots_Plugin SHALL display each battle's outcome (winner/loser per matchup) to all players
5. WHEN the host sends START_ROUND after the Round 2 RESULT phase, THE Battle_Bots_Plugin SHALL advance to Round 3 (FFA_Phase)

### Requirement 7: Free-For-All Battle Simulation (Round 3)

**User Story:** As a player, I want to compete in a free-for-all elimination battle with players of similar skill, so that final rankings feel earned and competitive.

#### Acceptance Criteria

1. WHEN Round 3 begins, THE Battle_Bots_Plugin SHALL create two FFA brackets: a Winners_Bracket containing all Round 2 winners, and a Losers_Bracket containing all Round 2 losers
2. THE Battle_Bots_Plugin SHALL initialize each robot in the FFA brackets with full HP equal to the configured bot HP setting
3. WHEN a FFA tick is processed, THE Battle_Bots_Plugin SHALL have each living robot select one random living target from the other robots in the same bracket
4. WHEN a FFA tick is processed, THE Battle_Bots_Plugin SHALL perform an Accuracy_Roll for each living robot and deal damage to the selected target when the roll succeeds
5. WHEN a robot's HP reaches 0 or below during a FFA tick, THE Battle_Bots_Plugin SHALL remove that robot from the living target pool for subsequent ticks
6. WHEN multiple robots reduce the same target to 0 HP in the same tick, THE Battle_Bots_Plugin SHALL resolve all attacks for that tick before removing eliminated robots (overkill is permitted within a single tick)
7. WHEN only one robot remains alive in a bracket, THE Battle_Bots_Plugin SHALL end the FFA for that bracket
8. THE Battle_Bots_Plugin SHALL run both FFA brackets concurrently using the same tick interval as 1v1 battles
9. AFTER each FFA tick, THE Battle_Bots_Plugin SHALL emit a Tick_Update to all connected clients containing current HP values for all living robots in both brackets

### Requirement 8: Final Ranking Determination

**User Story:** As a player, I want my final ranking to reflect both my 1v1 performance and my FFA survival, so that the overall game result feels comprehensive and fair.

#### Acceptance Criteria

1. WHEN both FFA brackets have concluded, THE Battle_Bots_Plugin SHALL determine final rankings using Elimination_Order within each bracket
2. THE Battle_Bots_Plugin SHALL assign the last surviving robot in the Winners_Bracket as 1st place, the second-to-last eliminated as 2nd place, and continue sequentially
3. THE Battle_Bots_Plugin SHALL assign Losers_Bracket rankings starting from the position after the last Winners_Bracket position (e.g., with 10 total participants, losers rank from 6th to 10th)
4. WHEN multiple robots are eliminated in the same tick within a bracket, THE Battle_Bots_Plugin SHALL assign those robots the same rank (tied elimination)
5. WHEN all FFA brackets are complete, THE Battle_Bots_Plugin SHALL transition to the RESULT phase displaying the complete final rankings

### Requirement 9: Scoring Integration

**User Story:** As a host, I want Battle Bots final rankings to integrate with the platform's scoring modes, so that Battle Bots contributes to the session leaderboard like other games.

#### Acceptance Criteria

1. THE Battle_Bots_Plugin SHALL produce a GameLeaderboardEntry array from computeGameLeaderboard that maps final rankings to player positions
2. WHEN the session scoring mode is "grand-prix", THE Battle_Bots_Plugin's leaderboard SHALL integrate with the platform's placement points table (rank 1 = index 0 points, rank 2 = index 1 points, etc.)
3. WHEN the session scoring mode is "chips", THE Battle_Bots_Plugin SHALL multiply the default Grand Prix placement points by the configured chips-per-position multiplier to determine chips awarded per rank

### Requirement 10: Client Display and Tick Updates

**User Story:** As a player, I want to see my own battle prominently and monitor other battles' progress, so that I stay engaged throughout all combat phases.

#### Acceptance Criteria

1. WHILE a battle is in progress (Round 2 or Round 3), THE Battle_Bots_Plugin SHALL send Tick_Updates to all clients at the configured tick interval
2. THE Tick_Update SHALL contain the battle identifier, current HP for each robot in every active battle, and an eliminated flag for robots at 0 HP
3. WHEN a player receives a Tick_Update during Round 2, THE client SHALL display the player's own 1v1 battle prominently and other battles' HP values in a secondary list view
4. WHEN a player receives a Tick_Update during Round 3, THE client SHALL display the player's own FFA bracket prominently and the other bracket's HP values in a secondary view

### Requirement 11: Bot Persona Behavior

**User Story:** As a solo player or in an odd-numbered group, I want the system to add a computer-controlled opponent seamlessly, so that the game functions correctly regardless of player count.

#### Acceptance Criteria

1. THE Bot_Persona SHALL have a system-generated display name distinguishable from human players
2. THE Bot_Persona SHALL participate in battle simulation identically to human players (same stats, same tick resolution)
3. THE Bot_Persona SHALL be excluded from session scoring and the session leaderboard
4. WHEN the Bot_Persona wins a 1v1 or survives in an FFA, THE Battle_Bots_Plugin SHALL include the Bot_Persona in bracket placement but exclude the Bot_Persona from points awarded to human players
5. IF no Bot_Persona is needed (even player count of 2 or more), THEN THE Battle_Bots_Plugin SHALL proceed without creating a Bot_Persona

### Requirement 12: Round Lifecycle Integration

**User Story:** As a host, I want Battle Bots to follow the platform's standard round lifecycle with manual advancement, so that the game flow is consistent with other games on the platform.

#### Acceptance Criteria

1. THE Battle_Bots_Plugin SHALL follow the phase sequence LOBBY → PICKING → RESOLVING → RESULT for each of the 3 rounds
2. WHEN Round 1 enters PICKING, THE Battle_Bots_Plugin SHALL use the configured pickWindowMs (default 60000ms) as the prep timer
3. WHEN Rounds 2 or 3 enter RESOLVING, THE Battle_Bots_Plugin SHALL run the tick-based battle simulation server-side until all battles conclude, then transition to RESULT
4. THE Battle_Bots_Plugin SHALL require the host to send START_ROUND to advance from each RESULT phase to the next round
5. THE Battle_Bots_Plugin SHALL treat the tick rate as a server-side implementation constant not exposed in the client-facing settings UI
