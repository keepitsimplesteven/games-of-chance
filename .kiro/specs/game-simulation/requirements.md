# Requirements Document

## Introduction

The Game Simulation Engine enables running games at high speed without real WebSocket connections, serving two primary use cases: (1) an Admin UI fast-play mode where hosts can observe a full simulated game with bot players in rapid succession, and (2) a CLI Monte Carlo mode that runs thousands to millions of games headlessly for statistical balance analysis. Both modes share a common simulation core that exercises the existing GamePlugin interface directly, without needing PartyKit or WebSocket infrastructure.

## Glossary

- **Simulation_Core**: The pure-function game loop engine that exercises GamePlugin methods (validatePick, resolveRound, scoreRound, computeGameLeaderboard) without WebSocket or PartyKit dependencies
- **Bot_Player**: An automated player entity that produces picks via a decision function; initially random, extensible to named strategy personas
- **Fast_Play_Mode**: The Admin UI simulation mode where a host activates simulation and watches bot players complete a game with brief pauses between rounds
- **Monte_Carlo_Mode**: The CLI headless simulation mode that runs configurable quantities of games and produces statistical output
- **Simulation_Config**: The configuration object specifying player count, round count, game count, game type, and optional random seed for a simulation run
- **Statistics_Reporter**: The component that collects per-game results and computes aggregate statistics (mean, standard deviation, Gini coefficient, win-rate distribution, streak analysis)
- **GamePlugin**: The existing interface at `packages/server/src/games/GamePlugin.ts` providing validatePick, resolveRound, scoreRound, and computeGameLeaderboard methods
- **GameRegistry**: The existing singleton registry that maps GameType strings to their plugin implementations
- **Gini_Coefficient**: A statistical measure of inequality in a distribution, ranging from 0 (perfect equality) to 1 (maximum inequality); used here to detect unfair score concentration
- **Snowball_Detection**: Analysis that identifies whether early-round advantages compound into insurmountable leads, indicating a runaway-winner design flaw
- **Bot_Persona**: A named decision strategy for bot players (e.g., "Random", "Conservative", "Gambler") that determines how picks are selected; only "Random" is implemented initially

## Requirements

### Requirement 1: Simulation Core Engine

**User Story:** As a game designer, I want a simulation engine that runs the full game loop using GamePlugin methods directly, so that I can test game balance without needing WebSocket connections or browser clients.

#### Acceptance Criteria

1. THE Simulation_Core SHALL execute the complete round lifecycle (generate bot picks, call resolveRound, call scoreRound, track cumulative game scores, call computeGameLeaderboard) using only the GamePlugin interface
2. THE Simulation_Core SHALL accept a Simulation_Config specifying game type, player count, round count per game, number of games to simulate, and an optional random seed
3. THE Simulation_Core SHALL resolve the GamePlugin from the GameRegistry using the game type specified in Simulation_Config
4. WHEN a random seed is provided in Simulation_Config, THE Simulation_Core SHALL produce deterministic results for the same seed and configuration
5. THE Simulation_Core SHALL have zero dependencies on PartyKit, WebSocket, or any network I/O modules
6. THE Simulation_Core SHALL track per-player cumulative scores across all rounds within a single game
7. WHEN all rounds in a game are completed, THE Simulation_Core SHALL call computeGameLeaderboard and return the final game leaderboard alongside per-player score histories

### Requirement 2: Bot Player Decision System

**User Story:** As a game designer, I want automated bot players that produce valid picks for any registered game type, so that simulations can run without human input.

#### Acceptance Criteria

1. THE Bot_Player SHALL implement a decidePick function that accepts a game type and available pick options and returns a valid pick for that game type
2. THE Bot_Player SHALL produce picks that pass the GamePlugin validatePick check for the target game type
3. WHEN the Bot_Persona is "Random", THE Bot_Player SHALL select picks with uniform probability across all valid options
4. THE Bot_Player system SHALL be structured to support adding named Bot_Persona strategies without modifying existing bot logic
5. THE Bot_Player SHALL be stateless within a single round; each pick decision is independent of prior rounds unless a future Bot_Persona explicitly requires history

### Requirement 3: Admin UI Fast-Play Mode

**User Story:** As a game host, I want to activate a simulation mode from the host control panel, so that I can observe how a game plays out with bot players at high speed without waiting for real participants.

#### Acceptance Criteria

1. WHEN the host activates Fast_Play_Mode, THE system SHALL create the configured number of Bot_Player instances and begin executing rounds automatically
2. WHILE Fast_Play_Mode is active, THE system SHALL display each round result for approximately 500 milliseconds before auto-advancing to the next round
3. WHILE Fast_Play_Mode is active, THE system SHALL display the game leaderboard updating in real time after each round
4. WHEN all rounds in Fast_Play_Mode are completed, THE system SHALL display the final game results and hold the display until the host takes further action
5. THE Fast_Play_Mode SHALL execute the same GamePlugin logic (resolveRound, scoreRound, computeGameLeaderboard) as a live multiplayer game
6. WHEN the host deactivates Fast_Play_Mode mid-game, THE system SHALL stop the simulation and display the results accumulated up to that point
7. THE Fast_Play_Mode activation control SHALL be visible only to users with the host role
8. WHILE Fast_Play_Mode is active, THE system SHALL indicate clearly in the UI that a simulation is running, distinguishing the view from a live game

### Requirement 4: CLI Monte Carlo Mode

**User Story:** As a game designer, I want a CLI command that runs large batches of simulated games headlessly, so that I can perform statistical balance analysis on game designs without a UI.

#### Acceptance Criteria

1. WHEN the user executes the `pnpm simulate` command, THE Monte_Carlo_Mode SHALL run the specified number of games using the Simulation_Core
2. THE Monte_Carlo_Mode SHALL accept command-line arguments for game type, player count, round count per game, number of games, and optional random seed
3. THE Monte_Carlo_Mode SHALL execute without requiring any UI, browser, or WebSocket dependencies
4. WHEN simulating a simple game (equivalent complexity to CoinTossPlugin), THE Monte_Carlo_Mode SHALL complete 1,000,000 games in under 60 seconds on standard hardware
5. WHEN all games are completed, THE Monte_Carlo_Mode SHALL output results to stdout in a human-readable format
6. THE Monte_Carlo_Mode SHALL provide a progress indicator during long-running simulation batches

### Requirement 5: Statistics Collection and Reporting

**User Story:** As a game designer, I want comprehensive statistical output from simulation runs, so that I can detect balance issues, unfair strategies, and snowball effects in game designs.

#### Acceptance Criteria

1. THE Statistics_Reporter SHALL compute mean score and standard deviation across all players for a simulation batch
2. THE Statistics_Reporter SHALL compute the Gini_Coefficient of final scores to measure score inequality
3. THE Statistics_Reporter SHALL compute the maximum-to-minimum score ratio across players to detect extreme outliers
4. THE Statistics_Reporter SHALL compute win-rate distribution showing how often each player position finishes in each rank
5. THE Statistics_Reporter SHALL perform Snowball_Detection by analyzing correlation between early-round scores and final rankings
6. THE Statistics_Reporter SHALL compute streak analysis including maximum consecutive wins and maximum consecutive losses per player position
7. THE Statistics_Reporter SHALL compute score variance per round position to identify rounds that disproportionately affect outcomes
8. WHEN operating in Monte_Carlo_Mode, THE Statistics_Reporter SHALL output all computed statistics to stdout upon simulation completion

### Requirement 6: Configuration and Integration

**User Story:** As a game designer, I want the simulation engine to use the same GamePlugin interface and constants files as the production game, so that tuning changes are immediately reflected in simulation results.

#### Acceptance Criteria

1. THE Simulation_Core SHALL import and use GamePlugin implementations from the existing GameRegistry without modification or duplication
2. THE Simulation_Core SHALL use the same tuning constants (from `constants.ts` files) as the production game plugins
3. WHEN a tuning constant is modified in a game plugin's constants file, THE Simulation_Core SHALL reflect that change in subsequent simulation runs without additional configuration
4. THE Simulation_Core SHALL support any game type registered in the GameRegistry without game-specific simulation code
5. IF a specified game type is not registered in the GameRegistry, THEN THE Simulation_Core SHALL return a descriptive error message identifying the unregistered game type
