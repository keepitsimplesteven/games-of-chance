# Implementation Plan

## Overview

This plan fixes the bug where consolation rounds are deferred until after the main bracket completes, instead of being scheduled concurrently with main-bracket rounds. The fix introduces a schedule-based advancement system that maps each game round to its main-bracket and consolation matchups, generates consolation matchups incrementally as players are eliminated, and updates the UI to render consolation alongside main-bracket rounds.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.8", "3.9"] },
    { "id": 3, "tasks": ["3.5", "3.6"] },
    { "id": 4, "tasks": ["3.7"] },
    { "id": 5, "tasks": ["3.10", "3.11"] },
    { "id": 6, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Consolation Rounds Deferred Until After Finals
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate consolation rounds are not generated concurrently with main-bracket rounds
  - **Scoped PBT Approach**: Scope the property to a 10-player bracket where the play-in round has resolved and 2 players are eliminated
  - Test that after resolving the play-in round (eliminating seeds 9 and 10), the system generates consolation matchups for those eliminated players and schedules them concurrently with the quarterfinals
  - Bug Condition from design: `isBugCondition(input)` where `eliminatedThisRound.length > 0 AND NOT mainBracketComplete AND consolationMatchupsNotScheduledFor(eliminatedThisRound)`
  - Assert: after play-in resolves, `bracket.consolationRounds.length > 0` (currently will be 0 — confirming deferred generation bug)
  - Assert: the active matchups for the next game round include BOTH quarterfinal matchups AND the 9th/10th consolation matchup
  - Assert: `beginPlaycallerDown` initializes drives for consolation matchups alongside main-bracket matchups (currently only considers main bracket — confirming mutually exclusive mode bug)
  - Secondary bug condition test: create a consolation round with empty playerA/playerB slots, attempt to start coin toss — assert it does NOT produce "No active matchups" hang (currently hangs — confirming slot population bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: consolation rounds are empty after play-in, and the system only considers main-bracket matchups)
  - Document counterexamples found:
    - After play-in resolves, `bracket.consolationRounds` is empty (no consolation generated incrementally)
    - `beginPlaycallerDown` only queries `bracket.rounds[currentRoundIndex]` — ignores eliminated players
    - Consolation rounds with empty matchup slots cause `activeMatchups.length === 0` leading to the hang
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Main Bracket Progression and Drive Gameplay Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **IMPORTANT**: Write these tests BEFORE implementing the fix
  - Observe: `generateBracket([p1..p10])` produces a bracket with 4 rounds, correct seeding, byes for seeds 1-6 on UNFIXED code
  - Observe: `generateBracket([p1..p4])` produces a bracket with 2 rounds, no byes, standard seeding order on UNFIXED code
  - Observe: `generateBracket([p1..p8])` produces a bracket with 3 rounds, no byes, standard 8-team bracket order on UNFIXED code
  - Observe: `resolveCurrentRound(bracket, resolver)` advances winners to next round correctly for a 4-player bracket on UNFIXED code
  - Observe: `resolveCurrentRound(bracket, resolver)` correctly handles play-in round with byes, placing winners into seeded positions on UNFIXED code
  - Observe: `computePlacements(completedBracket)` returns correct unique placements 1-10 for a fully resolved 10-player bracket with consolation on UNFIXED code
  - Write property-based tests:
    - For all player counts 2-10, `generateBracket` produces identical bracket structure (rounds, seeds, byes, matchupIds) on fixed vs unfixed code
    - For any resolved round with no consolation involvement, `resolveCurrentRound` produces identical winner placement and elimination records
    - For any fully-complete bracket with resolved consolation rounds, `computePlacements` produces identical placement maps
    - For any matchup (main or consolation), drive initialization with `initializeDrives` produces identical drive states (offense/defense assignment, yard line, down, yardsToGo)
    - Coin toss ceremony: `createCeremonyStates`, `handleCoinCall`, `handleSideChoice` produce identical results for any valid matchup input
  - Verify all tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Implement concurrent consolation scheduling fix

  - [x] 3.1 Add `GameRoundSchedule` type and update `Bracket` interface in shared types
    - Add `GameRoundSchedule` interface with `mainBracketRoundIndex: number | null`, `consolationRoundIndices: number[]`, `description: string`
    - Add `schedule: GameRoundSchedule[]` field to `Bracket` interface
    - Add `currentScheduleIndex: number` field to `Bracket` interface
    - Extend `PlaycallerRoundResult` with optional `consolationMatchups`, `consolationContext` fields for UI communication
    - _Bug_Condition: isBugCondition(input) where no schedule concept exists to map consolation rounds to concurrent main-bracket rounds_
    - _Expected_Behavior: schedule[] maps each game round to its main-bracket + consolation matchups_
    - _Preservation: Existing Bracket consumers (generateBracket, isComplete, isFullyComplete) must continue to work — schedule is additive_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [x] 3.2 Implement `generateConsolationForRound` in BracketEngine
    - Create new function that generates consolation matchups ONLY for players eliminated in a specific round
    - For 2-player elimination groups: create single consolation matchup with players filled in
    - For 4-player elimination groups: create mini-bracket (semi-finals with players filled, final with empty slots)
    - Sort players by seed for consistent matchup ordering (lower seed = playerA)
    - Retain existing `generateConsolationRounds` as backward-compatible wrapper that calls `generateConsolationForRound` for each elimination round
    - _Bug_Condition: isBugCondition(input) where generateConsolationRounds is only called after isComplete() — no incremental generation_
    - _Expected_Behavior: consolation matchups generated immediately when players are eliminated, not deferred_
    - _Preservation: generateConsolationRounds must produce identical output when called on a fully-complete bracket_
    - _Requirements: 2.1, 2.3, 2.4, 2.7_

  - [x] 3.3 Implement `buildSchedule` in BracketEngine
    - Create function that computes the full game-round schedule after bracket generation or after each round resolves
    - Map main-bracket rounds to their concurrent consolation rounds:
      - Play-in (round 0): no consolation (no one eliminated yet)
      - After play-in: quarterfinals + 9th/10th consolation
      - After quarterfinals: semifinals + 5th-8th semi-finals
      - After semifinals: standalone round with 5th-8th final + 3rd/4th
      - Finals: alone (no concurrent consolation)
    - Handle the 3rd/4th exception: place it in a standalone round BEFORE finals, not concurrent with finals
    - Handle the 5th-8th final dependency: it runs AFTER 5th-8th semi-finals resolve (in the standalone pre-finals round)
    - Schedule must be incrementally buildable (new entries added as consolation rounds are generated)
    - For power-of-2 player counts (4, 8): consolation appears later since elimination starts later
    - _Bug_Condition: No concept of "round scheduling" exists — system uses isComplete() as only gate_
    - _Expected_Behavior: schedule maps each game round to main + consolation matchups with correct ordering_
    - _Preservation: For brackets with no consolation yet (early rounds), schedule entries just contain main-bracket rounds_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9_

  - [x] 3.4 Implement `getActiveMatchupsForSchedule` in BracketEngine
    - Create function that returns all matchups (main + consolation) for a given schedule entry
    - Filter out matchups with empty playerA/playerB (prevents "No active matchups" hang)
    - Merge main-bracket matchups and consolation matchups into a single array
    - When schedule entry has `mainBracketRoundIndex: null`, return only consolation matchups
    - Validate that returned matchups have valid player IDs before returning
    - _Bug_Condition: isBugCondition_Hang where activeMatchups.length === 0 OR driveStatesNotInitializedFor(activeMatchups)_
    - _Expected_Behavior: always returns non-empty matchups with valid playerA and playerB for playable schedule entries_
    - _Preservation: For main-bracket-only schedule entries, returns identical matchups to current currentRound.matchups.filter() logic_
    - _Requirements: 2.7, 2.8_

  - [x] 3.5 Update `advancePlaycallerBracket` in roomHandlers to use schedule-based advancement
    - Replace the `isComplete(bracket)` gate with `bracket.schedule[bracket.currentScheduleIndex]` lookup
    - After resolving all drives in a combined round:
      - Resolve main-bracket matchups via `resolveCurrentRound` (if schedule entry has mainBracketRoundIndex)
      - Resolve consolation matchups via `resolveConsolationRound` (for each consolation round index in the schedule entry)
      - Generate new consolation rounds for newly eliminated players via `generateConsolationForRound`
      - Rebuild/extend the schedule to include newly generated consolation rounds
      - Advance `currentScheduleIndex`
    - Ensure mini-bracket consolation finals have their slots populated from semi-final winners BEFORE they become active in a schedule entry
    - Score only when `isFullyComplete(updatedBracket)` returns true (unchanged behavior)
    - _Bug_Condition: isComplete() gate causes mutually exclusive main/consolation modes — never combined_
    - _Expected_Behavior: schedule-based lookup combines main + consolation matchups per game round_
    - _Preservation: resolveCurrentRound and resolveConsolationRound called with same arguments, just orchestrated differently_
    - _Requirements: 2.1, 2.2, 2.7, 2.8, 2.9_

  - [x] 3.6 Update `beginPlaycallerDown`, `beginCoinTossPhase`, and `transitionToPicking` to use schedule-based matchup lookup
    - Replace `isComplete(bracket)` conditional in `beginCoinTossPhase` with `getActiveMatchupsForSchedule(bracket, bracket.schedule[bracket.currentScheduleIndex])`
    - Replace `isComplete(bracket)` conditional in `transitionToPicking` with same schedule-based lookup
    - Replace `isComplete(bracket)` conditional in `beginPlaycallerDown` with same schedule-based lookup
    - All three functions now get active matchups from the unified schedule regardless of whether they're main-bracket or consolation
    - Ensure SKIP_GAMEPLAY path in `beginPlaycallerDown` also uses schedule-based matchup lookup
    - _Bug_Condition: Three functions independently check isComplete() and use mutually exclusive matchup sources_
    - _Expected_Behavior: All functions use getActiveMatchupsForSchedule for a unified matchup list per game round_
    - _Preservation: For game rounds with only main-bracket matchups, the returned matchups are identical to current logic_
    - _Requirements: 2.1, 2.2, 2.7, 2.8_

  - [x] 3.7 Update `PlaycallerPlugin.resolveRound` SKIP_GAMEPLAY path
    - When resolving rounds in skip mode, resolve all matchups in the current schedule entry (main + consolation)
    - After resolving, generate consolation for newly eliminated players and rebuild schedule
    - Advance `currentScheduleIndex` instead of relying on `currentRoundIndex` alone
    - Ensure schedule entries with consolation mini-bracket finals have players populated from semi-final winners before resolution
    - _Bug_Condition: SKIP_GAMEPLAY resolves main bracket to completion, then consolation sequentially — same deferred pattern_
    - _Expected_Behavior: SKIP_GAMEPLAY resolves schedule entries in order, each containing main + consolation matchups_
    - _Preservation: Final placement computation via computePlacements produces identical results_
    - _Requirements: 3.7_

  - [x] 3.8 Update `BracketVisualization.tsx` to render consolation matchups
    - Add `consolationByColumn` memo that maps each round column index to its consolation matchups using `consolationRounds[].sourceRoundIndex + 1` (with 3rd/4th exception mapping to finals column)
    - Add `consolationMatchups` prop to `RoundColumn` component
    - Render consolation matchups BELOW main-bracket matchups in each column with:
      - Thin top border separator (`border-t border-[#f5c542]/30`)
      - Small placement header label in muted gold (`text-[#f5c542]/70 text-[10px]`)
      - Header text derived from `placementStart`: "9th/10th", "5th/6th Place", "7th/8th Place", "3rd/4th"
    - Apply same `MatchupCard` styling for consolation matchups (winner highlight, loser dim/line-through, outcome badge)
    - Handle the 3rd/4th visual placement exception: display under finals column even though played one round earlier
    - Generate placement labels using formula: for matchup at index i, label is `${placementStart + i*2}th/${placementStart + i*2 + 1}th`
    - _Bug_Condition: BracketVisualization has no awareness of consolationRounds — eliminated players' placement games are invisible_
    - _Expected_Behavior: consolation matchups render in the correct column with appropriate headers and styling_
    - _Preservation: Main-bracket rendering (round labels, matchup cards, bye indicators, winner highlighting, auto-scroll) must be unchanged_
    - _Requirements: 2.10, 2.11, 2.12, 2.13, 2.14, 3.8_

  - [x] 3.9 Update `generateBracket` to initialize schedule
    - After bracket generation, call `buildSchedule` to create the initial schedule (containing only the first main-bracket round with no consolation)
    - Set `currentScheduleIndex = 0` in the returned bracket
    - Initialize `schedule` as an array with at least the first entry
    - _Bug_Condition: No schedule exists on the bracket, so nothing can use schedule-based lookup_
    - _Expected_Behavior: Every generated bracket starts with a schedule that maps its first round_
    - _Preservation: All other generateBracket outputs (rounds, seeds, byes, eliminated, consolationRounds) remain identical_
    - _Requirements: 2.1, 2.2_

  - [x] 3.10 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Consolation Rounds Scheduled Concurrently
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior:
      - After play-in resolves, consolation rounds are generated for eliminated players
      - Active matchups for the next game round include BOTH main-bracket AND consolation matchups
      - No "No active matchups" hang occurs because schedule entries only reference consolation rounds with populated matchup slots
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [x] 3.11 Verify preservation tests still pass
    - **Property 2: Preservation** - Main Bracket Progression and Drive Gameplay Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix:
      - generateBracket produces identical bracket structures for all player counts 2-10
      - resolveCurrentRound advances winners identically
      - computePlacements produces identical placement maps
      - Drive initialization and coin toss ceremonies work identically
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite to verify no regressions
  - Verify bug condition exploration test passes (consolation generated concurrently)
  - Verify preservation tests pass (main bracket logic unchanged)
  - Verify 10-player tournament integration: play-in → QF+9th/10th → SF+5th-8th SF → 5th-8th F+3rd/4th → Finals
  - Verify 8-player tournament: no consolation during first round, proper scheduling after
  - Verify SKIP_GAMEPLAY mode resolves all schedule entries correctly with unique placements 1-N
  - Verify BracketVisualization renders consolation matchups in correct columns with headers
  - Verify "View final results" after finals shows results immediately (no unexpected consolation transition)
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- The exploration test (Task 1) and preservation tests (Task 2) must be written and run BEFORE any implementation begins.
- Task 1 is expected to FAIL on unfixed code (confirming the bug exists). Task 2 is expected to PASS on unfixed code (confirming baseline behavior).
- The 3rd/4th place match is a scheduling exception: it plays in a standalone round before finals, not concurrent with finals.
- Mini-bracket consolation (5th-8th for 10-player tournaments) requires slot population from semi-final winners before activation.
- The SKIP_GAMEPLAY path must mirror the schedule-based advancement logic used in the normal gameplay path.
