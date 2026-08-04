# Requirements Document

## Introduction

Playcaller is an American football-themed game implemented as a GamePlugin. Phase 1 focuses exclusively on the single-elimination tournament bracket structure that runs within a single game instance. Match outcomes are resolved by a pluggable strategy function — in Phase 1, winners are chosen at random. Phase 2 will replace the random resolver with actual rock-paper-scissors football play-calling mechanics. The bracket logic is fully decoupled from match resolution.

## Glossary

- **Bracket_Engine**: The server-side module responsible for generating the tournament bracket, assigning byes, seeding players, and advancing winners through rounds
- **Match_Resolver**: A pluggable function that accepts two player IDs and returns a winner ID. In Phase 1, the Match_Resolver selects a winner at random
- **Matchup**: A single pairing of two players within a tournament round
- **Bye**: An automatic advancement granted to a seeded player when the player count is not a power of 2
- **Seed**: A player's position in the bracket, derived from the session leaderboard rank at game start (seed 1 = highest ranked)
- **Tournament_Round**: One round of the bracket where all active matchups resolve simultaneously. Each tournament round maps to one room round (PICKING → RESOLVING → RESULT cycle)
- **Playcaller_Plugin**: The GamePlugin implementation for the Playcaller game, registered with gameType "playcaller"
- **Score_Table**: A configurable mapping from final tournament placement (1st, 2nd, 3rd, etc.) to point values awarded at game end
- **Spectator**: A player who has been eliminated from the bracket or is on a bye for the current round

## Requirements

### Requirement 1: Plugin Registration

**User Story:** As a host, I want Playcaller to appear as a selectable game type, so that I can start a Playcaller tournament from the lobby.

#### Acceptance Criteria

1. THE Playcaller_Plugin SHALL implement the GamePlugin interface with gameType "playcaller"
2. WHEN the Playcaller_Plugin module is imported, THE GameRegistry SHALL contain a "playcaller" entry retrievable via `registry.lookup("playcaller")`
3. THE Playcaller_Plugin SHALL declare a settingsSchema that includes a Score_Table field with a default value of [250, 125, 75, 50, 35, 25, 15, 10, 5, 5] mapping placement positions 1 through 10
4. THE Playcaller_Plugin SHALL provide implementations for validatePick, resolveRound, scoreRound, and computeGameLeaderboard as required by the GamePlugin interface

### Requirement 2: Bracket Generation

**User Story:** As a player, I want the tournament bracket to be seeded by session rank, so that higher-ranked players face lower-ranked opponents and earn byes when needed.

#### Acceptance Criteria

1. WHEN a Playcaller game starts, THE Bracket_Engine SHALL generate a single-elimination bracket for all players currently connected in the room (minimum 2, maximum 10 players)
2. THE Bracket_Engine SHALL seed players by their current session leaderboard rank, assigning seed 1 to the player with the highest session score
3. WHEN the player count is not a power of 2, THE Bracket_Engine SHALL assign first-round byes to the highest-seeded players such that the second round has a power-of-2 participant count
4. THE Bracket_Engine SHALL pair first-round matchups among non-bye players using standard bracket seeding: the highest remaining seed versus the lowest remaining seed, second-highest remaining versus second-lowest remaining, continuing inward until all non-bye players are paired
5. WHEN two or more players share the same session rank, THE Bracket_Engine SHALL break the tie by assigning seeds via a uniformly random selection among the tied players (never alphabetical)
6. WHEN bracket generation completes, THE Bracket_Engine SHALL produce a bracket structure containing the ordered list of rounds, each round containing its matchups (with assigned player seeds) and bye assignments

### Requirement 3: Round Progression

**User Story:** As a player, I want the game to advance through tournament rounds automatically, so that the bracket resolves completely within a single game session.

#### Acceptance Criteria

1. WHEN a tournament round completes, THE Playcaller_Plugin SHALL advance all matchup winners to the next round of the bracket
2. THE Playcaller_Plugin SHALL map each tournament round to one room round (one PICKING → RESOLVING → RESULT cycle)
3. WHEN only one player remains undefeated, THE Playcaller_Plugin SHALL signal game completion
4. THE Playcaller_Plugin SHALL compute the total number of tournament rounds at bracket generation time based on the player count
5. WHEN a tournament round's results are shown, THE Playcaller_Plugin SHALL remain in the RESULT phase until the host explicitly advances to the next round (no auto-progression between bracket rounds)

### Requirement 4: Match Resolution (Phase 1 — Random)

**User Story:** As a developer, I want match resolution decoupled from bracket logic, so that Phase 2 can replace the random resolver without modifying tournament structure.

#### Acceptance Criteria

1. THE Bracket_Engine SHALL accept a Match_Resolver function as a dependency, invoking the Match_Resolver with two player IDs to determine each matchup winner
2. THE Bracket_Engine SHALL use only the winner ID returned by the Match_Resolver and SHALL NOT depend on how the winner was determined
3. WHILE Phase 1 is active, THE Match_Resolver SHALL select a winner uniformly at random from the two provided player IDs
4. THE Match_Resolver interface SHALL accept two player IDs as input and return exactly one of those two player IDs as the winner
5. IF the Match_Resolver returns a player ID that is not one of the two provided input IDs, THEN THE Bracket_Engine SHALL treat the result as a resolution failure and SHALL NOT advance either player
6. THE Match_Resolver interface SHALL be designed to accommodate a future multi-step resolution (Phase 2) where the resolver may own an internal state machine (e.g., football downs/drives) that produces a single winner after multiple sub-interactions, without requiring changes to the Bracket_Engine's invocation pattern

### Requirement 5: Bye Handling

**User Story:** As a top-seeded player, I want to receive a bye when the bracket is uneven, so that the tournament follows standard single-elimination bracket rules.

#### Acceptance Criteria

1. WHEN a player receives a bye, THE Bracket_Engine SHALL advance that player to the next round without invoking the Match_Resolver
2. WHILE a player is on a bye for the current tournament round, THE Playcaller_Plugin SHALL mark that player as a Spectator for the round
3. THE Bracket_Engine SHALL assign byes only in the first round of the tournament
4. THE Bracket_Engine SHALL assign the minimum number of byes required to produce a power-of-2 participant count in the second round

### Requirement 6: Scoring

**User Story:** As a player, I want to earn points based on my final tournament placement, so that the session leaderboard reflects bracket performance.

#### Acceptance Criteria

1. WHEN the tournament completes, THE Playcaller_Plugin SHALL assign points to each player based on the Score_Table and the player's final placement
2. THE Score_Table SHALL default to the values [250, 125, 75, 50, 35, 25, 15, 10, 5, 5] mapping placement positions 1 through 10
3. THE Score_Table SHALL be configurable via the Playcaller_Plugin settingsSchema and SHALL contain between 2 and 10 entries, where each entry is a non-negative integer and entries are in descending order
4. THE Playcaller_Plugin SHALL assign tied placements (players eliminated in the same round) the same point value corresponding to the numerically lowest shared placement position (e.g., if two players are eliminated in the semi-finals sharing positions 3-4, both receive the position-3 point value from the Score_Table)
5. THE Playcaller_Plugin SHALL report zero score deltas for all rounds except the final round, when all placement points are awarded at once
6. IF the number of players in the tournament exceeds the number of entries in the Score_Table, THEN THE Playcaller_Plugin SHALL assign zero points to any player whose placement position has no corresponding Score_Table entry

### Requirement 7: Spectator State

**User Story:** As an eliminated player, I want to watch ongoing matches, so that I remain engaged after losing.

#### Acceptance Criteria

1. WHEN a player loses a matchup, THE Playcaller_Plugin SHALL mark that player as a Spectator for all subsequent rounds
2. WHILE a player is a Spectator, THE Playcaller_Plugin SHALL include that player in round state broadcasts so the client can render spectator views
3. THE Playcaller_Plugin SHALL track which players are Spectators and which are active competitors in each tournament round

### Requirement 8: Client Display Layout

**User Story:** As an active player, I want my own match displayed prominently with other matches visible on the side, so that I can focus on my game while tracking the bracket.

#### Acceptance Criteria

1. WHILE a player is an active competitor in the current round, THE Playcaller_Plugin client view SHALL display that player's matchup in a large center panel
2. WHILE a player is an active competitor, THE Playcaller_Plugin client view SHALL display all other active matchups as small scoreboards in a side panel
3. WHILE a player is a Spectator, THE Playcaller_Plugin client view SHALL display all active matchups at equal size
4. WHILE matchups are actively being played, THE full bracket diagram SHALL either be hidden or collapsed into a collapsible panel
5. WHEN all matchups in a tournament round have concluded (between rounds), THE full bracket diagram SHALL be displayed at full size showing updated results

### Requirement 9: Bracket Visualization

**User Story:** As a player, I want to see the full tournament bracket, so that I can understand matchups and track progression.

#### Acceptance Criteria

1. WHEN a Playcaller game starts, THE Playcaller_Plugin client view SHALL display the complete bracket structure with all seeds and first-round matchups
2. WHEN a tournament round completes, THE Playcaller_Plugin client view SHALL update the bracket diagram to show winners advancing to the next round
3. THE Playcaller_Plugin client view SHALL visually distinguish eliminated players from active competitors in the bracket diagram
4. THE Playcaller_Plugin client view SHALL indicate which players received first-round byes in the bracket diagram

### Requirement 10: Player Count Constraints

**User Story:** As a host, I want the tournament to work with any valid room size, so that the game adapts to the number of players present.

#### Acceptance Criteria

1. THE Bracket_Engine SHALL generate a valid bracket for any player count from 2 to 10 inclusive
2. IF the active player count is fewer than 2, THEN THE Playcaller_Plugin SHALL prevent game start and return an error
3. THE Bracket_Engine SHALL compute the correct number of byes for each valid player count (0 byes for 2, 4, 8 players; 1 bye for 3; 2 byes for 5-6; 4 byes for 9-10; etc.)

### Requirement 11: Pick Handling

**User Story:** As a player in an active matchup, I want the round to resolve without requiring manual input (Phase 1), so that the random resolution proceeds automatically.

#### Acceptance Criteria

1. WHILE Phase 1 is active, THE Playcaller_Plugin validatePick function SHALL accept any pick value (picks are unused in random resolution)
2. WHILE Phase 1 is active, THE Playcaller_Plugin SHALL resolve each matchup using the random Match_Resolver regardless of submitted picks
3. THE Playcaller_Plugin SHALL use a short pickWindowMs value (3000ms) to keep the random-resolution phase brief while still allowing the bracket display to render

### Requirement 12: Game Leaderboard

**User Story:** As a player, I want to see final standings at the end of the tournament, so that I know how I placed.

#### Acceptance Criteria

1. WHEN the tournament completes, THE Playcaller_Plugin computeGameLeaderboard function SHALL return entries ranked by final tournament placement (1st = rank 1)
2. THE Playcaller_Plugin computeGameLeaderboard function SHALL assign score values from the Score_Table corresponding to each player's placement
3. WHILE the tournament is in progress, THE Playcaller_Plugin computeGameLeaderboard function SHALL return entries ordered by remaining bracket depth (active players ranked above eliminated players)
