# Spectator Reveal Desync Fix — Bugfix Design

## Overview

Two intertwined bugs cause drive-state corruption and UI lock-ups in the Playcaller game. Bug #1 is a client-side spectator reveal-gate desync where `displayedPlayCount` overshoots `playCount`, permanently disabling the play-by-play gating. Bug #2 is a server-side double-resolution issue where `fillMissingPicks()` returns already-resolved matchups, causing phantom plays that corrupt drive state and crash rooms. The fix applies complementary server-side guards (prevent double-resolution) and client-side guards (prevent overshoot) to eliminate both failure modes.

## Glossary

- **Bug_Condition (C)**: Two conditions: (1) Client — `onOutcomeReveal` fires when `displayedPlayCount >= playCount`, causing overshoot; (2) Server — `fillMissingPicks()` returns a matchup whose picks are already present, causing `resolveMatchupDown` to be called a second time on the same down
- **Property (P)**: (1) `displayedPlayCount` never exceeds `playCount`; (2) Each matchup is resolved at most once per down cycle
- **Preservation**: Reconnection behavior (mount at current state without replaying), fast-forward for spectators returning from other games, normal pick/resolve/broadcast flow, play clock expiry handling for genuinely missing picks
- **`fillMissingPicks()`**: Function in `PlaycallerPlugin.ts` that iterates active drives and fills any missing offense/defense picks with random plays for timeout scenarios
- **`resolveMatchupDown(matchupId)`**: Function in `PlaycallerPlugin.ts` that resolves a single matchup's current down and updates `driveStates` in place
- **`downPicks`**: Module-level record mapping matchupId to `{ offense?, defense? }` picks for the current down
- **`displayedPlayCount`**: Client-side counter tracking which play index the UI has "revealed" through the announcer timeline
- **`playCount`**: The current length of `driveState.playHistory` — the true number of plays that have occurred
- **Phantom play**: An extra down resolution injected by double-calling `resolveMatchupDown` with stale picks, creating a play no player chose

## Bug Details

### Bug Condition

The bugs manifest under two distinct conditions:

**Server-side (Bug #2):** The bug triggers when a multi-matchup round has one matchup (A) resolve early via the SUBMIT_PICK handler while another matchup (B) is still waiting. When the play clock expires, `resolvePlaycallerTimeout` calls `fillMissingPicks()`, which unconditionally returns Matchup A (even though it already has both picks), causing a second call to `resolveMatchupDown(matchupA)` with stale picks.

**Client-side (Bug #1):** The bug triggers when a spectator navigates to `SpectatorDriveView` or when the `SpectatorGrid` card component updates after a play resolved on the server but before the announcer timeline fires. The `handleOutcomeReveal` callback increments `displayedPlayCount` without checking the upper bound, permanently breaking the reveal gate.

**Formal Specification:**
```
FUNCTION isBugCondition_Server(input)
  INPUT: input of type TimeoutEvent with driveStates and downPicks
  OUTPUT: boolean
  
  RETURN EXISTS matchupId IN activeMatchups WHERE
         downPicks[matchupId].offense IS DEFINED
         AND downPicks[matchupId].defense IS DEFINED
         AND matchup was already resolved in this down cycle
         AND fillMissingPicks() includes matchupId in return array
END FUNCTION

FUNCTION isBugCondition_Client(input)
  INPUT: input of type RevealEvent with displayedPlayCount and playCount
  OUTPUT: boolean
  
  RETURN onOutcomeReveal is called
         AND displayedPlayCount >= playCount
         AND increment would cause displayedPlayCount > playCount
END FUNCTION
```

### Examples

- **Phantom play**: 4-player bracket, Matchup A resolves at T+3s via picks, Matchup B still waiting. Clock expires at T+15s. `fillMissingPicks` returns [A, B]. `resolveMatchupDown(A)` runs again with stale picks → phantom play injected into A's drive history
- **Overshoot**: Spectator opens `SpectatorDriveView` while play is in announcer pipeline. `displayedPlayCount` initialized to `playCount` (already caught up). Announcer fires `onOutcomeReveal` → `displayedPlayCount` becomes `playCount + 1`. Next play arrives → `displayedPlayCount (N+1) < playCount (N+1)` is false → gate never engages again
- **Cascading lock-up**: Phantom play causes unexpected turnover on downs → `isComplete = true` prematurely → client stuck with `playInProgress = true` on PlayCardGrid indefinitely
- **Room crash**: Multiple phantom plays accumulate → drive completes with inconsistent bracket state → `advancePlaycallerBracket` crashes when processing invalid completion data

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Player refresh/reconnect mid-game treats all pre-existing history as already revealed (no announcer replay)
- Spectator fast-forward when multiple plays landed while away (snap to `playCount - 1`)
- Normal announcer timeline (preSnap → activePlay → outcome → done) with `onOutcomeReveal` advancing by exactly one
- Play card "selected" state and "Waiting for opponent" overlay during PICKING phase
- Timeout fills genuinely missing picks and resolves those matchups normally
- "Play in progress" overlay with highlighted card during announcer timeline
- Bracket advancement after all drives complete with configured delay
- broadcastState after each resolution so all clients receive updates

**Scope:**
All inputs where (1) matchups have genuinely missing picks at timeout, and (2) `displayedPlayCount < playCount` when `onOutcomeReveal` fires, should behave exactly as before. The fixes only add guards that prevent the pathological conditions.

## Hypothesized Root Cause

Based on the bug analysis, the confirmed root causes are:

1. **`fillMissingPicks()` unconditional return**: The function pushes every non-complete matchup to the result array regardless of whether any pick was actually filled. A matchup whose picks were already present (from early resolution via SUBMIT_PICK) gets included, causing double-resolution.

2. **Stale picks surviving across resolution**: After `resolveMatchupDown` is called in the SUBMIT_PICK handler, the consumed picks remain in `downPicks[matchupId]`. When timeout fires later, these stale picks are still present, allowing the function to succeed a second time.

3. **Unbounded `displayedPlayCount` increment**: The `handleOutcomeReveal` callback in `SpectatorDriveView`, `SpectatorGrid`, and `DriveView` uses `setDisplayedPlayCount((prev) => prev + 1)` without an upper-bound check against `playCount`.

4. **Mount timing vs. play lifecycle**: When a spectator component mounts after a play resolved but before the announcer fires, the initialization (`initialDisplayCount = playCount`) marks the play as "already revealed." The announcer then fires for a play that's already counted, causing the overshoot.

## Correctness Properties

Property 1: Bug Condition — No Double-Resolution of Matchup Downs

_For any_ timeout event where `fillMissingPicks()` is called and one or more matchups already had both picks present (were resolved earlier in the same down cycle via SUBMIT_PICK), the fixed system SHALL NOT call `resolveMatchupDown` on those already-resolved matchups, preventing phantom plays from being injected into drive state.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 2: Bug Condition — No displayedPlayCount Overshoot

_For any_ `onOutcomeReveal` invocation on `SpectatorDriveView`, `SpectatorGrid`, or `DriveView`, the fixed system SHALL NOT allow `displayedPlayCount` to exceed the current `playCount`, ensuring the reveal gate engages correctly for all future plays.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 3: Preservation — Timeout Fills Genuinely Missing Picks

_For any_ timeout event where one or more matchups have genuinely missing picks (at least one of offense/defense is undefined), the fixed system SHALL fill those missing picks with random plays, include those matchups in the resolved set, and resolve their downs exactly as before.

**Validates: Requirements 3.5, 3.7**

Property 4: Preservation — Reconnection Shows Current State Immediately

_For any_ player or spectator that mounts a drive view component when no play is currently in the announcer pipeline (all history is pre-existing from before mount), the fixed system SHALL treat all pre-existing history as already revealed and show the current game state immediately.

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/server/src/games/playcaller/PlaycallerPlugin.ts`

**Function**: `fillMissingPicks()`

**Specific Changes**:
1. **Conditional return logic**: Only push matchupId to `resolvedMatchups` if at least one pick was actually filled (offense or defense was undefined and got assigned a random play). Track with a `filled` boolean:
   ```
   let filled = false
   if (picks.offense === undefined) { picks.offense = randomPlay; filled = true }
   if (picks.defense === undefined) { picks.defense = randomPlay; filled = true }
   if (filled) resolvedMatchups.push(matchupId)
   ```

2. **Clear consumed picks in `resolveMatchupDown`**: After resolving the down and updating `driveStates`, delete the consumed picks entry to prevent reuse:
   ```
   delete downPicks[matchupId]
   ```

---

**File**: `packages/server/src/games/playcaller/roomHandlers.ts`

**Function**: `handleSubmitPick` (within the `if (result.resolved)` branch)

**Specific Changes**:
3. **Belt-and-suspenders pick cleanup**: After calling `resolveMatchupDown(result.matchupId)`, also delete `downPicks[result.matchupId]`. This ensures that even if `fillMissingPicks` is called later, the picks for this matchup are gone:
   ```
   resolveMatchupDown(result.matchupId)
   delete downPicks[result.matchupId]  // prevent stale pick reuse
   ```

4. **Same cleanup in bot pick handler**: Apply the same `delete downPicks[result.matchupId]` after bot-triggered resolution in `schedulePlaycallerBotPicks`.

---

**File**: `packages/client/src/games/playcaller/SpectatorDriveView.tsx`

**Function**: `handleOutcomeReveal`

**Specific Changes**:
5. **Overshoot guard**: Replace the unbounded increment with a capped increment that respects `playCount`:
   ```
   const handleOutcomeReveal = useCallback(() => {
     setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
   }, [playCount])
   ```

---

**File**: `packages/client/src/games/playcaller/SpectatorGrid.tsx`

**Function**: `SpectatorMatchupCard` reveal timer effect

**Specific Changes**:
6. **Overshoot guard in timer**: Cap the increment in the auto-advance timer:
   ```
   setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
   ```

---

**File**: `packages/client/src/games/playcaller/DriveView.tsx`

**Function**: `handleOutcomeReveal`

**Specific Changes**:
7. **Overshoot guard**: Same pattern as SpectatorDriveView — cap increment to prevent overshoot:
   ```
   const handleOutcomeReveal = useCallback(() => {
     setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
   }, [playCount])
   ```

---

**File**: `packages/client/src/store/useGameStore.ts`

**Function**: `_onStateSync`

**Specific Changes**:
8. **Defensive pickSubmitted reset**: The existing per-down reset logic checks `pickDeadlineMs` changes. No additional changes needed here — the existing `pickDeadlineMs` comparison already resets `pickSubmitted` when a new down begins. With the server fix preventing phantom plays, the client-side reset will always fire correctly because each legitimate new down produces a new `pickDeadlineMs`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Write unit tests that simulate the exact race conditions — early matchup resolution followed by timeout, and reveal callbacks firing after gate is already open.

**Test Cases**:
1. **Double-Resolution Test**: Set up 2 matchups, resolve Matchup A via `recordPlaySelection`, then call `fillMissingPicks()` — assert it returns only Matchup B (will fail on unfixed code, returns both)
2. **Stale Picks Test**: Resolve Matchup A, then call `resolveMatchupDown(A)` again — observe phantom play injected (will fail on unfixed code)
3. **Overshoot Test**: Set `displayedPlayCount = playCount = 3`, fire `handleOutcomeReveal` — assert `displayedPlayCount` remains 3 (will fail on unfixed code, becomes 4)
4. **Cascading Lock-up Test**: Inject phantom play, then simulate STATE_SYNC — observe `playInProgress` stuck true (will fail on unfixed code)

**Expected Counterexamples**:
- `fillMissingPicks()` returns matchupIds with pre-existing picks
- `resolveMatchupDown` succeeds on stale picks, injecting phantom play
- `displayedPlayCount` exceeds `playCount` after overshoot
- Possible causes confirmed: unconditional array push, no pick cleanup, unbounded increment

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_Server(input) DO
  result := fillMissingPicks_fixed()
  ASSERT matchupsWithPreExistingPicks NOT IN result
  ASSERT driveStates unchanged for already-resolved matchups
END FOR

FOR ALL input WHERE isBugCondition_Client(input) DO
  handleOutcomeReveal_fixed()
  ASSERT displayedPlayCount <= playCount
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_Server(input) DO
  ASSERT fillMissingPicks_fixed(input) = fillMissingPicks_original(input)
  ASSERT resolveMatchupDown_fixed(input) = resolveMatchupDown_original(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_Client(input) DO
  ASSERT handleOutcomeReveal_fixed(input) produces same displayedPlayCount as original
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of matchup states (some resolved, some pending) automatically
- It catches edge cases in the fill/resolve logic that manual tests might miss
- It provides strong guarantees that the timeout path still works for genuinely missing picks

**Test Plan**: Observe behavior on UNFIXED code first for normal timeout scenarios and normal reveal sequences, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Timeout Preservation**: Generate random matchup configurations where picks are genuinely missing, verify `fillMissingPicks` fills and returns them correctly after fix
2. **Reveal Sequence Preservation**: Generate random play sequences where `displayedPlayCount < playCount`, verify `handleOutcomeReveal` increments by exactly one
3. **Reconnect Preservation**: Mount components with various pre-existing playHistory lengths, verify all history is treated as revealed immediately
4. **Fast-Forward Preservation**: Simulate multiple plays arriving while component is unmounted, verify snap-to behavior unchanged

### Unit Tests

- Test `fillMissingPicks` with 0, 1, and 2 pre-filled matchups — verify only genuinely-filled matchups are returned
- Test `resolveMatchupDown` clears `downPicks[matchupId]` after resolution
- Test `handleOutcomeReveal` with `displayedPlayCount === playCount` — verify no increment
- Test `handleOutcomeReveal` with `displayedPlayCount < playCount` — verify increment by 1
- Test `SpectatorGrid` timer does not overshoot when play resolves between timer set and fire

### Property-Based Tests

- Generate random multi-matchup states with various pick combinations; verify `fillMissingPicks` only returns matchups where at least one pick was undefined
- Generate random sequences of `recordPlaySelection` + `resolveMatchupDown` + `fillMissingPicks` calls; verify no matchup is resolved twice per down
- Generate random `(displayedPlayCount, playCount)` pairs; verify `Math.min(prev + 1, playCount)` never exceeds `playCount`

### Integration Tests

- Full multi-matchup round: 2 human + 2 bot matchups, one resolves early, clock expires — verify no phantom plays in any drive
- Spectator navigates to `SpectatorDriveView` mid-announcer-timeline — verify next play gates correctly
- Spectator toggles between games rapidly — verify no permanent desync
- Player picks, play resolves, next down begins — verify `PlayCardGrid` is interactive again
