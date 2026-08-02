# Requirements Document

## Introduction

This document defines the requirements for enhancing the Coin Toss gameplay experience. The enhancements improve visual clarity of game phases, provide better feedback to players during and after rounds, implement streak-based scoring multipliers, and add a final results screen with a podium layout. These changes apply to both the React client UI and the PartyKit TypeScript server logic.

Several of these enhancements are designed at the game engine level and apply to all game types (current and future):
- **Game Phase Indicator** (Req 1) — plugin-agnostic, renders based on round phase from any game plugin
- **Final Results Screen / END_GAME phase** (Req 5) — plugin-agnostic, implemented in the core room lifecycle so all game types benefit from a graceful end-of-game flow

The remaining enhancements are specific to the Coin Toss game plugin:
- **Pick Confirmation** (Req 2) — specific to coin-toss binary pick UI
- **Round Number Display** (Req 3) — displayed in coin-toss only (other games may opt in later); round tracking remains internal for all games
- **Current Player Result Prominence** (Req 4) — coin-toss result display
- **Streak Multiplier Scoring** (Req 6) — coin-toss scoring logic
- **Streak Indicators** (Req 7) — coin-toss leaderboard display

## Glossary

- **Game_Client**: The React front-end application that renders game UI and receives state from the server via WebSocket. Plugin-agnostic components live in `components/game/`; coin-toss-specific components live in `games/coin-toss/`
- **Game_Server**: The PartyKit server (`room.ts` and game plugins) that manages game state, processes picks, scores rounds, and broadcasts state to clients. The room lifecycle (phases, END_GAME) is plugin-agnostic; scoring logic is plugin-specific
- **Phase_Indicator**: A UI element that displays the current game phase (PICKING, RESOLVING, RESULT) to the player
- **Pick_Confirmation**: A text element shown on screen after a player submits their pick, persisting through the flip animation
- **Round_Counter**: A UI element displaying the current round number and total rounds configured for the game
- **Result_Panel**: The section of the result display that shows player outcomes after a round resolves
- **Final_Results_Screen**: A dedicated screen shown after the last round completes, displaying final standings in a podium layout
- **Streak_Engine**: The server-side logic that tracks consecutive correct guesses per player and computes score multipliers
- **Streak_Indicator**: A visual icon shown next to a player's name on the in-game leaderboard representing their current streak status
- **Streak_Counter**: A per-player integer tracking consecutive correct or incorrect guesses across rounds within a game
- **Multiplier**: A numeric factor applied to base points earned for a correct guess, determined by the player's current positive streak length
- **Podium_Layout**: A visual arrangement showing the top 3 players in a 1st/2nd/3rd place format on the Final_Results_Screen
- **Host**: The player with the "host" role who controls game flow (start rounds, end game, return to lobby)

## Requirements

### Requirement 1: Game Phase Indicator (Plugin-Agnostic)

**User Story:** As a player, I want a clear visual indicator of what phase the game is in, so that I always know whether I should be picking, watching, or viewing results.

#### Acceptance Criteria

1. WHILE the round phase is PICKING, THE Game_Client SHALL display a Phase_Indicator with the text "Pick a Side" and a distinct visual style differentiating it from other phases
2. WHILE the round phase is RESOLVING, THE Game_Client SHALL display a Phase_Indicator with the text "Flipping..." and a distinct visual style differentiating it from other phases
3. WHILE the round phase is RESULT, THE Game_Client SHALL display a Phase_Indicator with the text "Results" and a distinct visual style differentiating it from other phases
4. WHEN the round phase transitions from one phase to another, THE Game_Client SHALL update the Phase_Indicator within the same render cycle as the phase change

### Requirement 2: Pick Confirmation Display

**User Story:** As a player, I want to see my pick displayed on screen after I submit it, so that I have confidence my choice was registered and can remember what I picked during the flip animation.

#### Acceptance Criteria

1. WHEN a player submits a pick, THE Game_Client SHALL display Pick_Confirmation text showing "You chose Heads" or "You chose Tails" matching the submitted pick
2. WHILE the round phase is PICKING and a pick has been submitted, THE Game_Client SHALL keep the Pick_Confirmation text visible in place of the PickWidget
3. WHILE the round phase is RESOLVING, THE Game_Client SHALL keep the Pick_Confirmation text visible alongside the coin flip animation
4. WHEN the round phase transitions to RESULT, THE Game_Client SHALL remove the Pick_Confirmation text and show the Result_Panel instead

### Requirement 3: Round Number Display

**User Story:** As a player, I want to see the current round number and total rounds, so that I know how far into the game we are.

#### Acceptance Criteria

1. WHILE a coin-toss game is active (phase is PICKING, RESOLVING, or RESULT), THE Game_Client SHALL display a Round_Counter showing the format "Round X of Y" where X is the current round number and Y is the configured total rounds
2. THE Game_Client SHALL position the Round_Counter at the top of the coin-toss game UI above the game-specific content
3. WHEN a new round begins, THE Game_Client SHALL update the Round_Counter to reflect the new round number
4. THE Game_Server SHALL continue to track round numbers internally for all game types regardless of whether the Round_Counter is displayed to players

### Requirement 4: Current Player Result Prominence

**User Story:** As a player, I want my own result to be visually prominent in the results list, so that I can quickly find my outcome without scanning through all players.

#### Acceptance Criteria

1. WHEN the round result is displayed, THE Result_Panel SHALL render the current player's result entry at the top of the results list regardless of player order
2. THE Result_Panel SHALL render the current player's result entry with larger text and bold font weight compared to other players' entries
3. THE Result_Panel SHALL render other players' result entries in smaller text below the current player's entry with a visual separator between the current player and other players

### Requirement 5: Final Results Screen with Podium (Plugin-Agnostic)

**User Story:** As a player, I want to see a final results screen with standings after the last round, so that the game has a satisfying conclusion rather than immediately returning to the lobby.

#### Acceptance Criteria

1. WHEN the last round's RESULT phase completes (round number equals configured total rounds), THE Game_Server SHALL transition the game to an END_GAME phase instead of immediately returning to LOBBY
2. WHILE the game is in END_GAME phase, THE Game_Client SHALL display the Final_Results_Screen showing the game leaderboard in Podium_Layout format
3. THE Final_Results_Screen SHALL display the top 3 players in a podium arrangement with 1st place elevated in the center, 2nd place on the left, and 3rd place on the right
4. THE Final_Results_Screen SHALL display all remaining players below the podium in ranked order
5. WHILE the game is in END_GAME phase, THE Game_Client SHALL display a "Return to Lobby" button visible only to the Host
6. WHEN the Host presses the "Return to Lobby" button, THE Game_Server SHALL transition all players to the LOBBY phase and reset game scores

### Requirement 6: Streak Multiplier Scoring

**User Story:** As a player, I want to earn bonus points for consecutive correct guesses, so that maintaining a streak feels rewarding and adds strategic depth.

#### Acceptance Criteria

1. THE Game_Server SHALL maintain a Streak_Counter for each player that increments by 1 for each consecutive correct guess and resets to 0 on an incorrect guess
2. WHEN a player guesses correctly with a Streak_Counter value of 0, THE Streak_Engine SHALL apply a 1x Multiplier (base points only)
3. WHEN a player guesses correctly with a Streak_Counter value of 1, THE Streak_Engine SHALL apply a 2x Multiplier to the base points
4. WHEN a player guesses correctly with a Streak_Counter value of 2 or greater, THE Streak_Engine SHALL apply a 3x Multiplier to the base points
5. THE Game_Server SHALL calculate points awarded as CORRECT_GUESS_CHIPS multiplied by the applicable Multiplier
6. WHEN a player guesses incorrectly, THE Streak_Engine SHALL reset that player's Streak_Counter to 0 and award 0 points
7. WHEN a new game starts, THE Game_Server SHALL reset all players' Streak_Counters to 0

### Requirement 7: Streak Indicators on Leaderboard

**User Story:** As a player, I want to see visual streak indicators next to player names on the leaderboard, so that I can tell who is on a hot streak or struggling.

#### Acceptance Criteria

1. THE Game_Server SHALL maintain a consecutive-wrong counter for each player that increments by 1 for each consecutive incorrect guess and resets to 0 on a correct guess
2. WHILE a player has a Streak_Counter of 0 or 1 consecutive correct and 0 or 1 consecutive wrong, THE Game_Client SHALL display no Streak_Indicator next to that player's name on the leaderboard
3. WHILE a player has a Streak_Counter of exactly 1 (2 total consecutive correct guesses including current), THE Streak_Indicator SHALL display a single fire emoji (🔥) next to the player's name indicating "heating up"
4. WHILE a player has a Streak_Counter of 2 or greater (3+ total consecutive correct guesses), THE Streak_Indicator SHALL display a double fire emoji (🔥🔥) next to the player's name
5. WHILE a player has exactly 2 consecutive incorrect guesses, THE Streak_Indicator SHALL display a single ice emoji (🧊) next to the player's name indicating "cooling off"
6. WHILE a player has 3 or more consecutive incorrect guesses, THE Streak_Indicator SHALL display a double ice emoji (🧊🧊) next to the player's name
7. WHEN a round resolves, THE Game_Server SHALL include each player's current streak status in the state broadcast so clients can render Streak_Indicators
8. THE Game_Client SHALL include the Streak_Indicator in the leaderboard entry for each player, positioned between the player name and score
