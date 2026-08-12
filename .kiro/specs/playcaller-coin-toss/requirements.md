# Requirements Document

## Introduction

Add a coin toss ceremony to Playcaller that occurs after the VS screen and before the first down of each bracket round matchup. The coin toss determines which player is on offense and which is on defense. The higher-seeded player calls heads or tails, the coin is flipped, and the winner of the toss chooses their preferred side (offense or defense). This replaces the current random offense/defense assignment in `initializeDrives()`. The coin flip resolution logic should be shared with (or ported from) the existing coin-toss game to maintain consistency.

## Glossary

- **Coin_Toss_Ceremony**: The pre-drive phase sequence where a coin flip determines who chooses offense/defense for a matchup
- **Caller**: The higher-seeded player in a matchup who calls heads or tails before the coin flip
- **Chooser**: The player who won the coin toss and selects offense or defense
- **Waiter**: The player who lost the coin toss and has no interaction during the side selection step
- **Coin_Side**: A value of either "HEADS" or "TAILS", shared with the existing coin-toss game types
- **Side_Selection**: The choice between "OFFENSE" and "DEFENSE" made by the Chooser
- **COIN_TOSS phase**: A new RoundPhase value representing the coin toss ceremony period
- **Playcaller_Server**: The server-side playcaller game logic (PlaycallerPlugin, roomHandlers)
- **Playcaller_Client**: The client-side playcaller game UI and state management
- **Bracket_Seed**: The numeric seed assigned to a player in the bracket (lower number = higher seed)

## Requirements

### Requirement 1: New COIN_TOSS Game Phase

**User Story:** As a developer, I want a distinct COIN_TOSS phase in the Playcaller game flow, so that the coin toss ceremony has its own state and does not conflict with the existing PICKING phase logic.

#### Acceptance Criteria

1. WHEN all drives for a bracket round are initialized and the ROUND_INTRO_DELAY_MS (3000 ms) timer elapses, THE Playcaller_Server SHALL transition the round phase to COIN_TOSS before entering the first PICKING phase
2. WHILE the game is in the COIN_TOSS phase, THE Playcaller_Server SHALL reject any PLAY_SELECTION messages with a "WRONG_PHASE" error and SHALL NOT start the pick deadline timer
3. WHEN every active matchup (excluding byes) has received a coin toss result, THE Playcaller_Server SHALL transition to the PICKING phase and begin the first down within 500 ms
4. THE Playcaller_Server SHALL include "COIN_TOSS" as a valid value in the RoundPhase type, producing the phase order: LOBBY → SPLASH → COIN_TOSS → PICKING → RESOLVING → RESULT
5. IF the COIN_TOSS phase does not complete within 10 000 ms of entering the phase, THEN THE Playcaller_Server SHALL auto-resolve all pending coin tosses with a random result and transition to the PICKING phase
6. WHEN the round phase transitions to COIN_TOSS, THE Playcaller_Server SHALL broadcast a STATE_SYNC message to all connected clients with the updated phase value

### Requirement 2: Coin Call by Higher Seed

**User Story:** As the higher-seeded player, I want to call heads or tails for the coin flip, so that I have the traditional advantage of the coin toss call.

#### Acceptance Criteria

1. WHEN the COIN_TOSS phase begins for a matchup, THE Playcaller_Server SHALL designate the higher-seeded player (playerA in the Matchup) as the Caller
2. WHEN the COIN_TOSS phase begins, THE Playcaller_Client SHALL display a coin call UI presenting exactly two options ("HEADS" and "TAILS") only to the Caller for that matchup
3. WHILE the Caller has not submitted a coin call, THE Playcaller_Client SHALL display a waiting indicator to the lower-seeded player showing that the coin call is pending
4. WHEN a COIN_TOSS_CALL message is received from the Caller, THE Playcaller_Server SHALL validate that the submitted value is either "HEADS" or "TAILS"
5. IF a COIN_TOSS_CALL message contains a value that is not "HEADS" or "TAILS", THEN THE Playcaller_Server SHALL reject the message with an "INVALID_COIN_SIDE" error and leave the coin toss state unchanged
6. IF a COIN_TOSS_CALL message is received from a player who is not the Caller for their matchup, THEN THE Playcaller_Server SHALL reject the message with an "INVALID_CALLER" error
7. IF a COIN_TOSS_CALL message is received from the Caller after they have already submitted a coin call for that matchup, THEN THE Playcaller_Server SHALL reject the message with a "DUPLICATE_CALL" error and retain the original call

### Requirement 3: Coin Flip Resolution

**User Story:** As a player, I want the coin flip to be resolved fairly by the server, so that the outcome is unbiased and synchronized for all viewers.

#### Acceptance Criteria

1. WHEN the Caller submits a valid coin call, THE Playcaller_Server SHALL resolve the flip using the shared coin flip logic (Math.random() < 0.5 producing "HEADS" or "TAILS") and record a flippedAt timestamp (epoch milliseconds via Date.now())
2. WHEN the coin flip is resolved, THE Playcaller_Server SHALL broadcast the flip result (outcome, flippedAt timestamp, the Caller's submitted call value, and the designated Chooser player ID) to all connected clients in the room
3. WHEN the flip outcome matches the Caller's call, THE Playcaller_Server SHALL designate the Caller as the Chooser and the lower-seeded player as the Waiter
4. WHEN the flip outcome does not match the Caller's call, THE Playcaller_Server SHALL designate the lower-seeded player (playerB) as the Chooser and the Caller as the Waiter
5. IF a COIN_TOSS_CALL message is received for a matchup whose coin flip has already been resolved, THEN THE Playcaller_Server SHALL ignore the message and not re-resolve the flip

### Requirement 4: Side Selection by Chooser

**User Story:** As the coin toss winner, I want to choose whether I play offense or defense, so that I have strategic control over the matchup.

#### Acceptance Criteria

1. WHEN the Chooser is determined, THE Playcaller_Client SHALL display an offense/defense selection UI presenting exactly two options ("OFFENSE" and "DEFENSE") only to the Chooser
2. WHILE the Chooser has not submitted a side selection, THE Playcaller_Client SHALL display a waiting state to the Waiter indicating that the Chooser is selecting a side
3. WHEN a COIN_TOSS_CHOICE message with a valid Side_Selection is received from the Chooser, THE Playcaller_Server SHALL record the offense/defense assignment for that matchup and broadcast the updated ceremony state to all clients in that matchup
4. IF a COIN_TOSS_CHOICE message is received from the Waiter, THEN THE Playcaller_Server SHALL reject the message with an "INVALID_CHOOSER" error
5. WHEN the Chooser selects "OFFENSE", THE Playcaller_Server SHALL assign the Chooser as the offense player and the Waiter as the defense player for that matchup's drive
6. WHEN the Chooser selects "DEFENSE", THE Playcaller_Server SHALL assign the Chooser as the defense player and the Waiter as the offense player for that matchup's drive
7. IF a COIN_TOSS_CHOICE message is received with a selection value that is not "OFFENSE" or "DEFENSE", THEN THE Playcaller_Server SHALL reject the message with an "INVALID_SELECTION" error and not modify the matchup state

### Requirement 5: Drive Initialization Integration

**User Story:** As a developer, I want the coin toss result to feed into drive initialization, so that offense/defense is determined by the ceremony instead of random assignment.

#### Acceptance Criteria

1. WHEN all matchups in the current bracket round have completed their coin toss ceremonies, THE Playcaller_Server SHALL call initializeDrives with a map of matchupId to offense/defense player assignments derived from the coin toss results, assigning the designated offense player a higher seed value than the defense player so that createDriveState produces the correct role assignment
2. WHEN initializeDrives is called with explicit offense/defense assignments, THE Playcaller_Server SHALL use the provided assignments to determine seed values for each matchup instead of generating a random offense/defense assignment via Math.random()
3. WHILE SKIP_GAMEPLAY is true in settings, THE Playcaller_Server SHALL skip the COIN_TOSS phase entirely and initialize drives using random offense/defense assignment (Math.random() < 0.5) as the current implementation does
4. IF a coin toss result references a matchupId that does not exist in the current bracket round, THEN THE Playcaller_Server SHALL ignore that entry and not create a DriveState for it

### Requirement 6: Spectator Experience

**User Story:** As a spectator (eliminated or bye player), I want to watch the coin toss ceremony play out, so that I remain engaged during the pre-game sequence.

#### Acceptance Criteria

1. WHILE the game is in the COIN_TOSS phase, THE Playcaller_Client SHALL display the coin toss ceremony state to spectators without rendering the coin call or side selection interactive controls
2. WHEN the coin flip result is broadcast, THE Playcaller_Client SHALL display the same coin flip animation to spectators as to the participants, synchronized using the flippedAt timestamp from the broadcast
3. WHEN the Chooser makes their side selection, THE Playcaller_Client SHALL display the selected side and the resulting offense/defense assignment for both players to spectators
4. WHILE the game is in the COIN_TOSS phase with multiple active matchups, THE Playcaller_Client SHALL allow spectators to select which matchup's coin toss ceremony to view
5. WHILE the game is in the COIN_TOSS phase, THE Playcaller_Client SHALL display the identity of the Caller during the coin call step and the identity of the Chooser during the side selection step to spectators

### Requirement 7: Timeout Handling

**User Story:** As a player, I want the game to progress even if my opponent is unresponsive, so that the coin toss ceremony does not stall the game indefinitely.

#### Acceptance Criteria

1. WHEN the COIN_TOSS phase begins for a matchup, THE Playcaller_Server SHALL start a per-matchup timeout timer of 20,000 milliseconds for the coin call step and broadcast a coinCallDeadlineMs timestamp to all clients
2. IF the Caller does not submit a coin call within 20,000 milliseconds of the coin call step starting, THEN THE Playcaller_Server SHALL auto-assign a random coin call ("HEADS" or "TAILS") on behalf of the Caller and immediately proceed to coin flip resolution
3. WHEN the side selection step begins for a matchup, THE Playcaller_Server SHALL start a per-matchup timeout timer of 20,000 milliseconds for the side choice and broadcast a sideChoiceDeadlineMs timestamp to all clients
4. IF the Chooser does not submit a side selection within 20,000 milliseconds of the side selection step starting, THEN THE Playcaller_Server SHALL auto-assign "OFFENSE" to the Chooser and immediately proceed to drive initialization for that matchup
5. WHEN a timeout auto-assigns a coin call or side selection, THE Playcaller_Server SHALL broadcast the updated coin toss ceremony state to all clients so that the auto-assigned values are reflected in the UI

### Requirement 8: Client-Server Message Protocol

**User Story:** As a developer, I want well-defined message types for the coin toss ceremony, so that the client and server can communicate the ceremony state changes reliably.

#### Acceptance Criteria

1. THE Playcaller_Server SHALL accept a COIN_TOSS_CALL client message with payload containing matchupId (string) and side (CoinSide: "HEADS" | "TAILS")
2. THE Playcaller_Server SHALL accept a COIN_TOSS_CHOICE client message with payload containing matchupId (string) and selection (Side_Selection: "OFFENSE" | "DEFENSE")
3. THE Playcaller_Server SHALL include coin toss ceremony state in the PlaycallerGameState broadcast containing, at minimum, the current ceremony step identifier, the caller's chosen side, the toss result, and the winner's side selection so that clients can determine which ceremony step to render for each matchup
4. WHEN the Playcaller_Server validates and applies a coin call or side choice, THE Playcaller_Server SHALL broadcast an updated PlaycallerGameState via STATE_SYNC to all connected clients
5. IF a COIN_TOSS_CALL or COIN_TOSS_CHOICE message references an invalid matchupId, is sent by a player who is not the designated actor for that ceremony step, or is received when the matchup is not in the expected ceremony phase, THEN THE Playcaller_Server SHALL reject the message and respond to the sender with an ERROR message indicating the reason for rejection without modifying ceremony state

### Requirement 9: Shared Coin Flip Logic

**User Story:** As a developer, I want the coin flip resolution to reuse logic from the existing coin-toss game, so that behavior is consistent across games and maintenance is centralized.

#### Acceptance Criteria

1. THE Playcaller_Server SHALL use the CoinSide type from the @games-of-chance/shared package for representing coin call values and flip outcomes
2. THE Playcaller_Server SHALL resolve coin flips using a shared utility function that returns "HEADS" when the RNG value is less than 0.5 and "TAILS" when the RNG value is greater than or equal to 0.5, matching the threshold logic in CoinTossPlugin.resolveRound()
3. WHERE the coin flip logic is extracted into a shared utility, THE shared utility SHALL accept an optional RNG function parameter of signature `() => number` (returning a value in [0, 1)), defaulting to Math.random when not provided, and SHALL return a CoinSide value
4. WHEN the Playcaller_Server resolves a coin flip, THE Playcaller_Server SHALL invoke the shared coin flip utility rather than implementing independent flip logic

### Requirement 10: Bot Support for Coin Toss

**User Story:** As a developer, I want bots to participate in the coin toss ceremony automatically, so that bot matchups proceed without stalling.

#### Acceptance Criteria

1. WHEN a bot is the Caller in a matchup, THE Playcaller_Server SHALL auto-submit a random coin call ("HEADS" or "TAILS" with equal probability) after a delay between 1500ms and 3500ms, selected randomly within that range
2. WHEN a bot is the Chooser in a matchup, THE Playcaller_Server SHALL auto-submit "OFFENSE" as the side selection after a delay between 1500ms and 3500ms, selected randomly within that range
3. WHEN both players in a matchup are bots, THE Playcaller_Server SHALL resolve the entire coin toss ceremony (coin call, flip resolution, and side selection) automatically without client interaction, applying the same per-step delays as criteria 1 and 2
4. IF the coin toss ceremony timeout fires before the bot's scheduled delay elapses, THEN THE Playcaller_Server SHALL cancel the pending bot timer and allow the timeout handler (Requirement 7) to auto-assign the value instead
