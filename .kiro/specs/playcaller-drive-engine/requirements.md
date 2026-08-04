# Requirements Document

## Introduction

The Playcaller Drive Engine is the Phase 2 replacement for the random Match_Resolver. It implements an interactive football drive where one player (offense) attempts to score a touchdown from the opponent's 25-yard line and the other player (defense) attempts to force a turnover. Both players select plays simultaneously each down, with outcomes determined by a D&D-style roll system influenced by the play matchup. The engine is a pure functional module — no UI, no network, no bracket integration — accepting play choices and drive state as input and producing updated state and play-by-play text as output.

## Glossary

- **Drive_Engine**: The pure functional module that processes a single football drive from start to finish, accepting play selections and returning updated drive state and results
- **Drive_State**: The complete state of an in-progress drive including current down, yards to go, yard line, and play history
- **Offensive_Play**: One of four plays available to the offense, classified along Run/Pass and Safe/Aggressive axes
- **Defensive_Play**: One of four plays available to the defense, classified along Run/Pass and Safe/Aggressive axes
- **Play_Matrix**: The 4×4 configuration object mapping each offensive-defensive play matchup to stat modifiers applied during resolution
- **Play_Config**: A configuration object defining all play definitions and their base stats, designed for easy tuning without code changes
- **Down**: A single play attempt within the drive (1st through 4th)
- **Yards_To_Go**: The number of yards the offense must gain to earn a first down or touchdown
- **Yard_Line**: The offense's current position expressed as yards remaining to the end zone (0 = touchdown)
- **Turnover**: Any event that ends the drive in the defense's favor (interception, fumble, turnover on downs)
- **Turnover_On_Downs**: A turnover that occurs when the offense fails to convert on 4th down
- **Critical_Success**: An exceptional offensive outcome yielding a large yardage gain (100-120% of max yardage for the play)
- **Critical_Failure**: An exceptional negative outcome for the offense (tackle for loss, sack, fumble, or interception)
- **Success_Rate**: The base probability (0-1) that an offensive play gains positive yardage before defensive modifiers are applied
- **Yardage_Range**: The minimum and maximum yards gained on a successful play before defensive modifiers are applied
- **Defensive_Modifier**: A set of adjustments a defensive play applies to an offensive play's stats for a given matchup (modifies success rate, yardage range, critical chances)
- **RNG_Function**: An injectable random number generator function that produces values between 0 and 1, enabling deterministic testing
- **Play_Result**: The output of resolving a single down, containing yards gained/lost, outcome type, and play-by-play text
- **Play_By_Play_Text**: Template-based flavor text describing the result of each down for display to players

## Requirements

### Requirement 1: Drive Initialization

**User Story:** As an offense player, I want the drive to start at the opponent's 25-yard line with 1st-and-10, so that the game provides a consistent scoring opportunity each possession.

#### Acceptance Criteria

1. WHEN a new drive begins, THE Drive_Engine SHALL create a Drive_State with yard line set to 25, down set to 1, and yards to go set to 10
2. WHEN a new drive begins, THE Drive_Engine SHALL initialize the play history as an empty list
3. THE Drive_Engine SHALL assign the higher-seeded player as offense and the lower-seeded player as defense

### Requirement 2: Play Selection

**User Story:** As a player, I want to choose from four distinct plays each down, so that my strategic decisions influence the outcome.

#### Acceptance Criteria

1. THE Play_Config SHALL define exactly 4 offensive plays, each classified as one combination of Run/Pass and Safe/Aggressive (Run-Safe, Run-Aggressive, Pass-Safe, Pass-Aggressive)
2. THE Play_Config SHALL define exactly 4 defensive plays, each classified as one combination of Run/Pass and Safe/Aggressive (Run-Safe, Run-Aggressive, Pass-Safe, Pass-Aggressive)
3. WHEN a down begins, THE Drive_Engine SHALL accept one Offensive_Play selection from the offense player and one Defensive_Play selection from the defense player
4. THE Drive_Engine SHALL treat offensive and defensive play selections as simultaneous and hidden from each other until resolution
5. IF a player does not submit a play selection within the play clock window, THEN THE Drive_Engine SHALL accept a randomly selected play for that player (selected via the injected RNG_Function)

### Requirement 3: Play Base Stats

**User Story:** As a game designer, I want each offensive play to have tunable base stats, so that play balance can be adjusted without code changes.

#### Acceptance Criteria

1. THE Play_Config SHALL define for each Offensive_Play a base Success_Rate as a decimal value between 0 and 1
2. THE Play_Config SHALL define for each Offensive_Play a Yardage_Range containing a minimum yards value and a maximum yards value where minimum is less than or equal to maximum
3. THE Play_Config SHALL define for each Offensive_Play a critical success chance as a decimal value between 0 and 1
4. THE Play_Config SHALL define for each Offensive_Play a critical failure chance as a decimal value between 0 and 1
5. THE Play_Config SHALL be structured as a single configuration object that can be replaced or modified for tuning without altering engine logic

### Requirement 4: Defensive Modifiers

**User Story:** As a defense player, I want my play choice to modify the offensive outcome, so that correctly scheming against the offense provides a strategic advantage.

#### Acceptance Criteria

1. THE Play_Matrix SHALL define a Defensive_Modifier for each of the 16 offensive-defensive play combinations (4×4 matrix)
2. WHEN a down resolves, THE Drive_Engine SHALL apply the Defensive_Modifier corresponding to the selected offensive-defensive play combination to the offensive play's base stats before rolling
3. THE Defensive_Modifier SHALL be capable of adjusting the Success_Rate (additive modifier between -1 and 1)
4. THE Defensive_Modifier SHALL be capable of adjusting the Yardage_Range minimum and maximum (additive integer modifiers)
5. THE Defensive_Modifier SHALL be capable of adjusting the critical success chance (additive modifier between -1 and 1)
6. THE Defensive_Modifier SHALL be capable of adjusting the critical failure chance (additive modifier between -1 and 1)
7. WHEN the defensive play correctly schemes against the offensive play (matching axis), THE Defensive_Modifier SHALL primarily shrink the range of positive outcomes for the offense
8. WHEN the defensive play incorrectly schemes against the offensive play (mismatched axis), THE Defensive_Modifier SHALL expand the range of positive outcomes for the offense

### Requirement 5: Resolution Roll Sequence

**User Story:** As a player, I want outcomes determined by a multi-step roll system, so that results feel dramatic and varied like tabletop RPG combat.

#### Acceptance Criteria

1. WHEN a down resolves, THE Drive_Engine SHALL first perform a success roll by comparing an RNG_Function output against the modified Success_Rate to determine if the play succeeds or fails
2. WHEN the success roll indicates success, THE Drive_Engine SHALL check for Critical_Success by comparing an RNG_Function output against the modified critical success chance
3. WHEN a Critical_Success occurs, THE Drive_Engine SHALL compute yardage as a value between 100% and 120% of the modified maximum yardage (rolled via RNG_Function)
4. WHEN the success roll indicates success and Critical_Success does not occur, THE Drive_Engine SHALL roll for yardage within the modified Yardage_Range (minimum to maximum, inclusive, via RNG_Function)
5. WHEN the success roll indicates failure, THE Drive_Engine SHALL check for Critical_Failure by comparing an RNG_Function output against the modified critical failure chance
6. WHEN a Critical_Failure occurs on a pass play, THE Drive_Engine SHALL resolve the play as an interception (turnover)
7. WHEN a Critical_Failure occurs on a run play, THE Drive_Engine SHALL resolve the play as a fumble (turnover)
8. WHEN the success roll indicates failure and Critical_Failure does not occur and the offensive play is a pass, THE Drive_Engine SHALL resolve the play as an incomplete pass (0 yards gained)
9. WHEN the success roll indicates failure and Critical_Failure does not occur and the offensive play is a run, THE Drive_Engine SHALL resolve the play as a tackle for loss (small negative yardage rolled via RNG_Function)
10. THE Drive_Engine SHALL use only the injected RNG_Function for all random decisions, enabling deterministic replay when a seeded RNG is provided

### Requirement 6: Down and Distance Progression

**User Story:** As a player, I want standard football down-and-distance rules, so that the drive feels like authentic football gameplay.

#### Acceptance Criteria

1. WHEN the offense gains enough yards to meet or exceed the Yards_To_Go on any down, THE Drive_Engine SHALL reset the down to 1 and set Yards_To_Go to 10 or the remaining yard line distance (whichever is smaller)
2. WHEN the offense does not gain enough yards to meet the Yards_To_Go, THE Drive_Engine SHALL increment the down by 1
3. WHEN the down reaches 4 and the offense does not gain enough yards on that play, THE Drive_Engine SHALL end the drive as a Turnover_On_Downs
4. THE Drive_Engine SHALL update the Yard_Line by subtracting yards gained (positive yards move toward 0, negative yards move away from 0)
5. THE Drive_Engine SHALL clamp the Yard_Line to a minimum of 0 (touchdown cannot overshoot)
6. WHEN the Yards_To_Go exceeds the remaining Yard_Line (within 10 yards of the end zone), THE Drive_Engine SHALL set Yards_To_Go equal to the Yard_Line (first-and-goal situation)

### Requirement 7: Drive Completion

**User Story:** As a player, I want clear win/loss conditions, so that I know exactly how the drive can end.

#### Acceptance Criteria

1. WHEN the Yard_Line reaches 0, THE Drive_Engine SHALL end the drive with an offensive victory (touchdown)
2. WHEN an interception occurs (Critical_Failure on a pass play), THE Drive_Engine SHALL end the drive with a defensive victory (turnover)
3. WHEN a fumble occurs (Critical_Failure on a run play), THE Drive_Engine SHALL end the drive with a defensive victory (turnover)
4. WHEN the offense fails on 4th down (does not gain required Yards_To_Go), THE Drive_Engine SHALL end the drive with a defensive victory (Turnover_On_Downs)
5. THE Drive_Engine SHALL return a completion status indicating the winner (offense or defense player ID), the ending type (touchdown, interception, fumble, or turnover on downs), and the final Drive_State

### Requirement 8: Play-by-Play Text Generation

**User Story:** As a player, I want flavor text describing each play result, so that the game feels engaging and narratively rich.

#### Acceptance Criteria

1. WHEN a down resolves, THE Drive_Engine SHALL produce a Play_By_Play_Text string describing the outcome
2. THE Play_By_Play_Text SHALL be generated from templates based on the play outcome type (success, critical success, incomplete pass, tackle for loss, interception, fumble, turnover on downs)
3. THE Play_By_Play_Text SHALL include the specific yardage gained or lost when applicable
4. THE Play_By_Play_Text generation SHALL be deterministic given the same Play_Result inputs (no additional randomness beyond what produced the result)
5. THE Play_By_Play_Text system SHALL be structured as a replaceable module, so that future phases can substitute LLM-generated commentary without modifying the Drive_Engine

### Requirement 9: Balance Constraints

**User Story:** As a game designer, I want the play matrix balanced so that no single strategy dominates, ensuring the game rewards varied play-calling.

#### Acceptance Criteria

1. WHEN offense selects plays uniformly at random and defense selects plays uniformly at random, THE Play_Config SHALL produce an approximate 50/50 offensive-to-defensive win rate across a large sample of drives (within 5 percentage points of 50%)
2. WHEN one player selects optimal counter-plays against a predictable opponent, THE Play_Config SHALL limit the resulting win rate advantage to no more than 60% for the optimizing player
3. THE Play_Config SHALL produce an average expected yardage per play of approximately 2.5 to 3.5 yards regardless of the defensive play selected (averaged across all offensive plays with equal weight)
4. WHEN a defensive play correctly schemes against the offensive play, THE Defensive_Modifier SHALL reduce yardage variance (shrink the gap between min and max outcomes) rather than primarily reducing expected yardage

### Requirement 10: Engine Purity and Interface

**User Story:** As a developer, I want the drive engine to be a pure functional module, so that it can be tested in isolation and integrated with the bracket system without side effects.

#### Acceptance Criteria

1. THE Drive_Engine SHALL expose a function that accepts a current Drive_State, an Offensive_Play selection, a Defensive_Play selection, and an RNG_Function, and returns an updated Drive_State and Play_Result
2. THE Drive_Engine SHALL produce no side effects (no I/O, no mutation of external state, no dependency on global mutable state)
3. THE Drive_Engine SHALL return identical outputs when called with identical inputs including the same RNG_Function sequence
4. THE Drive_Engine SHALL expose a function to create an initial Drive_State given the two player IDs and their seed numbers
5. THE Drive_Engine SHALL expose a function to determine if a Drive_State represents a completed drive and return the completion status

### Requirement 11: Play History Tracking

**User Story:** As a player, I want to see what happened on previous downs in the current drive, so that I can make informed decisions about upcoming plays.

#### Acceptance Criteria

1. WHEN a down resolves, THE Drive_Engine SHALL append a record to the Drive_State play history containing the down number, offensive play selected, defensive play selected, Play_Result, and resulting yard line
2. THE Drive_State play history SHALL preserve the complete sequence of plays from the first down to the most recent down in chronological order
3. THE Drive_Engine SHALL include the play history in the Drive_State returned after each down resolution

### Requirement 12: Configuration Separation

**User Story:** As a game designer, I want all play definitions and balance values in a single config object, so that tuning the game requires editing only data, not logic.

#### Acceptance Criteria

1. THE Play_Config SHALL contain all offensive play definitions (names, axes classification, base stats) in a single exportable object
2. THE Play_Config SHALL contain all defensive play definitions (names, axes classification) in a single exportable object
3. THE Play_Matrix SHALL contain all 16 Defensive_Modifier entries in a single exportable object keyed by the offensive-defensive play combination
4. THE Drive_Engine SHALL accept the Play_Config and Play_Matrix as parameters or import them from a dedicated configuration module, enabling replacement for testing or future tuning
5. THE Play_Config and Play_Matrix SHALL be typed with TypeScript interfaces that enforce structural correctness at compile time

### Requirement 13: Tackle-for-Loss Yardage on Failed Runs

**User Story:** As a player, I want failed run plays to result in small losses rather than zero yards, so that running carries realistic risk compared to passing.

#### Acceptance Criteria

1. WHEN a run play fails (success roll fails) and Critical_Failure does not occur, THE Drive_Engine SHALL compute a negative yardage value between -1 and -3 yards (rolled via RNG_Function)
2. THE Drive_Engine SHALL apply tackle-for-loss yardage to the Yard_Line (moving the offense further from the end zone)
3. THE Drive_Engine SHALL clamp the Yard_Line to a maximum of 99 yards (the offense cannot be pushed back beyond their own 1-yard line equivalent)

