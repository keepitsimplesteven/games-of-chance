# Requirements Document

## Introduction

This feature enhances the presentational layer of the Playcaller football game by introducing a richer circumstance classification system, play pools with weighted random selection, layered play-by-play commentary, and expanded outcome categories. The underlying 4-play mechanical system (run-safe, run-aggressive, pass-safe, pass-aggressive) and the drive engine remain completely unchanged. All changes are purely cosmetic — affecting display names, formations shown on play cards, and commentary text.

## Glossary

- **Circumstance_Classifier**: The function that derives a circumstance bucket from the current down, yards-to-go, and yard-line values
- **Circumstance**: A categorical label describing the current game situation (standard, short_yardage, medium_yardage, long_yardage, desperation, goal_line, must_convert)
- **Play_Slot**: One of the four mechanical play identifiers (run-safe, run-aggressive, pass-safe, pass-aggressive)
- **Play_Definition**: A data object associating a display name, formation, valid circumstances, weight, and optional commentary with a Play_Slot
- **Play_Pool**: The collection of all Play_Definitions registered for a given Play_Slot and role (offense or defense)
- **Play_Selector**: The function that filters a Play_Pool to valid entries for the current Circumstance and randomly selects one using weights
- **Commentary_Resolver**: The function that selects play-by-play text for a given commentary phase using the three-tier weighted cascade
- **Commentary_Phase**: One of the three sequential phases of play-by-play text: preSnap, activePlay, outcome
- **Outcome_Category**: A classification of the play result used to select outcome-phase commentary (first_down, small_gain, big_gain, touchdown, incomplete, negative, turnover)
- **Play_Art_System**: The SVG-based visual diagram system that renders the PlayArtData embedded in each Play_Definition directly onto the play card
- **Drive_Engine**: The server-side game logic that resolves plays mechanically (unchanged by this feature)
- **Weight**: A positive number representing relative selection probability within a pool (default 1)

## Requirements

### Requirement 1: Expanded Circumstance Classification

**User Story:** As a player, I want the game to recognize more specific game situations, so that the play names and commentary feel contextually appropriate to the current down-and-distance.

#### Acceptance Criteria

1. WHEN the current yards-to-go is 1 or 2 AND the current down is not 4 AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "short_yardage"
2. WHEN the current yards-to-go is between 3 and 5 inclusive AND the current down is not 4 AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "medium_yardage"
3. WHEN the current yards-to-go is between 6 and 9 inclusive AND the current down is not 4 AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "long_yardage"
4. WHEN the current down is 4 AND the current yards-to-go is 7 or more AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "desperation"
5. WHEN the current yard-line is 5 or less (inside the 5-yard line), THE Circumstance_Classifier SHALL return "goal_line" regardless of down or yards-to-go
6. WHEN the current down is 4 AND the current yards-to-go is between 1 and 3 inclusive AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "must_convert"
7. WHEN no other circumstance rule (criteria 1–6, 8) matches AND the inputs are within valid bounds, THE Circumstance_Classifier SHALL return "standard"
8. WHEN the current down is 4 AND the current yards-to-go is between 4 and 6 inclusive AND the current yard-line is greater than 5, THE Circumstance_Classifier SHALL return "desperation"
9. THE Circumstance_Classifier SHALL accept three inputs: down (integer 1–4), yards-to-go (integer 1–99), and yard-line (integer 1–99), and SHALL return exactly one classification per invocation
10. WHEN the yard-line is 5 or less, THE Circumstance_Classifier SHALL evaluate the goal_line rule (criterion 5) before all other rules, ensuring goal_line takes priority over short_yardage, must_convert, or desperation for the same inputs

### Requirement 2: Play Pool Data Structure

**User Story:** As a developer, I want play definitions to declare which circumstances they are valid for, so that each circumstance can draw from a curated pool of contextually appropriate plays.

#### Acceptance Criteria

1. THE Play_Definition SHALL contain a displayName field of type string with a length between 1 and 50 characters
2. THE Play_Definition SHALL contain a formation field of type string with a length between 1 and 30 characters
3. THE Play_Definition SHALL contain a circumstances field listing one or more values from the Circumstance set (standard, short_yardage, medium_yardage, long_yardage, desperation, goal_line, must_convert)
4. THE Play_Definition SHALL contain an optional weight field of type number greater than 0 with a default value of 1
5. THE Play_Definition SHALL contain an optional messages field of type partial PlayByPlayMessages for play-specific commentary, where any subset of the three Commentary_Phases (preSnap, activePlay, outcome) may be provided
6. THE Play_Pool SHALL group Play_Definitions by Play_Slot and role (offense or defense), allowing multiple Play_Definitions per Play_Slot
7. IF a Play_Definition contains a circumstances value not in the defined Circumstance set, THEN THE Play_Pool SHALL reject that Play_Definition at load time with an error indicating the invalid value

### Requirement 3: Weighted Random Play Selection

**User Story:** As a player, I want different play names to appear for the same situation across games, so that the experience feels varied and replayable.

#### Acceptance Criteria

1. WHEN a play card is rendered, THE Play_Selector SHALL filter the Play_Pool to only Play_Definitions whose circumstances array includes the current Circumstance and whose Play_Slot matches the target slot
2. WHEN multiple valid Play_Definitions exist for the current Circumstance and Play_Slot, THE Play_Selector SHALL randomly select one with probability equal to that definition's weight divided by the sum of all valid definitions' weights
3. WHEN only one valid Play_Definition exists for the current Circumstance and Play_Slot, THE Play_Selector SHALL select that definition with 100% probability
4. IF no Play_Definitions are valid for the current Circumstance and Play_Slot, THEN THE Play_Selector SHALL fall back to Play_Definitions valid for the "standard" Circumstance for that same Play_Slot and role
5. THE Play_Selector SHALL select exactly one Play_Definition per Play_Slot per render cycle
6. WHEN the play cards are rendered for a single down, THE Play_Selector SHALL produce four independent selections (one per Play_Slot), each using its own separate random draw from its respective filtered pool
7. THE Play_Selector SHALL treat weight values as positive numbers greater than or equal to 1, with a default of 1 when the weight field is omitted

### Requirement 4: Play Name Misplacement Corrections

**User Story:** As a player, I want play names to appear only in situations where they make football sense, so that the game feels authentic.

#### Acceptance Criteria

1. THE Play_Pool SHALL include "Prevent Defense" only under the pass-safe Play_Slot for the defense role, and only in circumstances where yards-to-go is 6 or more (long_yardage, desperation)
2. THE Play_Pool SHALL include "QB Sneak" only under the run-safe Play_Slot for the offense role, and only in circumstances where yards-to-go is 1 or 2 (short_yardage, goal_line, must_convert)
3. THE Play_Pool SHALL exclude "Screen Pass" from the desperation and must_convert Circumstances, and SHALL include it only under a pass-safe or pass-aggressive Play_Slot for the offense role
4. THE Play_Pool SHALL include "Hail Mary" only under the pass-aggressive Play_Slot for the offense role, and only in the desperation Circumstance

### Requirement 5: Layered Play-by-Play Commentary Resolution

**User Story:** As a player, I want the announcer commentary to feel specific to the play being run while still having variety, so that the experience is immersive and non-repetitive.

#### Acceptance Criteria

1. WHEN generating commentary for a Commentary_Phase, THE Commentary_Resolver SHALL use a weighted random roll to select a tier: play-specific (60% probability), circumstance-level (30% probability), or default generic (10% probability)
2. IF the selected tier contains no messages for the current Commentary_Phase, THEN THE Commentary_Resolver SHALL cascade downward through the tier hierarchy (play-specific → circumstance-level → default generic) until a tier with at least one message is found
3. IF the play-specific tier is selected but empty, THEN THE Commentary_Resolver SHALL try the circumstance-level tier, then the default generic tier
4. IF the circumstance-level tier is selected but empty, THEN THE Commentary_Resolver SHALL try the default generic tier
5. WHEN a tier with at least one message is resolved, THE Commentary_Resolver SHALL select one message from that tier's array using uniform random distribution
6. THE Commentary_Resolver SHALL resolve commentary independently for each of the three Commentary_Phases (preSnap, activePlay, outcome), performing a separate tier roll per phase
7. THE default generic tier SHALL contain at least one message for every Commentary_Phase, guaranteeing that the cascade always terminates with a valid message
8. WHEN the outcome Commentary_Phase is resolved, THE Commentary_Resolver SHALL use the current play's Outcome_Category to key into the appropriate message arrays within each tier

### Requirement 6: Expanded Outcome Categories

**User Story:** As a player, I want the game to distinguish first-down conversions and turnover-on-downs from other outcomes, so that commentary accurately reflects what happened.

#### Acceptance Criteria

1. WHEN the play outcome is "interception" or "fumble", THE Outcome_Category SHALL be "turnover"
2. WHEN the play outcome is "incomplete_pass", THE Outcome_Category SHALL be "incomplete"
3. WHEN yards gained is negative (less than 0), THE Outcome_Category SHALL be "negative"
4. WHEN yards gained equals or exceeds the yard line (distance to end zone) AND the play outcome is "success" or "critical_success", THE Outcome_Category SHALL be "touchdown"
5. IF the current down is 4 AND yards gained is less than yards-to-go AND the play outcome is not "interception" and not "fumble", THEN THE Outcome_Category SHALL be "turnover"
6. WHEN yards gained is 10 or more, THE Outcome_Category SHALL be "big_gain" regardless of whether yards-to-go was also met
7. WHEN yards gained is greater than or equal to yards-to-go AND yards gained is less than 10, THE Outcome_Category SHALL be "first_down"
8. WHEN yards gained is 0 or more but less than yards-to-go AND yards gained is less than 10, THE Outcome_Category SHALL be "small_gain"
9. THE System SHALL evaluate categorization rules in the following precedence order: turnover (interception/fumble) first, then incomplete, then negative, then touchdown, then 4th-down turnover-on-downs, then big_gain, then first_down, then small_gain

### Requirement 7: Circumstance-Level Commentary Decorators

**User Story:** As a player, I want commentary that acknowledges the game situation (e.g., "4th and long", "goal line stand"), so that the stakes feel real even without play-specific messages.

#### Acceptance Criteria

1. THE Commentary_Resolver SHALL maintain a set of circumstance-level message arrays keyed by Circumstance and Commentary_Phase
2. WHEN the circumstance-level tier is resolved, THE Commentary_Resolver SHALL select from messages registered for the current Circumstance and Commentary_Phase using uniform random distribution
3. THE Commentary_Resolver SHALL provide circumstance-level messages for each of the seven Circumstance values across all three Commentary_Phases, totaling at least 21 combinations each with at least 3 distinct messages
4. Messages within the same Circumstance and Commentary_Phase array SHALL be distinct strings to ensure variety

### Requirement 8: Play Art Embedded in Play Definitions

**User Story:** As a developer, I want each play definition to carry its own art data directly, so that art is always available when a play is selected and no separate lookup or fallback logic is needed.

#### Acceptance Criteria

1. THE Play_Definition SHALL contain a required playArt field of type PlayArtData, representing the formation diagram for that specific play
2. WHEN a Play_Definition is selected from the Play_Pool, THE Play_Art_System SHALL render the PlayArtData carried by that Play_Definition directly, with no separate art registry or resolver lookup
3. THE PlayArtData shape SHALL consist of markers (PlayerMarker array), routes (RouteSegment array), an optional zones field (CoverageZone array for defense), and a lineOfScrimmage value (number 0–100)
4. FOR EACH Play_Definition in the Play_Pool, THE Play_Definition SHALL have a playArt field containing at least one PlayerMarker and a valid lineOfScrimmage value between 0 and 100

### Requirement 9: Presentation-Only Guarantee

**User Story:** As a developer, I want confidence that this feature does not alter game outcomes, so that balancing and game logic remain stable.

#### Acceptance Criteria

1. THE Drive_Engine SHALL produce identical PlayOutcome values, yardsGained values, and drive completion results regardless of which Play_Definition is selected for display, such that two drives with the same Play_Slot selections and the same RNG seed yield byte-equal resolution histories
2. THE Play_Selector SHALL not modify, read from, or write to any DriveState fields (down, yardsToGo, yardLine, possession, play history) and SHALL receive only the current down, yards-to-go, and yard-line values as read-only inputs for Circumstance derivation
3. THE Commentary_Resolver SHALL not modify, read from, or write to any DriveState fields and SHALL execute only after the Drive_Engine has resolved the current play outcome
4. THE Circumstance_Classifier SHALL be a pure function: given the same down, yards-to-go, and yard-line input values it SHALL always return the same Circumstance value and SHALL not mutate its input parameters or write to any state outside its return value
5. WHEN the Drive_Engine resolves a play, THE Drive_Engine SHALL use only the Play_Slot identifier (run-safe, run-aggressive, pass-safe, pass-aggressive) as the player-choice input and SHALL not reference the Play_Definition displayName, formation, weight, or commentary fields

### Requirement 10: Minimum Coverage Guarantee

**User Story:** As a player, I want every play slot to always have at least one valid play name in every situation, so that the UI never shows a blank or broken card.

#### Acceptance Criteria

1. FOR EACH combination of Play_Slot (4), role (2), and Circumstance (7), THE Play_Pool SHALL contain at least one valid Play_Definition, totaling a minimum of 56 entries across the complete matrix
2. IF the standard-Circumstance fallback is triggered, THE Play_Pool SHALL guarantee at least one Play_Definition exists for the standard Circumstance for every Play_Slot and role combination
3. WHEN a fallback to standard is triggered AND the application is running in development mode (NODE_ENV === "development"), THE Play_Selector SHALL log a warning to the console identifying the Play_Slot, role, and Circumstance that had no direct matches
