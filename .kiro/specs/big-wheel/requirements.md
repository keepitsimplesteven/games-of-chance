# Requirements Document

## Introduction

Big Wheel is a game plugin inspired by The Price Is Right's Showcase Showdown wheel. Players take turns spinning a wheel twice in sequence, with all other players watching each spin live. The wheel values come from a configurable reel strip array (similar to a slot machine reel strip). Each player's two spin results are summed to produce their final score. After all players have spun, a leaderboard ranks everyone by total score descending. Spin order is determined by the session leaderboard rankings at game launch time.

## Glossary

- **Big_Wheel_Plugin**: The server-side GamePlugin implementation for the Big Wheel game type
- **Reel_Strip**: An ordered array of numeric values representing the wheel's segments; a spin result is selected by choosing a random index from this array
- **Spin**: A single wheel rotation that resolves to one value from the Reel_Strip
- **Spin_Order**: The sequence in which players take their turns, determined by session leaderboard rank (1st place spins first, 10th place spins last)
- **Round**: A single player's turn consisting of two sequential Spins; the number of rounds equals the number of players
- **Active_Spinner**: The player currently taking their turn (performing their two Spins)
- **Spin_Total**: The sum of a player's two Spin values, used as their final score
- **Wheel_UI**: The client-side animated wheel component that visualizes the spin result
- **Pick**: The spin action submitted by the Active_Spinner to trigger a wheel spin

## Requirements

### Requirement 1: Game Registration and Plugin Interface

**User Story:** As a host, I want Big Wheel to appear as a selectable game type, so that I can launch it from the lobby.

#### Acceptance Criteria

1. THE Big_Wheel_Plugin SHALL implement the GamePlugin interface with gameType "big-wheel" and register itself in the GameRegistry singleton upon module import
2. WHEN the host selects "big-wheel" from the game tile grid, THE Big_Wheel_Plugin SHALL be resolved from the GameRegistry via lookup without throwing an error
3. THE Big_Wheel_Plugin SHALL declare a SettingsSchema containing a field for the Reel_Strip that allows the host to configure the ordered array of numeric wheel segment values
4. THE Big_Wheel_Plugin SHALL define a pickWindowMs of 15000 milliseconds as the default pick window duration
5. IF the GameRegistry lookup for "big-wheel" fails because the plugin is not registered, THEN THE system SHALL return an error message indicating an unknown game type

### Requirement 2: Reel Strip Configuration

**User Story:** As a host, I want to configure the wheel values, so that I can tune the game difficulty and scoring range.

#### Acceptance Criteria

1. THE Big_Wheel_Plugin SHALL define a default Reel_Strip array containing 20 positive integer values: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
2. WHEN the host modifies the Reel_Strip via game settings, THE Big_Wheel_Plugin SHALL use the updated Reel_Strip for all subsequent spins
3. THE Big_Wheel_Plugin SHALL validate that the Reel_Strip contains at least 2 and at most 100 values
4. THE Big_Wheel_Plugin SHALL validate that all Reel_Strip values are positive integers between 1 and 10,000 inclusive
5. IF the host submits a Reel_Strip that fails validation, THEN THE Big_Wheel_Plugin SHALL reject the update, retain the previously valid Reel_Strip, and return an error indicating the validation rule that was violated

### Requirement 3: Spin Order Determination

**User Story:** As a player, I want the spin order to reflect current session standings, so that top-ranked players spin first.

#### Acceptance Criteria

1. WHEN a Big Wheel game is launched, THE Big_Wheel_Plugin SHALL determine Spin_Order by sorting players by their current session leaderboard rank in ascending order (rank 1 spins first)
2. WHEN two or more players share the same session rank, THE Big_Wheel_Plugin SHALL break ties randomly (non-deterministic order among tied players)
3. WHEN a Big Wheel game is launched, THE Big_Wheel_Plugin SHALL set the total round count equal to the number of connected players (including bots) at game launch
4. WHEN a Big Wheel game is launched, THE Big_Wheel_Plugin SHALL include all connected players and bots in the Spin_Order and broadcast the determined order to all connected players via STATE_SYNC

### Requirement 4: Round Lifecycle (Single Player's Turn)

**User Story:** As a player, I want to watch each player spin one at a time, so that the game creates suspense and a shared viewing experience.

#### Acceptance Criteria

1. WHEN a round begins, THE Big_Wheel_Plugin SHALL designate the next player in Spin_Order as the Active_Spinner and transition to the PICKING phase
2. WHILE a round is in the PICKING phase, THE Big_Wheel_Plugin SHALL accept a Pick only from the Active_Spinner
3. WHEN the Active_Spinner submits a Pick, THE Big_Wheel_Plugin SHALL transition to the RESOLVING phase and resolve the spin by selecting a uniformly random index from the Reel_Strip
4. IF the Active_Spinner has completed fewer than 2 Spins in the current round after a spin resolves, THEN THE Big_Wheel_Plugin SHALL return to the PICKING phase for the next spin
5. WHEN the Active_Spinner has completed exactly 2 Spins, THE Big_Wheel_Plugin SHALL compute the Spin_Total as the sum of the two spin values and transition to the RESULT phase
6. IF the Active_Spinner does not submit a Pick within the configured pickWindowMs duration, THEN THE Big_Wheel_Plugin SHALL auto-resolve the spin by selecting a uniformly random index from the Reel_Strip
7. WHEN a spin resolves, THE Big_Wheel_Plugin SHALL broadcast the spin result and current spin number (1 or 2) to all connected players

### Requirement 5: Spin Resolution

**User Story:** As a player, I want each spin to produce a fair random result from the wheel, so that outcomes feel legitimate.

#### Acceptance Criteria

1. WHEN resolving a spin, THE Big_Wheel_Plugin SHALL select a uniformly random index in the range [0, Reel_Strip.length - 1] from the Reel_Strip array
2. WHEN a spin is resolved, THE Big_Wheel_Plugin SHALL return the value at the selected index as the spin result
3. WHEN a spin is resolved, THE Big_Wheel_Plugin SHALL include both the selected index and the corresponding value in the round result payload so the client can animate the wheel landing position
4. THE Big_Wheel_Plugin SHALL guarantee that the value at the returned index equals the returned spin result for every resolved spin (round-trip consistency property)

### Requirement 6: Scoring

**User Story:** As a player, I want my final score to be the sum of my two spins, so that the scoring is straightforward and easy to understand.

#### Acceptance Criteria

1. WHEN a player completes both Spins, THE Big_Wheel_Plugin SHALL compute the Spin_Total as the arithmetic sum of the two spin values
2. WHEN a player's round ends, THE Big_Wheel_Plugin SHALL report the Spin_Total as the player's score delta for the round via RoundScoreResult with the player's id mapped to the Spin_Total in the deltas record
3. THE Big_Wheel_Plugin SHALL accumulate each player's Spin_Total into the game score record by adding the round delta to the player's running game score

### Requirement 7: Game Leaderboard

**User Story:** As a player, I want to see the final standings ranked by total score, so that I know who won.

#### Acceptance Criteria

1. THE Big_Wheel_Plugin SHALL produce a GameLeaderboardEntry array sorted by Spin_Total in descending order
2. WHEN two or more players have the same Spin_Total, THE Big_Wheel_Plugin SHALL break the tie by favoring the player with the higher session leaderboard rank (lower rank number wins)
3. IF two or more players have the same Spin_Total AND the same session rank, THE Big_Wheel_Plugin SHALL break the remaining tie randomly
4. THE Big_Wheel_Plugin SHALL only include connected players in the game leaderboard
5. WHEN the game ends (all rounds complete), THE Big_Wheel_Plugin SHALL include the final GameLeaderboardEntry array in the STATE_SYNC broadcast so the client can render the final leaderboard on the END_GAME phase screen

> **Future consideration (out of scope):** A configurable "TIEBREAK" mode may be added later that triggers a special tie-breaking round at the final results screen instead of using static tiebreaker rules.

### Requirement 8: Pick Validation

**User Story:** As a developer, I want invalid picks to be rejected, so that the game state remains consistent.

#### Acceptance Criteria

1. THE Big_Wheel_Plugin SHALL validate that a pick is an object with a type field equal to "spin"
2. IF a player who is not the Active_Spinner submits a Pick, THEN THE Big_Wheel_Plugin SHALL reject the pick and the server SHALL send an ERROR message with a code indicating the player is not the active spinner
3. IF the Active_Spinner submits a pick with an invalid format, THEN THE Big_Wheel_Plugin SHALL reject the pick and the server SHALL send an ERROR message with a code indicating invalid pick format
4. IF a pick is rejected, THEN THE Big_Wheel_Plugin SHALL not modify the round state or record any spin result for that submission

### Requirement 9: Client Wheel UI

**User Story:** As a player, I want to see an animated wheel spin and land on the result, so that the experience is engaging and visually exciting.

#### Acceptance Criteria

1. WHEN the RESOLVING phase begins, THE Wheel_UI SHALL display an animated wheel spinning through the Reel_Strip values
2. THE Wheel_UI SHALL land on the segment corresponding to the resolved index from the spin result
3. WHEN the spin animation completes, THE Wheel_UI SHALL display the landed value prominently
4. WHILE a spin is animating, THE Wheel_UI SHALL prevent the Active_Spinner from submitting another Pick
5. THE Wheel_UI SHALL display both spin results and the running Spin_Total for the Active_Spinner's turn

### Requirement 10: Spectator Experience

**User Story:** As a spectator (non-active player), I want to watch the current spinner's wheel in real time, so that the game feels communal.

#### Acceptance Criteria

1. WHILE another player is the Active_Spinner, THE Wheel_UI SHALL display the same wheel animation to all connected players
2. THE Wheel_UI SHALL display the Active_Spinner's name prominently during their turn
3. WHILE waiting for their own turn, THE Wheel_UI SHALL display the player's position in the Spin_Order queue

### Requirement 11: Game State Broadcasting

**User Story:** As a developer, I want all players to receive consistent state updates, so that the shared viewing experience stays synchronized.

#### Acceptance Criteria

1. WHEN a spin resolves, THE Big_Wheel_Plugin SHALL broadcast a STATE_SYNC message to all connected players containing the spin result and updated scores
2. WHEN a round transitions between phases, THE Big_Wheel_Plugin SHALL broadcast the phase change to all connected players
3. THE Big_Wheel_Plugin SHALL include the current Active_Spinner identity and spin number (1 or 2) in the broadcast state

### Requirement 12: Disconnection Handling

**User Story:** As a player, I want the game to continue if someone disconnects, so that one player leaving does not ruin the experience for everyone.

#### Acceptance Criteria

1. IF the Active_Spinner disconnects during their turn, THEN THE Big_Wheel_Plugin SHALL auto-resolve their remaining Spins using random Reel_Strip indices
2. IF a non-active player disconnects, THEN THE Big_Wheel_Plugin SHALL skip their turn when their position in Spin_Order arrives
3. WHEN a disconnected player's turn is skipped, THE Big_Wheel_Plugin SHALL assign them a Spin_Total of 0
