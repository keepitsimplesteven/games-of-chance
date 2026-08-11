# Requirements Document

## Introduction

Add a SPLASH phase as the new initial state when a game plugin is loaded. This phase displays the game name in a modal and gates gameplay behind a host-initiated "Play Game" action. Non-host players see a waiting message. The SPLASH phase sits between game selection (SET_GAME_TYPE) and the first PICKING phase, acting as a lightweight UI gate with minimal server logic changes — the existing `beginRound()` flow remains untouched and is simply deferred until the host dismisses the splash screen.

Phase 1 focuses on server logic and a placeholder modal (game name only). Individual splash screen content (descriptions, reward structure) will be designed per-plugin in a follow-up.

## Glossary

- **Room_Server**: The PartyKit server room that manages game state, phase transitions, and message handling
- **RoundPhase**: The type union defining valid game phases, currently: LOBBY | PICKING | RESOLVING | RESULT | END_GAME | END_TOURNAMENT
- **Splash_Modal**: The client-side modal component rendered during the SPLASH phase
- **Host**: The player whose role is "host" with authority to advance game state
- **Non_Host_Player**: Any connected player whose role is not "host"
- **GameView**: The client component that renders game-specific UI based on the current phase
- **Plugin**: A registered game implementation (coin-toss, battle-bots, big-wheel, playcaller)

## Requirements

### Requirement 1: SPLASH Phase Type Registration

**User Story:** As a developer, I want SPLASH to be a valid RoundPhase value, so that the type system enforces correctness across server and client code.

#### Acceptance Criteria

1. THE RoundPhase type SHALL include "SPLASH" as a valid member alongside the existing phases (LOBBY, PICKING, RESOLVING, RESULT, END_GAME, END_TOURNAMENT)

### Requirement 2: Transition to SPLASH on Game Selection

**User Story:** As a host, I want the game to enter a splash screen when I select a game from the lobby, so that all players can see what game is about to be played before it starts.

#### Acceptance Criteria

1. WHEN the host sends a SET_GAME_TYPE message while in LOBBY phase, THE Room_Server SHALL set the round phase to "SPLASH"
2. WHEN the round phase transitions to SPLASH, THE Room_Server SHALL broadcast the updated state to all connected clients
3. WHILE in SPLASH phase, THE Room_Server SHALL retain the selected gameType in the room config so clients can display the game name

### Requirement 3: Host-Initiated Transition from SPLASH to PICKING

**User Story:** As a host, I want to tap "Play Game" on the splash screen to start the game, so that I control when gameplay begins.

#### Acceptance Criteria

1. WHEN the host sends a START_ROUND message while in SPLASH phase, THE Room_Server SHALL call the existing beginRound logic to transition to the PICKING phase
2. WHEN a Non_Host_Player sends a START_ROUND message while in SPLASH phase, THE Room_Server SHALL reject it with a NOT_HOST error
3. WHILE in SPLASH phase, THE Room_Server SHALL keep settingsLocked as false so game settings remain editable until the host starts

### Requirement 4: SPLASH Phase Guard Rules

**User Story:** As a developer, I want clear guard rules for the SPLASH phase, so that invalid transitions are rejected.

#### Acceptance Criteria

1. WHILE in SPLASH phase, THE Room_Server SHALL reject SUBMIT_PICK messages with a WRONG_PHASE error
2. WHILE in SPLASH phase, THE Room_Server SHALL allow SET_GAME_TYPE messages so the host can switch games before starting
3. WHEN the host sends SET_GAME_TYPE while in SPLASH phase, THE Room_Server SHALL update the game type and remain in SPLASH phase

### Requirement 5: Client Splash Modal Rendering

**User Story:** As a player, I want to see a modal with the game name when the splash screen is active, so that I know which game is about to be played.

#### Acceptance Criteria

1. WHEN the phase is SPLASH, THE GameView SHALL render the Splash_Modal component
2. THE Splash_Modal SHALL display the name of the currently selected game
3. WHEN the current player is the Host, THE Splash_Modal SHALL display a "Play Game" button that sends a START_ROUND message
4. WHEN the current player is a Non_Host_Player, THE Splash_Modal SHALL display the text "Waiting for host to start game" in place of the button

### Requirement 6: Return to LOBBY Clears SPLASH

**User Story:** As a host, I want returning to the lobby to exit the splash screen cleanly, so that the game selection flow resets properly.

#### Acceptance Criteria

1. WHEN the host sends a RETURN_TO_LOBBY message while in SPLASH phase, THE Room_Server SHALL transition the phase back to LOBBY
2. WHEN transitioning from SPLASH to LOBBY, THE Room_Server SHALL broadcast the updated state to all connected clients
