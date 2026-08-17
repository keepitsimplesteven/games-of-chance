# Implementation Plan: Battle Bots Combat Rebalance

## Overview

Three-phase implementation: (1) rewrite the fairness simulator with a deterministic reference bot and dual-pass validation, (2) iteratively tune MODIFIER_TABLE values using the simulator until all 28 builds land in the 49–51% win-rate band, (3) fix the EnergyBar snap-back visual artifact on the client.

## Tasks

- [x] 1. Rewrite Fairness Simulator with Reference Bot
  - [x] 1.1 Rewrite `packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts` with the deterministic reference bot simulation loop
    - Implement `simulateVsReference()` where the reference bot deals exactly 1 damage per tick with guaranteed hits and bypasses the energy system
    - Implement build enumeration (all D+A+S=9 combos, each in [1,7], yielding 28 builds)
    - Run 10,000 trials per build against the reference bot
    - Report per-build win rates and flag any outside 49%–51%
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5, 7.1, 7.2, 7.4, 7.6_

  - [x] 1.2 Add Pass 2: all-vs-all mirror match validation to `tuneEnergyValues.ts`
    - After pass 1 completes, run random mirror matches for each of the 28 builds
    - Both sides use normal combat mechanics (energy accumulation, accuracy rolls, damage rolls)
    - Report per-build aggregate win rates as secondary validation
    - _Requirements: 7.3, 7.5_

  - [x]* 1.3 Write property test: Reference Bot Deterministic Behavior
    - **Property 1: Reference Bot Deterministic Behavior**
    - For any simulation tick where the reference bot is alive, verify it deals exactly 1 damage without accuracy roll
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [x]* 1.4 Write property test: Build Enumeration Completeness
    - **Property 7: Build Enumeration Completeness**
    - Verify enumeration produces exactly 28 unique configurations satisfying D+A+S=9, each in [1,7]
    - **Validates: Requirements 7.6**

  - [x]* 1.5 Write property test: Balance Band Classification
    - **Property 2: Balance Band Classification**
    - For any win rate value, verify classification flags out-of-band if and only if below 0.49 or above 0.51
    - **Validates: Requirements 2.2, 2.3**

- [x] 2. Checkpoint - Verify simulator runs correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Tune MODIFIER_TABLE Values
  - [x] 3.1 Update `packages/server/src/games/battle-bots/ModifierTable.ts` with initial tuned values
    - Set attackEnergyPerTick: 12 (star 1) through 50 (star 7), monotonically increasing
    - Set initial damageMultiplier and accuracyMultiplier values (monotonically increasing)
    - Ensure accuracyMultiplier values respect cap: `floor(56 × mult) <= 90` for all stars
    - Ensure damageMultiplier values satisfy: `floor(5 × mult) >= 1` for all stars
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 5.5, 3.1, 3.2, 3.3_

  - [x] 3.2 Run the simulator and iteratively adjust MODIFIER_TABLE until all 28 builds are in the 49–51% band
    - Execute `tuneEnergyValues.ts` and check per-build win rates
    - Adjust damageMultiplier and accuracyMultiplier values for builds outside the band
    - Repeat until pass 1 reports all 28 builds within 49%–51%
    - Verify pass 2 (mirror matches) shows reasonable balance as secondary check
    - _Requirements: 2.4, 5.3_

  - [x]* 3.3 Write property test: Accuracy Cap Formula
    - **Property 3: Accuracy Cap Formula**
    - For any star level in [1,7], verify derived accuracy equals min(floor(56 × accuracyMultiplier), 90) and never exceeds 90
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 3.4 Write property test: Modifier Table Monotonicity
    - **Property 4: Modifier Table Monotonicity**
    - For any pair of consecutive star levels (n, n+1), verify all three columns are strictly increasing
    - **Validates: Requirements 4.3, 5.4, 5.5**

  - [x]* 3.5 Write property test: Damage Minimum Guarantee
    - **Property 5: Damage Minimum Guarantee**
    - For any star level in [1,7], verify floor(5 × damageMultiplier) >= 1
    - **Validates: Requirements 5.1**

- [x] 4. Checkpoint - Verify all 28 builds within balance band
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix EnergyBar Snap-Back
  - [x] 5.1 Update `packages/client/src/games/battle-bots/BattlePhase/EnergyBar.tsx` to track energy direction and conditionally apply CSS transition
    - Add `useRef` to store previous energy value
    - Compare current vs previous energy to detect increasing (charging) vs decreasing (attack fired)
    - Apply `width ${gameSpeed}ms linear` transition only when energy is increasing
    - Set `transition: "none"` when energy decreases (reset) to prevent snap-back artifact
    - _Requirements: 6.1, 6.2, 6.3_

  - [x]* 5.2 Write property test: EnergyBar Transition Direction
    - **Property 6: EnergyBar Transition Direction**
    - For any sequence of energy values, verify transition is applied only when energy increases and is "none" when energy decreases
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 6. Final Checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The MODIFIER_TABLE values need iterative tuning — task 3.2 involves running the simulator repeatedly and adjusting values until convergence
- The reference bot is NOT a CombatRobot — it's modeled directly in the simulation loop with hardcoded behavior
- BattleEngine.ts itself does not change — only the constants and the tuning script
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] }
  ]
}
```
