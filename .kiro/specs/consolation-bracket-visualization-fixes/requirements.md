# Requirements Document

## Introduction

This document specifies the requirements for fixing four bugs in the consolation bracket system of the Playcaller tournament game. The fixes address timing of consolation rounds, placement label accuracy, visual layout structure, and eliminated-player styling in consolation contexts.

## Glossary

- **Bracket_Engine**: The server-side module (`BracketEngine.ts`) responsible for generating and resolving bracket rounds and consolation matchups
- **Schedule_Builder**: The `buildSchedule()` function that maps game rounds to their main-bracket and consolation matchup assignments
- **Bracket_Visualization**: The React component (`BracketVisualization.tsx`) that renders the tournament bracket UI
- **Consolation_Row**: A new UI component that renders all consolation matchups in a dedicated horizontal row below the main bracket
- **MatchupCard**: The React component rendering a single matchup with two player slots
- **PlayerSlot**: The React component rendering a single player name within a MatchupCard
- **Consolation_Round**: A set of matchups determining final placement positions for players who did not win the main bracket. By default, players eliminated in the same main-bracket round play each other; a future "lottery re-seed" mode may rearrange these assignments before the consolation round starts.
- **placementStart**: The starting placement position for the winner of a consolation round (e.g., 3 means winner gets 3rd place)
- **Main_Bracket**: The primary single-elimination tournament bracket (Play-in through Finals)

## Requirements

### Requirement 1: Single Consolation Round Timing

**User Story:** As a tournament host, I want all consolation matchups to run in a single dedicated round between semifinals and finals, so that consolation games do not run concurrently with main bracket rounds and the tournament flow is clearer.

#### Acceptance Criteria

1. WHEN the Schedule_Builder generates a schedule, THE Schedule_Builder SHALL place ALL consolation round indices into exactly one schedule entry with `mainBracketRoundIndex` set to null
2. WHEN the Schedule_Builder generates a schedule with consolation rounds, THE consolation schedule entry SHALL be positioned immediately before the finals entry
3. THE Schedule_Builder SHALL NOT assign any consolation round indices to schedule entries that have a non-null `mainBracketRoundIndex`
4. WHEN no consolation rounds exist in the bracket, THE Schedule_Builder SHALL omit the consolation schedule entry entirely
5. THE schedule order SHALL be: main-bracket rounds (Play-in through Semifinals) followed by Consolation followed by Finals

### Requirement 2: Correct Placement Labels

**User Story:** As a player, I want to see accurate placement labels (e.g., "9th/10th", "5th/6th", "3rd/4th") on consolation matchups, so that I know exactly which placement position each consolation game determines.

#### Acceptance Criteria

1. WHEN rendering a consolation round with a single matchup, THE Consolation_Row SHALL display the label as "{ordinal(placementStart)}/{ordinal(placementStart + 1)}"
2. WHEN rendering a consolation round with two matchups (mini-bracket semi-finals), THE Consolation_Row SHALL display the label as "{ordinal(placementStart)}-{ordinal(placementStart + 3)} SF"
3. WHEN a consolation round has `placementStart` of 3, THE Consolation_Row SHALL display "3rd/4th"
4. THE label derivation SHALL use the `placementStart` field directly from each ConsolationRound object without recomputation

### Requirement 3: Separate Consolation Row Layout

**User Story:** As a player viewing the bracket, I want consolation matchups displayed in a dedicated row below the main bracket, so that main-bracket progression and consolation games are visually distinct.

#### Acceptance Criteria

1. THE Bracket_Visualization SHALL render the main bracket as a horizontal row of round columns (Play-in, Quarter-Finals, Semi-Finals, Final)
2. THE Bracket_Visualization SHALL render all consolation matchups in a separate horizontal row positioned below the main bracket row
3. THE Consolation_Row SHALL display a "Consolation" label on the left side of the row
4. WHEN consolation matchups have unassigned players (empty playerA or playerB), THE Consolation_Row SHALL display "TBD" in those player slots
5. THE Consolation_Row SHALL visually align each consolation matchup under the main-bracket column determined by its placement position: column index = `totalRounds - 1 - floor((placementStart - 3) / 2)`
6. FOR a 10-player bracket (4 columns), the alignment SHALL be: 9th/10th under Play-in (column 0), 7th/8th under Quarter-Finals (column 1), 5th/6th under Semi-Finals (column 2), 3rd/4th under Finals (column 3)
7. WHEN multiple consolation matchups map to the same column (e.g., mini-bracket semi-finals sharing a placementStart), they SHALL stack vertically within that column
8. WHEN a consolation round is resolved, THE Consolation_Row SHALL display winner highlighting and loser dimming on the corresponding MatchupCard

### Requirement 4: Consolation Player Styling

**User Story:** As a player in a consolation matchup, I want to see my name displayed without eliminated styling (dimmed/line-through), so that it is clear I am still actively competing in consolation.

#### Acceptance Criteria

1. WHEN rendering a PlayerSlot within a consolation MatchupCard, THE PlayerSlot SHALL NOT apply eliminated styling (dimmed text with line-through) based on main-bracket elimination status
2. WHEN a consolation matchup is resolved and a player has lost, THE PlayerSlot SHALL apply loser styling (dimmed text with line-through) to the losing player
3. WHEN a consolation matchup is resolved and a player has won, THE PlayerSlot SHALL apply winner styling (highlighted with gold border) to the winning player
4. WHEN rendering a PlayerSlot outside of consolation context, THE PlayerSlot SHALL continue to apply eliminated styling for eliminated players
5. THE MatchupCard SHALL accept an `isConsolation` prop that controls whether elimination styling is suppressed in its PlayerSlot children
