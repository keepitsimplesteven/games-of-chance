# Consolation Concurrent Scheduling Bugfix Design

## Overview

The Playcaller bracket system currently defers all consolation rounds until after the main bracket finals, then runs them sequentially. This creates two bugs: (1) eliminated players wait idle through the entire tournament before playing their placement games, and (2) when consolation play does begin, it hangs at "No active matchups" due to improperly populated matchup slots. The fix restructures the game loop so that consolation matchups run concurrently with main-bracket rounds, and ensures drive states are properly initialized for all active matchups in a combined round.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when eliminated players exist and the next main-bracket round begins without scheduling concurrent consolation matchups for them
- **Property (P)**: The desired behavior — eliminated players' consolation matchups are included in the same game round as the next main-bracket round, with proper drive state initialization
- **Preservation**: Existing main-bracket progression, drive gameplay, coin toss ceremonies, and scoring that must remain unchanged
- **Game Round**: A single iteration of the coin-toss → picking → resolve loop from the room's perspective, which may contain multiple matchups
- **Combined Round**: A game round containing both main-bracket matchups AND consolation matchups running concurrently
- **`generateConsolationRounds()`**: Function in `BracketEngine.ts` that generates ALL consolation rounds after main bracket completes
- **`beginPlaycallerDown()`**: Function in `roomHandlers.ts` that starts a down-picking cycle, determines active matchups
- **`advancePlaycallerBracket()`**: Function in `roomHandlers.ts` that resolves winners and advances bracket state after drives complete
- **`isComplete(bracket)`**: Returns true when `currentRoundIndex >= totalRounds` (main bracket done)

## Bug Details

### Bug Condition

The bug manifests when a main-bracket round resolves, eliminating players, and the system advances to the next main-bracket round without generating or including consolation matchups for those eliminated players. The system only enters consolation mode after `isComplete(bracket)` returns true, and then it discovers improperly populated matchup slots causing the "No active matchups" hang.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BracketAdvanceEvent (a main-bracket round just resolved)
  OUTPUT: boolean
  
  LET eliminatedThisRound = players eliminated by resolving input.roundIndex
  LET mainBracketComplete = input.bracket.currentRoundIndex >= input.bracket.totalRounds
  
  RETURN eliminatedThisRound.length > 0
         AND NOT mainBracketComplete
         AND consolationMatchupsNotScheduledFor(eliminatedThisRound)
END FUNCTION
```

Secondary bug condition (the hang):
```
FUNCTION isBugCondition_Hang(input)
  INPUT: input of type ConsolationRoundStart
  OUTPUT: boolean
  
  LET consolationRound = input.bracket.consolationRounds[input.bracket.currentConsolationIndex]
  LET activeMatchups = consolationRound.matchups.filter(m => m.playerA !== "" AND m.playerB !== "")
  
  RETURN activeMatchups.length === 0
         OR driveStatesNotInitializedFor(activeMatchups)
END FUNCTION
```

### Examples

- **10 players, quarterfinals begin**: Play-in losers (seeds 9, 10) are eliminated. System starts quarterfinals without scheduling 9th/10th consolation. Expected: 9th/10th game runs concurrently with quarterfinals.
- **10 players, semifinals begin**: Quarterfinal losers (4 players) are eliminated. System starts semifinals without scheduling 5th-8th bracket. Expected: 5th-8th semi-finals run concurrently with semifinals.
- **10 players, finals viewed**: User clicks "View final results" after finals. System enters consolation flow instead of showing results because all consolation was deferred. Expected: Finals are the last game; results show immediately.
- **Consolation round starts but matchups empty**: `consolationRound.matchups[0].playerA === ""` because players were never placed into slots. `beginPlaycallerDown` finds no active matchups, sets no drives, enters PICKING with nothing to pick, loops back to bracket view.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Main-bracket seeding, round generation, and winner advancement via `resolveCurrentRound` must continue to work identically
- Drive gameplay (coin toss → picking → down resolution → drive completion) must function the same for all matchups whether main-bracket or consolation
- Bot behavior (auto coin calls, auto side choices, auto play picks) must work for consolation matchups the same as main-bracket matchups
- SKIP_GAMEPLAY mode must resolve all matchups (main + consolation) in a combined round with random assignments
- Final scoring via `computePlacements` must continue to use consolation results for unique placements
- Bracket generation for power-of-2 player counts (no byes, no consolation needed until later rounds) must remain unchanged
- The coin toss ceremony phase timeout and per-matchup timeouts must continue to function

**Scope:**
All inputs that do NOT involve scheduling consolation matchups alongside main-bracket matchups should be completely unaffected by this fix. This includes:
- Pure main-bracket rounds with no concurrent consolation (e.g., play-in round before anyone is eliminated)
- Drive gameplay mechanics (play matrix, yard gains, turnovers)
- Client rendering of individual matchup states
- Session scoring and leaderboard computation

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Deferred Generation**: `generateConsolationRounds()` is called only after `isComplete(bracket)` returns true (in `advancePlaycallerBracket` and `playcallerPlugin.resolveRound`). This means consolation rounds don't exist until the entire main bracket finishes. The fix requires incremental generation — generating consolation matchups for each group of eliminated players immediately when they're eliminated.

2. **Mutually Exclusive Mode Check**: `beginPlaycallerDown` and `beginCoinTossPhase` use `isComplete(bracket)` as a gate: if true, use consolation matchups; if false, use main-bracket matchups. There's no code path that combines both. The fix requires a unified "active matchups" concept that merges main-bracket and consolation matchups for a given game round.

3. **Empty Matchup Slots in Mini-Brackets**: For 4-player consolation groups (e.g., 5th-8th), the semi-final round is generated with players filled in, but the final round has empty `playerA`/`playerB` (filled after semi-finals resolve via `resolveConsolationRound`). When the system tries to play these empty-slot rounds, `filter(m => m.playerA !== "" && m.playerB !== "")` returns nothing, causing the "No active matchups" hang.

4. **No Concept of "Round Scheduling"**: The current architecture has no mapping from "game round N" to "which consolation rounds should play in this round." Each game round just looks at `currentRoundIndex` or `currentConsolationIndex` independently. The fix needs a scheduling layer that maps main-bracket round progression to concurrent consolation rounds.

5. **3rd/4th Exception Not Modeled**: The requirement that 3rd/4th place runs one round before finals (not concurrent with finals) requires special scheduling logic that doesn't exist at all in the current system.

## Correctness Properties

Property 1: Bug Condition - Consolation Rounds Scheduled Concurrently

_For any_ bracket advance event where players are eliminated and the main bracket is not yet complete, the fixed system SHALL generate consolation matchups for those eliminated players and include them as active matchups in the next game round alongside the main-bracket matchups for that round.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Main Bracket Progression Unchanged

_For any_ bracket state transition that does NOT involve consolation scheduling (pure main-bracket advancement, drive resolution, winner placement), the fixed code SHALL produce the same bracket state as the original code, preserving all existing main-bracket functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 3: Bug Condition - No Consolation During Finals

_For any_ finals round (the last main-bracket round), the fixed system SHALL NOT schedule any concurrent consolation matchups, ensuring the championship game is the sole matchup and results display immediately after.

**Validates: Requirements 2.5, 2.6, 2.9**

Property 4: Bug Condition - Drive States Properly Initialized

_For any_ game round containing consolation matchups (whether concurrent with main-bracket or standalone), the fixed system SHALL properly initialize drive states for all active matchups with valid `playerA` and `playerB` values, preventing the "No active matchups" hang.

**Validates: Requirements 2.7, 2.8**

Property 5: Bug Condition - Consolation Matchups Visible in Bracket View

_For any_ bracket state where consolation rounds exist with populated matchup slots, the BracketVisualization SHALL render those matchups in the correct column with appropriate placement headers, applying the same winner/loser styling as main-bracket matchups.

**Validates: Requirements 2.10, 2.11, 2.12, 2.13, 2.14, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/shared/src/types.ts`

**Changes**:
1. **Add `GameRoundSchedule` type**: A new type that maps a "game round" to its constituent matchups, distinguishing main-bracket from consolation matchups.
   ```typescript
   interface GameRoundSchedule {
     mainBracketRoundIndex: number | null  // null if no main-bracket matchups this round
     consolationRoundIndices: number[]     // indices into bracket.consolationRounds
     description: string                   // e.g., "Quarterfinals + 9th/10th"
   }
   ```

2. **Add `schedule` field to `Bracket`**: An array of `GameRoundSchedule` entries that defines the order of play.
   ```typescript
   interface Bracket {
     // ... existing fields ...
     schedule: GameRoundSchedule[]
     currentScheduleIndex: number
   }
   ```

**File**: `packages/server/src/games/playcaller/BracketEngine.ts`

**Function**: `generateConsolationRounds` → refactored into `generateConsolationForRound`

**Specific Changes**:
1. **New function `generateConsolationForRound(bracket, roundIndex)`**: Generates consolation matchups only for players eliminated in the specified round. Called immediately after each main-bracket round resolves instead of at the end.

2. **New function `buildSchedule(bracket)`**: After the bracket structure is generated, computes the full game-round schedule mapping main-bracket rounds to their concurrent consolation rounds. Handles the 3rd/4th exception by placing it in a standalone round before finals.

3. **New function `getActiveMatchupsForSchedule(bracket, scheduleEntry)`**: Returns all matchups (main + consolation) for a given schedule entry, used by roomHandlers to determine what to play.

4. **Retain `generateConsolationRounds` as backward-compatible wrapper** that calls `generateConsolationForRound` for each elimination round.

**File**: `packages/server/src/games/playcaller/roomHandlers.ts`

**Function**: `beginPlaycallerDown`, `beginCoinTossPhase`, `advancePlaycallerBracket`, `transitionToPicking`

**Specific Changes**:
1. **Replace `isComplete(bracket)` gate with schedule-based lookup**: Instead of checking whether we're in "main bracket mode" or "consolation mode," look up `bracket.schedule[bracket.currentScheduleIndex]` to determine which matchups are active for the current game round.

2. **Modify `beginCoinTossPhase`**: Gather active matchups from both main-bracket round AND scheduled consolation rounds for the current schedule entry.

3. **Modify `transitionToPicking`**: Same as above — initialize drives for all matchups in the current schedule entry.

4. **Modify `advancePlaycallerBracket`**: After resolving all drives in a combined round:
   - Resolve main-bracket matchups via `resolveCurrentRound` (if schedule entry has main-bracket round)
   - Resolve consolation matchups via `resolveConsolationRound` (for each consolation round in the schedule entry)
   - Generate new consolation rounds for newly eliminated players
   - Advance `currentScheduleIndex`
   - If newly generated consolation rounds fit into the next schedule entry, update the schedule

5. **Fix "No active matchups" hang**: Ensure that when a schedule entry references a consolation round whose matchup slots are empty (e.g., 5th-8th final after semi-finals), the semi-final winners have been placed into those slots before the game round begins. This is already handled by `resolveConsolationRound` for mini-bracket advancement — the fix ensures the scheduling order respects these dependencies.

**File**: `packages/server/src/games/playcaller/PlaycallerPlugin.ts`

**Function**: `resolveRound` (SKIP_GAMEPLAY path)

**Specific Changes**:
1. **Update SKIP_GAMEPLAY resolution**: When resolving rounds in skip mode, resolve all matchups in the current schedule entry (main + consolation) before advancing to the next schedule entry.

### Scheduling Algorithm for 10 Players

```
Input: 10 players, bracket totalRounds = 4 (play-in, QF, SF, F)

After bracket generation:
  Schedule[0] = { main: 0, consolation: [], desc: "Play-in" }
  
After play-in resolves (2 eliminated):
  Generate consolation for round 0 losers → consolationRounds[0] = 9th/10th
  Schedule[1] = { main: 1, consolation: [0], desc: "Quarterfinals + 9th/10th" }

After quarterfinals resolve (4 eliminated):
  Generate consolation for round 1 losers → consolationRounds[1] = 5th-8th SF, consolationRounds[2] = 5th-8th F
  Schedule[2] = { main: 2, consolation: [1], desc: "Semifinals + 5th-8th SF" }

After semifinals resolve (2 eliminated):
  Generate consolation for round 2 losers → consolationRounds[3] = 3rd/4th
  
  -- 3rd/4th exception: insert standalone round before finals --
  Schedule[3] = { main: null, consolation: [2, 3], desc: "5th-8th Final + 3rd/4th" }
  Schedule[4] = { main: 3, consolation: [], desc: "Finals" }
```

Note: The 5th-8th final (consolationRounds[2]) runs in Schedule[3] because it depends on the 5th-8th semi-final (consolationRounds[1]) results from Schedule[2]. The 3rd/4th game also runs in Schedule[3] per requirement 2.5.

### RESULT Phase Communication

The `PlaycallerRoundResult` type will be extended to communicate which matchups are main vs consolation:

```typescript
interface PlaycallerRoundResult {
  bracketRound: number           // main-bracket round index, -1 if none
  matchups: Matchup[]            // main-bracket matchups (empty if none)
  consolationMatchups?: Matchup[] // consolation matchups resolved this round
  consolationContext?: {         // metadata for UI
    placementStart: number
    description: string          // e.g., "5th-8th Semifinals"
  }[]
  isComplete: boolean
}
```

### Client-Side Changes: BracketVisualization

**File**: `packages/client/src/games/playcaller/BracketVisualization.tsx`

The current `BracketVisualization` component renders only main-bracket rounds as columns via `bracket.rounds.map(...)`. It has no awareness of `bracket.consolationRounds`. The fix needs to:

1. **Map consolation rounds to their concurrent main-bracket column**: Using the `GameRoundSchedule` data (or the `sourceRoundIndex` on each `ConsolationRound`), determine which column each consolation matchup belongs in. A consolation matchup eliminated in round N appears in the column for round N+1 (the round it runs concurrently with). Exception: 3rd/4th place appears in the finals column.

2. **Render consolation matchups below main-bracket matchups in the same `RoundColumn`**: After the main-bracket matchup cards, render a separator section with:
   - A small placement header (e.g., "9th/10th", "5th/6th Place", "7th/8th Place", "3rd/4th")
   - The consolation `MatchupCard` with the same styling as main-bracket cards (winner highlight, loser dim, outcome badge)

3. **Generate placement labels from ConsolationRound data**: Use `placementStart` to derive the header:
   - `placementStart = 9` with 1 matchup → "9th/10th"
   - `placementStart = 5` with 2 matchups → "5th/6th Place" and "7th/8th Place" (one header per matchup, incrementing by 2)
   - `placementStart = 3` with 1 matchup → "3rd/4th"
   - General formula: for matchup at index i, label is `${placementStart + i*2}th/${placementStart + i*2 + 1}th`

4. **Component structure change to `RoundColumn`**: Add a new prop `consolationMatchups` (array of `{ label: string, matchup: Matchup, resolved: boolean }[]`). Render them after the main matchups with distinct headers.

5. **Styling**: Consolation headers use a smaller font than round labels, muted gold color (`text-[#f5c542]/70`), and a thin top border separator to visually distinguish them from main bracket matchups above.

6. **The 3rd/4th exception**: Even though 3rd/4th is played before the finals, it should appear under the finals column visually. The schedule determines when it's played, but the visual column placement follows the "finals column" convention.

### Data Flow for UI

The `BracketVisualization` receives the full `Bracket` object which includes `consolationRounds[]` and `schedule[]`. For each `RoundColumn`, the component:
1. Finds all consolation rounds whose schedule entry maps to this column index
2. Extracts their matchups and generates placement labels
3. Passes them as the `consolationMatchups` prop to `RoundColumn`

This can be computed as a memo/derived value:
```typescript
// Map: roundColumnIndex → consolation matchups for that column
const consolationByColumn = useMemo(() => {
  const map = new Map<number, { label: string; matchup: Matchup; resolved: boolean }[]>()
  
  for (const cRound of bracket.consolationRounds) {
    // Column = sourceRoundIndex + 1 (concurrent with next round)
    // Exception: if sourceRoundIndex is the semis (totalRounds - 2), 
    // 3rd/4th goes in finals column (totalRounds - 1)
    let columnIndex = cRound.sourceRoundIndex + 1
    if (cRound.placementStart === 3) {
      columnIndex = bracket.totalRounds - 1 // finals column
    }
    
    const entries = map.get(columnIndex) ?? []
    for (let i = 0; i < cRound.matchups.length; i++) {
      const pos = cRound.placementStart + i * 2
      entries.push({
        label: `${ordinal(pos)}/${ordinal(pos + 1)}`,
        matchup: cRound.matchups[i],
        resolved: cRound.resolved,
      })
    }
    map.set(columnIndex, entries)
  }
  
  return map
}, [bracket.consolationRounds, bracket.totalRounds])
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create a 10-player bracket, resolve the play-in round, then inspect what happens next. On unfixed code, we expect consolation rounds to NOT be generated until after finals. Also test that attempting to play a consolation round results in the "No active matchups" hang.

**Test Cases**:
1. **Deferred Generation Test**: Generate a 10-player bracket, resolve play-in round, assert `bracket.consolationRounds.length === 0` (will confirm bug — consolation not generated yet)
2. **Mutually Exclusive Mode Test**: With a 10-player bracket mid-tournament, call `beginPlaycallerDown`. Assert that only main-bracket matchups are initialized as drives, never consolation (will confirm bug)
3. **Empty Matchup Hang Test**: Manually create a consolation round with empty playerA/playerB, attempt to start coin toss phase. Assert it produces "No active matchups" state (will confirm hang bug)
4. **Post-Finals Consolation Test**: Complete the entire main bracket, then observe that `advancePlaycallerBracket` generates all consolation at once and attempts sequential play (will confirm deferred scheduling bug)

**Expected Counterexamples**:
- After play-in resolves, `bracket.consolationRounds` is empty — no consolation generated
- `beginPlaycallerDown` only considers `bracket.rounds[currentRoundIndex]` — ignores eliminated players
- Consolation rounds with empty slots cause `activeMatchups.length === 0` leading to the hang
- Possible causes: `isComplete()` gate, missing incremental generation, no schedule concept

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := advancePlaycallerBracket_fixed(input)
  LET schedule = result.bracket.schedule[result.bracket.currentScheduleIndex]
  ASSERT schedule.consolationRoundIndices.length > 0 OR schedule.mainBracketRoundIndex != null
  ASSERT allMatchupsHaveValidPlayers(getActiveMatchupsForSchedule(result.bracket, schedule))
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT resolveCurrentRound_original(input) = resolveCurrentRound_fixed(input)
  ASSERT generateBracket_original(input) = generateBracket_fixed(input)
  ASSERT computePlacements_original(input) = computePlacements_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many bracket configurations (2-10 players) automatically
- It catches edge cases in bracket seeding and advancement that manual tests miss
- It provides strong guarantees that main-bracket logic is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for main-bracket-only scenarios, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Main Bracket Seeding Preservation**: For all player counts 2-10, verify `generateBracket` produces identical bracket structure (rounds, seeds, byes)
2. **Round Advancement Preservation**: For any resolved round with no consolation involvement, verify `resolveCurrentRound` produces identical winner placement
3. **Placement Scoring Preservation**: For any fully-complete bracket with consolation results, verify `computePlacements` produces identical placement map
4. **Drive Gameplay Preservation**: For any matchup (main or consolation), verify drive initialization, down resolution, and completion detection are unchanged

### Unit Tests

- Test `generateConsolationForRound` produces correct matchups for 2-player and 4-player elimination groups
- Test `buildSchedule` produces correct schedule for 4, 6, 8, and 10 player brackets
- Test `getActiveMatchupsForSchedule` returns merged main + consolation matchups
- Test 3rd/4th exception: verify 3rd/4th game is in a standalone schedule entry before finals
- Test that schedule entries with consolation mini-bracket finals have players properly populated after semi-finals resolve
- Test `advancePlaycallerBracket` correctly resolves both main and consolation matchups in a combined round

### Property-Based Tests

- Generate random player counts (2-10) and verify the schedule always terminates with finals as the last entry containing matchups
- Generate random bracket states mid-tournament and verify that `getActiveMatchupsForSchedule` never returns empty matchups with valid schedule entries
- For all player counts, verify that every eliminated player eventually appears in exactly one consolation matchup (or the 2nd-place final if runner-up)
- Generate random drive outcomes for combined rounds and verify both main-bracket and consolation winners are correctly recorded

### Integration Tests

- Full 10-player tournament: verify round-by-round that the correct matchups appear in each game round (play-in → QF+9th/10th → SF+5th-8th SF → 5th-8th F+3rd/4th → Finals)
- Full 10-player tournament with SKIP_GAMEPLAY: verify all rounds resolve correctly and final placements are unique 1-10
- Full 8-player tournament: verify no consolation runs during quarterfinals (no one eliminated yet from play-in), then consolation properly scheduled in subsequent rounds
- Test with bots: verify bot actions work correctly in combined rounds with both main and consolation matchups
- Test that "View final results" after finals shows results immediately (no unexpected consolation transition)
