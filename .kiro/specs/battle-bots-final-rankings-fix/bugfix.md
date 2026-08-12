# Bugfix Requirements Document

## Introduction

The "Final Rankings" UI at the end of a Battle Bots game displays incorrect point values and uses incorrect ranking logic. After the scoring refactor introduced survival-tick-based scoring (Round 2: 25 pts for winners, Round 3: up to 125 pts for survivors), the Final Rankings screen still shows ordinal position-derived "points" (`totalParticipants - rank`) instead of actual cumulative scores. Additionally, players are ranked by bracket position (winners bracket always above losers bracket) rather than by their true cumulative score — meaning a losers bracket survivor (who earns 125 FFA points) can never outrank the last-place winners bracket player, even though their total score is higher.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Final Rankings are displayed after Round 3, THEN the system computes display points as `Math.max(0, totalParticipants - rank)` producing ordinal values (e.g., 9, 8, 7... 0) instead of actual cumulative scores from Round 2 + Round 3

1.2 WHEN the Final Rankings are displayed, THEN the system ranks players by bracket position (winners bracket ranks 1–N/2, losers bracket ranks N/2+1–N) regardless of their actual cumulative scores, preventing losers bracket players from ever ranking above any winners bracket player

1.3 WHEN the server computes the game leaderboard after Round 3 completes, THEN the `computeGameLeaderboard` method returns `score: totalParticipants - rank` (ordinal position value) instead of the player's actual cumulative game score

1.4 WHEN the `FinalRanking` data is sent from server to client, THEN it does not include cumulative score information — only `rank`, `bracket`, `playerName`, `playerId`, and `isBot` — forcing the client to derive a fake "points" value from rank position

### Expected Behavior (Correct)

2.1 WHEN the Final Rankings are displayed after Round 3, THEN the system SHALL show each player's actual cumulative score (sum of Round 2 score + Round 3 score) in the "Pts" column

2.2 WHEN the Final Rankings are displayed, THEN the system SHALL rank players by their cumulative score in descending order, meaning a losers bracket player with a higher cumulative score SHALL appear above a winners bracket player with a lower cumulative score

2.3 WHEN the server computes the game leaderboard after Round 3 completes, THEN the `computeGameLeaderboard` method SHALL return the player's actual cumulative game score (from `gameScores`) as the `score` field

2.4 WHEN the `FinalRanking` data is sent from server to client, THEN it SHALL include a `score` field containing the player's cumulative score (Round 2 + Round 3), enabling the client to display and sort by the correct value

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Round 2 completes and scores are computed, THEN the system SHALL CONTINUE TO award 25 points to 1v1 winners and 0 points to losers using the survival-tick-based scoring formulas

3.2 WHEN Round 3 (FFA) completes and scores are computed, THEN the system SHALL CONTINUE TO award survivors 125 points and eliminated players `ceil(eliminatedTick / (totalTicks * 1.1) * 100)` points using the survival-tick-based scoring formulas

3.3 WHEN the Final Rankings are displayed, THEN the system SHALL CONTINUE TO show the bracket indicator (W/L) for each player so users can see which bracket they competed in

3.4 WHEN bot personas participate in the game, THEN the system SHALL CONTINUE TO exclude bot personas from the Final Rankings display and from score deltas

3.5 WHEN a game completes before Round 3 (e.g., only Rounds 1–2 finished), THEN the system SHALL CONTINUE TO display the score-based leaderboard using cumulative `gameScores` as it does today
