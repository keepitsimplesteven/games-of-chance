# Bugfix Requirements Document

## Introduction

The Playcaller bracket consolation rounds have two critical bugs: (1) consolation games are scheduled sequentially after the main bracket finals instead of running concurrently with the appropriate main-bracket rounds, and (2) when consolation gameplay does begin, it hangs with "No active matchups" before looping back to the bracket view. This results in a broken user experience where players eliminated early must wait through the entire tournament before playing their placement games, and then cannot complete them due to the hang.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the main bracket is not yet complete (finals not played) THEN the system does not generate or schedule any consolation rounds, forcing all eliminated players to wait idle until the championship game finishes

1.2 WHEN a main-bracket round resolves and players are eliminated THEN the system does not create consolation matchups for those eliminated players until after `isComplete(bracket)` returns true

1.3 WHEN the user finishes the finals and clicks "View final results" THEN the system unexpectedly transitions them into a consolation round instead of showing final results, because all consolation rounds were deferred to after the finals

1.4 WHEN a consolation coin toss ceremony completes and the system transitions to PICKING phase THEN the system shows "No active matchups" and hangs because consolation matchups are not properly populated or discoverable by `beginPlaycallerDown`

1.5 WHEN the "No active matchups" hang occurs THEN the system loops back to the bracket view and re-enters the same stuck state indefinitely

1.6 WHEN 10 players compete THEN consolation rounds for 9th/10th, 5th-8th, and 3rd/4th all execute sequentially after the finals instead of concurrently with quarterfinals, semifinals, and pre-finals respectively

1.7 WHEN consolation matchups are scheduled (whether concurrent or sequential) THEN the `BracketVisualization` component does not render them anywhere — eliminated players' placement games are invisible in the bracket view

### Expected Behavior (Correct)

2.1 WHEN a main-bracket round resolves and players are eliminated THEN the system SHALL immediately generate consolation matchups for those eliminated players, scheduling them to run concurrently with the next main-bracket round

2.2 WHEN the next main-bracket round begins (e.g., semifinals) THEN the system SHALL include both the main-bracket matchups AND any concurrent consolation matchups (e.g., 5th-8th placement games) as active matchups in the same game round

2.3 WHEN 10 players compete and the play-in round (seeds 7v8, 9v10) resolves THEN the system SHALL schedule the play-in losers' consolation matchup (9th/10th game) to run concurrently with the quarterfinals

2.4 WHEN 10 players compete and the quarterfinals resolve THEN the system SHALL schedule the quarterfinal losers' consolation matchups (5th-8th bracket) to run concurrently with the semifinals

2.5 WHEN the semifinals resolve THEN the system SHALL schedule the 3rd/4th place game to run one round BEFORE the finals, so all other players can watch the championship

2.6 WHEN the finals round begins THEN the system SHALL have already completed the 3rd/4th place game, making the finals the final matchup with no concurrent consolation games

2.7 WHEN consolation matchups are active in a round THEN the system SHALL properly populate drive states for those matchups so that coin toss ceremonies and PICKING phase function without hanging

2.8 WHEN all matchups in a round (both main-bracket and consolation) complete THEN the system SHALL advance to the next round, which may again include both main-bracket and consolation matchups

2.9 WHEN the finals complete (no concurrent consolation) THEN the system SHALL immediately show final results without entering any additional consolation rounds

2.10 WHEN consolation matchups are scheduled to run concurrently with a main-bracket round THEN the BracketVisualization SHALL render those consolation matchups BELOW the main-bracket matchups in the same column, with a small header label indicating the placement being contested

2.11 WHEN the 9th/10th place game runs concurrent with quarterfinals THEN the bracket view SHALL display a "9th/10th" header above the consolation matchup card, positioned below the quarterfinal matchup cards in the same column

2.12 WHEN the 5th-8th consolation semi-finals run concurrent with semifinals THEN the bracket view SHALL display individual headers reading "5th/6th Place" and "7th/8th Place" above each corresponding consolation matchup card, below the semifinal matchup cards in the same column

2.13 WHEN the 3rd/4th place game runs in its standalone round before finals THEN the bracket view SHALL display it under the finals column with a "3rd/4th" header, visually aligned with the finals column even though it is played first

2.14 WHEN consolation matchups are resolved THEN the BracketVisualization SHALL apply the same visual styling as main-bracket matchups (winner highlighting, loser dimming/line-through, outcome badge)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a bracket has no byes (power-of-2 player count like 4 or 8) THEN the system SHALL CONTINUE TO generate correct bracket seeding and main-bracket round progression

3.2 WHEN a main-bracket matchup resolves via drive gameplay THEN the system SHALL CONTINUE TO correctly advance the winner to the next main-bracket round using the existing `resolveCurrentRound` logic

3.3 WHEN the coin toss ceremony completes for any matchup (main or consolation) THEN the system SHALL CONTINUE TO correctly assign offense/defense roles and initialize drive states

3.4 WHEN a drive completes via touchdown, interception, fumble, or turnover on downs THEN the system SHALL CONTINUE TO correctly identify the winner and record the ending type

3.5 WHEN the tournament fully completes THEN the system SHALL CONTINUE TO compute correct unique placements via `computePlacements` using consolation results

3.6 WHEN bots participate in matchups (main or consolation) THEN the system SHALL CONTINUE TO auto-submit coin calls, side choices, and play selections within expected timeframes

3.7 WHEN SKIP_GAMEPLAY is true THEN the system SHALL CONTINUE TO bypass coin toss ceremonies and resolve matchups with random assignments for both main-bracket and consolation matchups

3.8 WHEN the BracketVisualization renders main-bracket rounds THEN the system SHALL CONTINUE TO display round labels, matchup cards, bye indicators, winner highlighting, and auto-scroll behavior identically to current implementation
