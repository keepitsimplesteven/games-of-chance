# Requirements Document

## Introduction

The Playcaller Lottery Mode introduces a fantasy football draft lottery system into the Playcaller tournament. When a session is created in "Lottery" mode, all final placements are predetermined at game start by drawing from a weighted probability table (modeled after NBA draft lottery odds). The tournament bracket plays out with full drive gameplay, but the predetermined loser of each matchup can never achieve a winning outcome — their winning plays are suppressed and re-rolled. After the tournament concludes, a reveal screen shows the lottery odds table with results highlighted, followed by a draft pick selection phase where players choose their actual snake draft position in lottery-winner order.

Additionally, this feature introduces consolation/placement games to the Playcaller bracket system (for ALL modes, not just lottery) so that every player finishes with a unique placement (1st through Nth) rather than sharing tied placements when eliminated in the same round.

## Glossary

- **Lottery_Mode**: A new progression mode ("lottery") for session creation where Playcaller placements are predetermined by a weighted probability draw
- **Lottery_Odds_Table**: A 10×10 probability matrix where rows represent team seed positions and columns represent final placement positions; cell values are the probability of that seed landing in that placement
- **Lottery_Draw**: The process of sampling a placement permutation from the odds table at game start, determining every player's final position before the bracket begins
- **Predetermined_Winner**: The player who must win a given matchup according to the lottery draw results
- **Predetermined_Loser**: The player who must lose a given matchup according to the lottery draw results
- **Suppress_Loser_Victory**: The mechanism that intercepts and re-rolls any play outcome that would cause the predetermined loser to win the drive
- **Consolation_Round**: A placement game played between players eliminated in the same main bracket round to determine their exact ordering (applies to all Playcaller modes)
- **Consolation_Bracket**: The collection of all consolation rounds needed to produce unique placements for every player
- **Placement_Game**: A head-to-head matchup between two players to determine who gets the better placement within a tied group
- **Lottery_Reveal**: A post-tournament screen showing the full odds table with each player's actual result cell highlighted
- **Draft_Pick_Phase**: A post-reveal phase where players choose their actual snake draft position in lottery-winner order (1st lottery winner picks first)
- **Draft_Position**: The actual position in the snake draft a player selects (may differ from their lottery placement, since positions like 9th/10th in snake drafts can be strategically advantageous)
- **Snake_Draft**: A fantasy football draft format where pick order reverses each round, making certain positions more valuable than their number suggests

## Requirements

### Requirement 1: Consolation Bracket (All Playcaller Modes)

**User Story:** As a player in any Playcaller tournament, I want every player to finish with a unique placement (1st through Nth) instead of sharing tied placements, so that final standings are definitive.

#### Acceptance Criteria

1. WHEN the main bracket's final round resolves, THE system SHALL generate consolation matchups for all groups of players that would otherwise share a tied placement
2. THE consolation bracket SHALL produce matchups pairing players eliminated in the same main bracket round against each other to determine their relative ordering
3. WHEN all consolation rounds resolve, THE `computePlacements` function SHALL return unique placements (1 through N) for all N players with no ties
4. THE consolation bracket SHALL apply to all Playcaller progression modes (endless, tournament, and lottery)
5. IN non-lottery modes, consolation matchups SHALL be resolved using the same mechanism as main bracket matchups (random resolver for SKIP_GAMEPLAY, drive gameplay otherwise)
6. IN lottery mode, consolation matchup winners SHALL be predetermined by the lottery draw
7. WHEN the player count is a power of 2 (2, 4, 8), the only consolation matchup needed SHALL be between the two finalists' loser (2nd vs implied 3rd from semi-final)
8. FOR a 10-player bracket, THE consolation bracket SHALL produce the following placement games: 3rd/4th place, 5th/6th place, 7th/8th place, and 9th/10th place (plus any multi-way ties needing mini-brackets)

### Requirement 2: Lottery Mode Session Configuration

**User Story:** As a host, I want to create a session in "Lottery" mode from the lobby, so that the tournament uses predetermined lottery odds instead of pure competitive outcomes.

#### Acceptance Criteria

1. THE system SHALL support a new progression mode value: `"lottery"` alongside existing `"endless"` and `"tournament"`
2. WHEN a host selects Lottery mode on the landing page, THE system SHALL lock the game type to Playcaller (no other games available)
3. WHEN a host selects Lottery mode, THE system SHALL reject any `SET_GAME_TYPE` messages attempting to change away from Playcaller
4. THE Lottery mode option SHALL be presented as a toggle button alongside Endless and Tournament on the landing page
5. WHEN Lottery mode is active, THE room state SHALL include `lotteryState` containing the odds table, drawn placements, and predetermined matchup winners

### Requirement 3: Lottery Draw at Game Start

**User Story:** As a player, I want all tournament placements to be predetermined the moment the game starts, so that the lottery is fair and the outcome is locked in before any gameplay.

#### Acceptance Criteria

1. WHEN the Playcaller game is launched in Lottery mode (host starts the first round — NOT at room creation), THE system SHALL perform a full lottery draw using the odds table. This allows the host to rearrange player slots in the lobby before the draw is locked in.
2. THE lottery draw SHALL use sequential weighted sampling without replacement from the 10×10 odds table to produce a complete placement permutation
3. THE lottery draw SHALL map seed positions (derived from session leaderboard) to final placements, producing a `playerId → placement` mapping for all players
4. AFTER the lottery draw, THE system SHALL derive predetermined winners for every matchup in the bracket (both main rounds and consolation rounds) based on the target placements
5. THE lottery draw results SHALL be stored in room state but NOT broadcast to clients until the lottery reveal phase (to maintain suspense)
6. THE odds table SHALL be a 10×10 constant (`DEFAULT_LOTTERY_ODDS`) that can be replaced with custom values in the future
7. SEED positions SHALL map directly to session list order: seed 1 (best lottery odds, row 0 of the table) = position 1 in the session list = the last-place finisher from the previous season. The table rows map exactly to the order players appear in the session standings, so the worst-performing player gets the most favorable lottery odds.
8. THE lottery reveal screen SHALL display players in reverse order of their final standings from the prior season (last place team shown first as "Seed 1"), making it visually clear that the worst team has the best odds

### Requirement 4: Suppress Loser Victory (Drive Engine)

**User Story:** As a player in lottery mode, I want the drive gameplay to feel organic even though the outcome is predetermined, so that the games are entertaining despite being "rigged."

#### Acceptance Criteria

1. WHEN the predetermined loser is on offense and a play would result in a touchdown (yard line reaches 0), THE system SHALL re-roll the outcome until it does NOT produce a touchdown
2. WHEN the predetermined loser is on defense and a play would result in an interception, THE system SHALL re-roll the outcome — the re-roll may produce ANY other valid outcome (including gains for the offense, incomplete passes, or tackles for loss). The only restriction is that the re-rolled outcome MUST NOT end the drive in the predetermined loser's favor.
3. WHEN the predetermined loser is on defense and a play would result in a fumble, THE system SHALL re-roll the outcome — the re-roll may produce ANY other valid outcome (including gains for the offense, incomplete passes, or tackles for loss). The only restriction is that the re-rolled outcome MUST NOT end the drive in the predetermined loser's favor.
4. WHEN the predetermined loser is on defense and the play would result in a turnover on downs (4th down, yards gained < yards to go), THE system SHALL re-roll until yards gained exceeds the first-down marker to keep the drive alive
5. WHEN re-rolling a 4th-down play for the defense-loser and the called play's maximum possible yardage (after modifiers) cannot reach the yards-to-go, THE system SHALL force yards gained to exactly the yards-to-go amount with outcome "success"
6. WHEN the predetermined winner would win (offense=winner scores TD, or defense=winner gets turnover/TOD), THE system SHALL NOT suppress the outcome — it passes through normally
7. THE suppression handler SHALL be a localized pure function (`suppressLoserVictory`) that encapsulates all re-roll logic in one place
8. PLAYERS SHALL be allowed to call plays freely in lottery mode — suppression guarantees the correct outcome regardless of player skill or strategy
9. THE suppression mechanism SHALL guarantee that over any number of simulations, the predetermined winner wins 100% of their matchups
10. RE-ROLLS SHALL use fresh RNG draws and attempt up to 10 re-rolls before falling back to a forced safe outcome (capped yardage or forced failure type)
11. THE suppression re-roll logic SHALL be: generate a completely new outcome from scratch using the same play config/matrix with fresh RNG rolls. Any result is acceptable as long as it does not cause the predetermined loser to win the drive.

### Requirement 5: SKIP_GAMEPLAY Support for Lottery Mode

**User Story:** As a host using SKIP_GAMEPLAY in lottery mode, I want the bracket to resolve instantly using the predetermined outcomes, so I can quickly see the final results.

#### Acceptance Criteria

1. WHEN SKIP_GAMEPLAY is true in Lottery mode, THE system SHALL use a lottery resolver that directly returns the predetermined winner for each matchup (no drive simulation)
2. THE lottery resolver SHALL work for both main bracket rounds and consolation rounds
3. AFTER all rounds (main + consolation) resolve via SKIP_GAMEPLAY, THE final placements SHALL exactly match the lottery draw

### Requirement 6: Lottery Reveal Screen

**User Story:** As a player, I want to see the lottery odds table after the tournament with my result highlighted, so I can see definitive proof that the outcome was truly lottery-driven.

#### Acceptance Criteria

1. AFTER the bracket (main + consolation) completes in lottery mode, THE system SHALL transition to a `LOTTERY_REVEAL` phase instead of directly to `END_TOURNAMENT`
2. THE lottery reveal screen SHALL display the full 10×10 odds table as a grid with rows labeled by player/seed and columns labeled by placement (1st–10th)
3. EACH cell SHALL display its probability percentage value from the odds table
4. THE cell corresponding to each player's actual lottery result SHALL be highlighted (visually distinct background/border)
5. WHEN Draft Pick mode is DISABLED: THE reveal SHALL animate results one-by-one from 10th place to 1st place with staggered timing for dramatic effect. After the animation completes, the host sees a "Finish" button that transitions directly to `END_TOURNAMENT` (with confetti, same as current finale handling).
6. WHEN Draft Pick mode is ENABLED: THE reveal SHALL be instant (no staggered animation) — all results shown at once. The host sees a "Continue to Draft" button to advance to the draft pick phase.
7. THE system SHALL broadcast `lotteryState` to all clients during this phase so the table can be rendered
8. THE Draft Pick toggle SHALL be a sub-option within Lottery mode on the session creation screen (e.g., "Enable Draft Pick Selection" checkbox/toggle that appears when Lottery is selected)

### Requirement 7: Draft Pick Selection Phase

**User Story:** As a lottery winner, I want to choose my actual snake draft position in the order the lottery determined (1st pick winner chooses first), so I can pick the strategically best draft slot for my situation.

#### Acceptance Criteria

1. AFTER the host advances from LOTTERY_REVEAL (when Draft Pick is enabled), THE system SHALL transition to a `DRAFT_PICK` phase
2. THE draft pick order SHALL follow lottery placement order: the 1st-place lottery winner picks their draft position first, then 2nd-place, and so on
3. EACH player's turn SHALL present all remaining available draft positions (1 through N) as selectable options
4. WHEN a player selects a position, THE system SHALL validate they are the current picker and the position is available
5. AFTER a valid selection, THE system SHALL remove that position from available options and advance to the next picker
6. IF a player does not pick within 30 seconds, THE system SHALL auto-assign the lowest available position number
7. BOTS SHALL auto-pick after a 2–4 second random delay, selecting the position matching their lottery placement if available, else the lowest available
8. AFTER all players have picked, THE system SHALL transition to `END_TOURNAMENT` with the final draft position assignments visible
9. THE draft pick screen SHALL show: whose turn it is ("Player X is on the clock"), a countdown timer, and draft position rows with a "SELECT" button next to each available slot
10. THE current picker SHALL see enabled "SELECT" buttons; all other players SHALL see the same view but with buttons disabled (spectator mode, similar to Big Wheel where everyone watches the selection)
11. WHEN a player selects their draft position, THE system SHALL perform a slow reveal animation showing the selection being locked in (all players see this simultaneously, Big Wheel style)
12. ALREADY-SELECTED positions SHALL show which player chose them (e.g., "Pick 3 — Player A") with the SELECT button removed
13. WHEN Draft Pick mode is DISABLED in session settings, THE entire draft pick phase SHALL be skipped — `LOTTERY_REVEAL` transitions directly to `END_TOURNAMENT`

### Requirement 8: State Machine Phases

**User Story:** As a developer, I want clear phase transitions for the lottery post-game flow, so the client can render the correct screen at each step.

#### Acceptance Criteria

1. THE `RoundPhase` type SHALL include two new values: `"LOTTERY_REVEAL"` and `"DRAFT_PICK"`
2. WHEN Draft Pick is ENABLED, THE phase transition flow in lottery mode SHALL be: `RESULT` (final consolation round) → `LOTTERY_REVEAL` → `DRAFT_PICK` → `END_TOURNAMENT`
3. WHEN Draft Pick is DISABLED, THE phase transition flow in lottery mode SHALL be: `RESULT` (final consolation round) → `LOTTERY_REVEAL` → `END_TOURNAMENT`
4. DURING `LOTTERY_REVEAL` phase, THE client SHALL render the LotteryRevealScreen component
5. DURING `DRAFT_PICK` phase, THE client SHALL render the DraftPickScreen component
6. A new host-only message `ADVANCE_LOTTERY_PHASE` SHALL transition from `LOTTERY_REVEAL` to either `DRAFT_PICK` (if enabled) or `END_TOURNAMENT` (if disabled)
7. THE `DRAFT_PICK_SELECTION` client message SHALL only be accepted during `DRAFT_PICK` phase from the current picker
