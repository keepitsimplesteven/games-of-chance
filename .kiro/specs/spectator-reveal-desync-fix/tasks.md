# Implementation Plan

## Overview

Fix the spectator reveal desync caused by two related bugs:
1. **Client-side**: `displayedPlayCount` overshoots `playCount` when `onOutcomeReveal` fires redundantly
2. **Server-side**: `fillMissingPicks()` double-resolves matchups whose picks were already consumed

The approach uses exploratory bug condition tests (written before the fix) and preservation tests to ensure no regressions.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "4.1", "4.2", "4.3"] },
    { "id": 2, "tasks": ["3.5", "3.6", "4.4", "4.5"] },
    { "id": 3, "tasks": ["5"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Double-Resolution of Matchup Downs & displayedPlayCount Overshoot
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: Scope to concrete failing cases for reproducibility
  - Test Case A (Server - Double Resolution): Set up 2 matchups, resolve Matchup A via `recordPlaySelection` (both offense+defense picks), then call `fillMissingPicks()` — assert it does NOT include Matchup A in the return array (Bug: currently returns both matchups unconditionally)
  - Test Case B (Server - Stale Picks): After resolving Matchup A's down via `resolveMatchupDown`, verify that `downPicks[matchupA]` is cleared — assert picks are deleted after resolution (Bug: currently leaves stale picks in place)
  - Test Case C (Client - Overshoot): Simulate `displayedPlayCount === playCount === 3`, call `handleOutcomeReveal` — assert `displayedPlayCount` remains 3, not 4 (Bug: currently increments to 4 without upper-bound check)
  - `isBugCondition_Server`: EXISTS matchupId WHERE downPicks[matchupId].offense IS DEFINED AND downPicks[matchupId].defense IS DEFINED AND matchup was already resolved, AND fillMissingPicks() includes matchupId
  - `isBugCondition_Client`: onOutcomeReveal fires AND displayedPlayCount >= playCount AND increment would cause displayedPlayCount > playCount
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.4, 1.5, 1.6, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Timeout Fills Genuinely Missing Picks & Normal Reveal Sequence
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `fillMissingPicks()` with matchups that have genuinely missing picks (offense=undefined or defense=undefined) returns those matchup IDs and fills with random plays
  - Observe: `handleOutcomeReveal` with `displayedPlayCount < playCount` increments displayedPlayCount by exactly 1
  - Observe: Component mount with all plays pre-existing (no pending reveal) treats all history as already revealed
  - Write property-based tests:
    - For all matchup configurations where at least one pick is genuinely missing, `fillMissingPicks` fills and returns those matchups correctly
    - For all `(displayedPlayCount, playCount)` pairs where `displayedPlayCount < playCount`, the reveal callback increments by exactly 1
    - For all mount scenarios where playCount equals the pre-existing history length, `displayedPlayCount` starts at `playCount` (immediate reveal)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_

- [x] 3. Fix server-side double-resolution bug (Bug #2)

  - [x] 3.1 Fix `fillMissingPicks()` to only return matchups where picks were actually filled
    - File: `packages/server/src/games/playcaller/PlaycallerPlugin.ts`, function `fillMissingPicks()` (line ~357)
    - Add a `let filled = false` flag before the pick-fill logic
    - Set `filled = true` when offense pick is assigned (was undefined)
    - Set `filled = true` when defense pick is assigned (was undefined)
    - Only push `matchupId` to `resolvedMatchups` if `filled === true`
    - This prevents matchups with pre-existing picks from being returned
    - _Bug_Condition: isBugCondition_Server — matchup already has both picks present but is still included in return array_
    - _Expected_Behavior: fillMissingPicks only returns matchups where at least one pick was actually filled_
    - _Preservation: Matchups with genuinely missing picks continue to be filled and returned normally_
    - _Requirements: 2.4_

  - [x] 3.2 Clear consumed picks after `resolveMatchupDown` in `PlaycallerPlugin.ts`
    - File: `packages/server/src/games/playcaller/PlaycallerPlugin.ts`, function `resolveMatchupDown()` (line ~294)
    - Add `delete downPicks[matchupId]` after `driveStates![matchupId] = newState` (end of function, before `return newState`)
    - This ensures stale picks cannot be reused by a subsequent timeout
    - _Bug_Condition: Stale picks in downPicks survive across resolution, enabling double-resolution_
    - _Expected_Behavior: downPicks[matchupId] is cleared immediately after resolution_
    - _Preservation: Normal down resolution flow unchanged — picks are consumed then discarded_
    - _Requirements: 2.5_

  - [x] 3.3 Add pick cleanup after resolution in SUBMIT_PICK handler (`roomHandlers.ts`)
    - File: `packages/server/src/games/playcaller/roomHandlers.ts`, in `handleSubmitPick` within the `if (result.resolved)` branch (line ~610)
    - After `resolveMatchupDown(result.matchupId)`, the `delete downPicks[result.matchupId]` is now handled by the function itself (from 3.2), but verify it works correctly through this path
    - This is belt-and-suspenders — `resolveMatchupDown` itself now cleans up, but if additional explicit cleanup is needed at call site, add `delete downPicks[result.matchupId]` after `resolveMatchupDown(result.matchupId)` at line ~610
    - _Bug_Condition: Early-resolved matchup's picks survive in downPicks, causing timeout to re-resolve_
    - _Expected_Behavior: Picks are gone after SUBMIT_PICK resolution path_
    - _Preservation: Normal pick submission and broadcast flow unchanged_
    - _Requirements: 2.5, 2.6_

  - [x] 3.4 Add pick cleanup after bot-triggered resolution in `schedulePlaycallerBotPicks`
    - File: `packages/server/src/games/playcaller/roomHandlers.ts`, function `schedulePlaycallerBotPicks` (line ~895)
    - After `resolveMatchupDown(result.matchupId)` in the bot pick handler, verify picks are cleaned up (handled by 3.2's change inside `resolveMatchupDown`)
    - If additional explicit cleanup needed, add `delete downPicks[result.matchupId]` after `resolveMatchupDown(result.matchupId)` at line ~895
    - _Bug_Condition: Bot-resolved matchup's picks survive, causing same double-resolution on timeout_
    - _Expected_Behavior: Picks cleaned up after bot-triggered resolution_
    - _Preservation: Bot pick scheduling and resolution flow unchanged_
    - _Requirements: 2.5, 2.6_

  - [x] 3.5 Verify bug condition exploration test now passes (server portion)
    - **Property 1: Expected Behavior** - No Double-Resolution of Matchup Downs
    - **IMPORTANT**: Re-run the SAME server-side tests from task 1 - do NOT write new tests
    - Test Case A: `fillMissingPicks()` no longer returns already-resolved matchups
    - Test Case B: `downPicks[matchupId]` is cleared after `resolveMatchupDown`
    - **EXPECTED OUTCOME**: Server tests PASS (confirms server bug is fixed)
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 3.6 Verify preservation tests still pass (server portion)
    - **Property 2: Preservation** - Timeout Fills Genuinely Missing Picks
    - **IMPORTANT**: Re-run the SAME server preservation tests from task 2 - do NOT write new tests
    - Confirm `fillMissingPicks()` still fills and returns matchups with genuinely missing picks
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to timeout behavior)

- [x] 4. Fix client-side displayedPlayCount overshoot (Bug #1)

  - [x] 4.1 Add overshoot guard to `SpectatorDriveView.tsx` `handleOutcomeReveal`
    - File: `packages/client/src/games/playcaller/SpectatorDriveView.tsx`
    - Change `handleOutcomeReveal` from:
      ```ts
      const handleOutcomeReveal = useCallback(() => {
        setDisplayedPlayCount((prev) => prev + 1)
      }, [])
      ```
    - To:
      ```ts
      const handleOutcomeReveal = useCallback(() => {
        setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
      }, [playCount])
      ```
    - Note: `playCount` must be added to the `useCallback` dependency array
    - _Bug_Condition: onOutcomeReveal fires when displayedPlayCount >= playCount, causing overshoot_
    - _Expected_Behavior: displayedPlayCount never exceeds playCount_
    - _Preservation: Normal reveal (displayedPlayCount < playCount) still increments by exactly 1_
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Add overshoot guard to `SpectatorGrid.tsx` timer-based reveal
    - File: `packages/client/src/games/playcaller/SpectatorGrid.tsx`
    - In the `SpectatorMatchupCard` component's auto-advance `useEffect` (the setTimeout callback)
    - Change from:
      ```ts
      setDisplayedPlayCount((prev) => prev + 1)
      ```
    - To:
      ```ts
      setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
      ```
    - Note: This is inside a `setTimeout` callback within a `useEffect`, not a `useCallback` — `playCount` is already in scope from the component closure
    - _Bug_Condition: Timer fires after spectator card mounts with play already counted as revealed_
    - _Expected_Behavior: Timer-based reveal cannot overshoot playCount_
    - _Preservation: Normal timer-gated reveal for live plays still increments by exactly 1_
    - _Requirements: 2.3_

  - [x] 4.3 Add overshoot guard to `DriveView.tsx` `handleOutcomeReveal`
    - File: `packages/client/src/games/playcaller/DriveView.tsx`
    - Change `handleOutcomeReveal` from:
      ```ts
      const handleOutcomeReveal = useCallback(() => {
        setDisplayedPlayCount((prev) => prev + 1)
      }, [])
      ```
    - To:
      ```ts
      const handleOutcomeReveal = useCallback(() => {
        setDisplayedPlayCount((prev) => Math.min(prev + 1, playCount))
      }, [playCount])
      ```
    - Note: `playCount` must be added to the `useCallback` dependency array
    - _Bug_Condition: Announcer fires onOutcomeReveal when displayedPlayCount already equals playCount_
    - _Expected_Behavior: displayedPlayCount capped at playCount, reveal gate stays functional_
    - _Preservation: Normal reveal sequence during active gameplay unchanged_
    - _Requirements: 2.2_

  - [x] 4.4 Verify bug condition exploration test now passes (client portion)
    - **Property 1: Expected Behavior** - No displayedPlayCount Overshoot
    - **IMPORTANT**: Re-run the SAME client-side test from task 1 - do NOT write new tests
    - Test Case C: `handleOutcomeReveal` with `displayedPlayCount === playCount` no longer overshoots
    - **EXPECTED OUTCOME**: Client test PASSES (confirms client bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.5 Verify preservation tests still pass (client portion)
    - **Property 2: Preservation** - Normal Reveal Sequence
    - **IMPORTANT**: Re-run the SAME client preservation tests from task 2 - do NOT write new tests
    - Confirm normal reveal (displayedPlayCount < playCount) still increments by exactly 1
    - Confirm reconnect/mount behavior unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to reveal behavior)

- [x] 5. Checkpoint - Ensure all tests pass
  - Run full test suite to verify no regressions
  - Verify server-side tests: no double-resolution, stale picks cleaned up
  - Verify client-side tests: no overshoot in SpectatorDriveView, SpectatorGrid, DriveView
  - Verify preservation tests: timeout fills genuinely missing picks, normal reveal works, reconnect works
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- The exploration test (Task 1) is expected to FAIL on unfixed code — this confirms the bug exists. Do not attempt to fix the test when it fails.
- Preservation tests (Task 2) must PASS on unfixed code — they capture the baseline behavior to protect.
- Server fix (Task 3) and client fix (Task 4) are independent of each other but both require the tests from Tasks 1 and 2 to be written first.
- After both fixes land, re-run all tests in the checkpoint (Task 5) to confirm no regressions.
