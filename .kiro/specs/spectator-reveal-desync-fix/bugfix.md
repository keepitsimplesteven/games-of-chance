# Bugfix Requirements Document

## Introduction

Two related bugs in the Playcaller game's drive resolution and reveal-gating system. Bug #1 is a client-side issue where spectator interactions corrupt the deferred-reveal timing gate, causing `SpectatorDriveView` (and `SpectatorGrid`) to skip the play-by-play announcer timeline after mounting mid-reveal, and allowing `onOutcomeReveal` to overshoot `displayedPlayCount`. Bug #2 is a server-side issue where `fillMissingPicks()` unconditionally returns already-resolved matchups, causing `resolvePlaycallerTimeout` to double-resolve them and inject phantom plays into the drive state. The phantom plays cascade into permanent client-side lock-ups (stuck `PlayCardGrid`) and potential room crashes.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a spectator mounts `SpectatorDriveView` while a play has resolved on the server but the client reveal animation has not yet fired THEN the system immediately shows the resolved ball position, down, and distance without waiting for the play-by-play announcer timeline (because `initialDisplayCount = useRef(playCount).current` already includes the unannounced play)

1.2 WHEN `PlayByPlayAnnouncer` fires `onOutcomeReveal` after the gate is already open (displayedPlayCount === playCount) THEN the system increments `displayedPlayCount` past `playCount`, causing `isWaitingForReveal = (displayedPlayCount < playCount)` to be permanently false for all future plays

1.3 WHEN the `SpectatorGrid` card component mounts with pre-resolved plays THEN the system uses the same `initialDisplayCount = useRef(playCount).current` pattern, skipping the reveal gate for the most recent play

1.4 WHEN in a multi-matchup round, one matchup (A) resolves its down early via the SUBMIT_PICK handler while another matchup (B) is still waiting for picks THEN the system leaves Matchup A's consumed picks in `downPicks[matchupA]` without clearing them, because `clearDownPicks()` only runs after ALL active matchups resolve or on timeout

1.5 WHEN the play clock expires and `resolvePlaycallerTimeout` calls `fillMissingPicks()` THEN the system unconditionally pushes every non-complete matchup ID to the return array (including Matchup A which already has both picks present from the previous resolution), causing `resolvePlaycallerTimeout` to call `resolveMatchupDown(matchupA)` a second time with the same stale picks

1.6 WHEN `resolveMatchupDown` is called a second time on an already-resolved matchup with the same picks THEN the system generates a phantom play — an extra down resolution that no player chose — corrupting the drive's `playHistory`, `yardLine`, `down`, and `yardsToGo` state

1.7 WHEN the client receives a STATE_SYNC containing a phantom play's extra `playHistory` entry THEN the system's `displayedPlayCount` tracking becomes permanently desynchronized because the player never entered PICKING state for this phantom play, leaving `pickSubmitted` true and `isWaitingForReveal` stuck, which passes `playInProgress={true}` to `PlayCardGrid` indefinitely

1.8 WHEN phantom plays accumulate across multiple timeouts (each timeout re-resolves the already-resolved matchup again) THEN the system may trigger an unexpected drive completion (phantom play causes turnover on downs or crosses the goal line), and when `advancePlaycallerBracket` is called the bracket state is inconsistent, causing the room to crash

### Expected Behavior (Correct)

2.1 WHEN a spectator mounts `SpectatorDriveView` while a play has resolved but not yet been announced THEN the system SHALL gate that unannounced play behind the play-by-play announcer timeline before revealing the ball position, down, and distance

2.2 WHEN `PlayByPlayAnnouncer` fires `onOutcomeReveal` and `displayedPlayCount` is already equal to `playCount` THEN the system SHALL NOT increment `displayedPlayCount` beyond `playCount` (no-op guard to prevent overshoot)

2.3 WHEN the `SpectatorGrid` card component mounts with a play that has resolved but not yet been announced THEN the system SHALL gate that play behind the reveal timer before updating the displayed down/distance/yard line

2.4 WHEN `fillMissingPicks()` iterates a non-complete matchup that already has both offense and defense picks present THEN the system SHALL NOT include that matchup in the returned array (only return matchups where at least one pick was actually filled)

2.5 WHEN `resolveMatchupDown` is called for a matchup THEN the system SHALL clear that matchup's entry from `downPicks` immediately after resolution, so stale picks cannot be reused by a subsequent timeout

2.6 WHEN `resolvePlaycallerTimeout` iterates the matchups returned by `fillMissingPicks()` THEN the system SHALL only call `resolveMatchupDown` on matchups that were not already resolved during the current down cycle (guard against double-resolution)

2.7 WHEN a new down begins after play resolution THEN the system SHALL reliably reset `pickSubmitted` to false and restore card selection for the active player regardless of how the previous down was resolved

2.8 WHEN a spectator mounts or unmounts during active gameplay THEN the system SHALL NOT affect the game state, timing, or UI experienced by active players in any matchup

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a player refreshes or reconnects mid-game (all existing play history is pre-existing at mount time and no reveal is in progress) THEN the system SHALL CONTINUE TO treat all pre-existing history as already revealed, showing the current game state immediately without replaying announcer timelines

3.2 WHEN a spectator toggles between games and multiple plays landed while they were away THEN the system SHALL CONTINUE TO fast-forward (snap to `playCount - 1`) so only the latest play is gated, preventing the spectator from being stuck multiple plays behind

3.3 WHEN the play-by-play announcer completes its full timeline (preSnap → activePlay → outcome → done) for a legitimately gated play THEN the system SHALL CONTINUE TO call `onOutcomeReveal` which advances `displayedPlayCount` by exactly one, revealing the ball animation and updated field state

3.4 WHEN a player selects a play card during the PICKING phase THEN the system SHALL CONTINUE TO show the "selected" state on the chosen card and "Waiting for opponent" overlay until the next down begins

3.5 WHEN the play clock expires and a matchup has genuinely missing picks (one or both players did not submit) THEN the system SHALL CONTINUE TO fill the missing picks with random plays and resolve that matchup's down normally

3.6 WHEN both players have submitted picks and the play resolves via the SUBMIT_PICK handler THEN the system SHALL CONTINUE TO show the "Play in progress" overlay with the highlighted card until the announcer timeline completes the outcome reveal

3.7 WHEN all drives complete after timeout resolution THEN the system SHALL CONTINUE TO broadcast state and advance the bracket after the configured delay
