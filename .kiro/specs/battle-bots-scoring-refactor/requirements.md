# Requirements Document

## Introduction

Refactors the Battle Bots scoring system to replace rank-based session scoring with a survival-tick-based system. The goal is to produce non-standard point distributions that reduce ties across tournament/session scoring. Winners receive a flat 25-point bonus, and FFA eliminated players receive a penalized survival score using a 1.1x denominator multiplier.

## Glossary

- **Scoring_System**: The module within BattleBotsPlugin responsible for computing point deltas after each round
- **Round_Type_1v1**: A round where two robots fight head-to-head in paired matchups (Round 2)
- **Round_Type_FFA**: A Free-For-All round where all participants fight simultaneously until one survivor remains (Round 3)
- **Win_Bonus**: A flat 25-point award given to the winner of any round
- **Survival_Points**: Points calculated based on how long a robot survived relative to the total round duration
- **Total_Ticks**: The number of simulation ticks the FFA round lasted (determined by when the last elimination occurs)
- **Eliminated_Tick**: The tick number at which a specific robot was eliminated from the FFA round
- **Penalty_Multiplier**: A 1.1x factor applied to the denominator when calculating survival points for eliminated players, capping their maximum around 91 points
- **Bot_Persona**: An AI-controlled participant that is excluded from scoring deltas
- **Scoring_Constants_File**: A dedicated file holding tweakable scoring values (Win_Bonus, Penalty_Multiplier, max survival points) used by the Scoring_System
- **BattleBotsLeaderboard**: An obsolete leaderboard component that previously displayed position-based scores; to be removed

## Requirements

### Requirement 1: 1v1 Round Scoring

**User Story:** As a tournament host, I want 1v1 round winners to receive a flat 25-point bonus, so that head-to-head outcomes produce clear score differentiation.

#### Acceptance Criteria

1. WHEN a 1v1 round completes, THE Scoring_System SHALL award 25 points to the winner of each pairing
2. WHEN a 1v1 round completes, THE Scoring_System SHALL award 0 points to the loser of each pairing
3. WHEN a human player is paired against a Bot_Persona and wins, THE Scoring_System SHALL award the human player 25 points as normal but SHALL NOT generate a score delta for the Bot_Persona
4. THE Scoring_System SHALL exclude Bot_Persona participants from the score deltas, meaning no score delta record is produced for any Bot_Persona

### Requirement 2: FFA Winner Scoring

**User Story:** As a tournament host, I want the FFA survivor to receive full survival points plus the win bonus, so that winning the FFA round is clearly the most rewarding outcome.

#### Acceptance Criteria

1. WHEN an FFA round completes with a single survivor (last robot with HP above 0, or highest-HP robot at 1000-tick timeout), THE Scoring_System SHALL award the survivor a fixed 100 survival points representing full round duration
2. WHEN an FFA round completes, THE Scoring_System SHALL award the survivor 25 Win_Bonus points in addition to survival points, totaling 125 points
3. THE Scoring_System SHALL calculate the survivor's survival points as a flat 100 without applying the 1.1x Penalty_Multiplier divisor used for eliminated players
4. IF the survivor is a Bot_Persona, THEN THE Scoring_System SHALL exclude the Bot_Persona from the score deltas (awarding 0 to the Bot_Persona entry)

### Requirement 3: FFA Eliminated Player Scoring

**User Story:** As a tournament host, I want eliminated players to receive survival points proportional to their longevity but penalized relative to the winner, so that second place cannot match the winner's score and ties are reduced.

#### Acceptance Criteria

1. WHEN a player is eliminated in an FFA round, THE Scoring_System SHALL calculate survival points as ceil(Eliminated_Tick / (Total_Ticks * 1.1) * 100), where Eliminated_Tick is the tick number on which the player was eliminated and Total_Ticks is the tick number on which the final elimination occurs (declaring the survivor)
2. THE Scoring_System SHALL cap eliminated player survival points at a maximum of 91 points, guaranteed by the 1.1 Penalty_Multiplier ensuring the denominator always exceeds the numerator (ceil(Total_Ticks / (Total_Ticks * 1.1) * 100) = ceil(90.909...) = 91)
3. WHEN multiple players are eliminated on the same tick, THE Scoring_System SHALL award each of those players the same survival points (identical Eliminated_Tick produces identical formula output)
4. THE Scoring_System SHALL exclude Bot_Persona participants from the score deltas while still including them in the FFA simulation (Bot_Persona eliminations affect Total_Ticks and other players' Eliminated_Tick values but produce no score delta output)

### Requirement 4: Scoring Replaces Previous Mechanism

**User Story:** As a developer, I want the new scoring system to fully replace the previous rank-based mechanism, so that no legacy scoring logic remains active.

#### Acceptance Criteria

1. WHEN an FFA round completes, THE Scoring_System SHALL compute score deltas using the survival-tick-based formula (ceil(Eliminated_Tick / (Total_Ticks * 1.1) * 100) for eliminated players, 100 + Win_Bonus for the survivor) and SHALL NOT compute deltas using the previous formula of (totalParticipants - rank) * 10
2. THE Scoring_System SHALL preserve the existing round structure where Round 1 produces zero score deltas for all players, Round 2 uses 1v1 Win_Bonus scoring, and Round 3 uses FFA survival-tick scoring
3. WHEN an FFA round completes, THE Scoring_System SHALL produce score deltas that differ from the values that would be produced by the previous rank-based formula (totalParticipants - rank) * 10 for any game with 3 or more participants

### Requirement 5: Configurable Scoring Constants

**User Story:** As a developer, I want scoring constants to be defined in a dedicated constants file, so that values can be tweaked without modifying scoring logic.

#### Acceptance Criteria

1. THE Scoring_System SHALL read Win_Bonus, Penalty_Multiplier, and Survival_Points maximum from a dedicated scoring constants file rather than using hardcoded inline values
2. THE scoring constants file SHALL define default values of: Win_Bonus = 25, Penalty_Multiplier = 1.1, and maximum survival points for the winner = 100
3. WHEN a scoring constant is modified in the constants file, THE Scoring_System SHALL use the updated value without requiring changes to the scoring logic implementation

### Requirement 6: Scoreboard and Leaderboard Accuracy

**User Story:** As a tournament host, I want all scoreboards and leaderboards to display correct cumulative scores from the new scoring system, so that players see accurate standings.

#### Acceptance Criteria

1. WHEN score deltas are computed after a round, THE scoreboards and leaderboards SHALL display each player's cumulative score based on the new survival-tick-based and Win_Bonus scoring formulas
2. THE system SHALL remove the BattleBotsLeaderboard component entirely, as it is obsolete and previously displayed incorrect position-based scores
3. WHEN a round completes, all remaining scoreboard/leaderboard displays SHALL reflect the updated cumulative scores without showing rank-as-score or position-based values from the old system
