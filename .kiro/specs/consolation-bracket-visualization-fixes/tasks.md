# Implementation Plan: Consolation Bracket Visualization Fixes

## Overview

Fix four interrelated bugs in the consolation bracket system by simplifying `buildSchedule()` to consolidate all consolation into a single round, correcting placement labels, restructuring the UI into a separate consolation row, and suppressing eliminated styling in consolation context.

## Tasks

- [ ] 1. Simplify buildSchedule() to consolidate all consolation into a single round
  - [x] 1.1 Rewrite `buildSchedule()` in `packages/server/src/games/playcaller/BracketEngine.ts`
    - Remove the complex logic that distributes consolation rounds across concurrent main-bracket rounds
    - Replace with simplified algorithm: all main rounds (0 to finalsIndex-1) → single consolation entry (all indices) → finals
    - The consolation entry has `mainBracketRoundIndex: null` and `consolationRoundIndices` containing every consolation index
    - Only insert the consolation entry if `bracket.consolationRounds.length > 0`
    - Set consolation entry description to `"Consolation"`
    - Remove helper functions no longer needed (`buildDescription`, consolation-by-main-round mapping logic)
    - Keep `getRoundDescription()` and `getConsolationDescription()` as they're still used for labels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.2 Write property tests for buildSchedule()
    - **Property 1: Schedule consolidates all consolation into one entry**
    - **Property 2: Schedule ordering is main-rounds then consolation then finals**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**

- [ ] 2. Fix placement label derivation
  - [x] 2.1 Extract `getConsolationLabel()` as an exported utility in `BracketEngine.ts`
    - For single matchup: return `${ordinal(ps)}/${ordinal(ps + 1)}`
    - For 2 matchups: return `${ordinal(ps)}-${ordinal(ps + 3)} SF`
    - Ensure `ordinal()` helper is accessible (move from BracketVisualization.tsx to shared or keep local)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.2 Write property tests for getConsolationLabel()
    - **Property 3: Single-matchup consolation label format**
    - **Property 4: Multi-matchup consolation label format**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Restructure BracketVisualization with separate consolation row
  - [ ] 4.1 Create ConsolationRow component in `packages/client/src/games/playcaller/BracketVisualization.tsx`
    - New component that receives `bracket`, `getPlayerDisplay`, and `isEliminated` props
    - Map consolation rounds to visual column index via formula: `totalRounds - 1 - floor((placementStart - 3) / 2)`
    - Render each consolation round under the corresponding main-bracket column
    - For 10 players: 9th/10th→col 0 (Play-in), 7th/8th→col 1 (QF), 5th/6th→col 2 (SF), 3rd/4th→col 3 (Finals)
    - Render a "Consolation" label on the left side
    - Render each consolation round with its label (from `getConsolationLabel`) and MatchupCards
    - Pass `isConsolation={true}` to all MatchupCards in this row
    - Show "TBD" for empty player slots (playerA/playerB === "")
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 4.2 Refactor BracketVisualization layout to two-row structure
    - Remove the `consolationByColumn` useMemo and all inline consolation rendering from RoundColumn
    - Remove `consolationMatchups` prop from RoundColumn
    - Restructure the main component return to have two sections: main bracket row and ConsolationRow below
    - Main bracket row renders only the `bracket.rounds` as RoundColumn components (no consolation)
    - ConsolationRow renders below with all consolation matchups
    - _Requirements: 3.1, 3.2_

  - [ ] 4.3 Write property test for consolation row column alignment
    - **Property 5: Consolation row column alignment**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 5. Fix eliminated styling in consolation context
  - [ ] 5.1 Add `isConsolation` prop to MatchupCard and PlayerSlot components
    - Add optional `isConsolation?: boolean` to MatchupCardProps interface
    - Pass `isConsolation` through to both PlayerSlot renders
    - Add optional `isConsolation?: boolean` to PlayerSlotProps interface
    - Modify PlayerSlot styling logic: when `isConsolation === true`, do not apply eliminated styling
    - Keep loser styling for resolved consolation matchups (only triggered when `isLoser === true`)
    - Change condition from `isLoser || isEliminated` to `isLoser || (!isConsolation && isEliminated)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.2 Write property tests for PlayerSlot styling behavior
    - **Property 6: isConsolation controls elimination styling**
    - **Property 7: Resolved consolation applies correct winner/loser styling**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The `ordinal()` helper already exists in BracketVisualization.tsx — consider whether to move it to a shared util or keep it duplicated in BracketEngine.ts
- The `getConsolationDescription()` function in BracketEngine.ts has similar logic to the new `getConsolationLabel()` — refactor/rename as appropriate to avoid duplication

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "5.1"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "5.2"] },
    { "id": 4, "tasks": ["4.3"] }
  ]
}
```
