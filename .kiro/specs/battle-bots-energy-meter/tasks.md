# Implementation Plan: Battle Bots Energy Meter

## Overview

Replace the discrete `tick % tickInterval === 0` attack scheduling with a continuous energy accumulation system. Each bot gains `energyPerTick` energy per tick; when the accumulator reaches ≥100, an attack fires and overflow is preserved. This touches the modifier table, combat stats derivation, battle engine simulation, tick log format, client energy bar UI, and projectile animation replacing the slide engine.

## Tasks

- [x] 1. Migrate data model interfaces and modifier table
  - [x] 1.1 Update ModifierEntry interface and MODIFIER_TABLE values
    - Replace `ticksPerAttack` with `attackEnergyPerTick` field in the `ModifierEntry` interface in `packages/server/src/games/battle-bots/ModifierTable.ts`
    - Update `MODIFIER_TABLE` constant with initial energy values: 10.5, 15.0, 20.0, 25.0, 31.5, 37.0, 44.2 for stars 1–7
    - Preserve existing `damageMultiplier` and `accuracyMultiplier` values unchanged
    - _Requirements: 4.1, 4.2, 5.1_

  - [x] 1.2 Update CombatRobot type and deriveCombatStats function
    - Replace `tickInterval` with `energyPerTick` field and add `currentEnergy: number` field to `CombatRobot` in `packages/server/src/games/battle-bots/types.ts`
    - Update `deriveCombatStats` to return `energyPerTick` from `MODIFIER_TABLE[stars.speed].attackEnergyPerTick` instead of `tickInterval`
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 1.3 Update TickEntry type with energyStates field
    - Add `energyStates: Record<string, number>` field to the `TickEntry` interface
    - _Requirements: 9.1_

  - [x] 1.4 Update legacy adapter robotInstanceToCombatRobot
    - Set `energyPerTick: 100` and `currentEnergy: 0` on the mapped CombatRobot so legacy bots attack every tick
    - _Requirements: 5.5, 10.5_

  - [x]* 1.5 Write property tests for data model changes
    - **Property 13: deriveCombatStats energy mapping**
    - **Validates: Requirements 5.4**
    - **Property 14: Legacy adapter mapping**
    - **Validates: Requirements 5.5, 10.5**

- [x] 2. Implement energy-based attack scheduling in BattleEngine
  - [x] 2.1 Replace modulo-based attack check with energy accumulation in simulate1v1
    - In `packages/server/src/games/battle-bots/simulation/BattleEngine.ts`, replace the `tick % tickInterval === 0` logic in the 1v1 simulation
    - Initialize energy accumulators to 0 for all bots at battle start
    - Each tick: add `energyPerTick` to each living bot's accumulator, then determine attackers as bots with energy ≥ 100
    - After attack processing: subtract 100 from each attacker's energy (preserve overflow), cap at 99 for bots with energyPerTick ≥ 100
    - Record `energyStates` mapping living bot ownerIds to their post-tick energy values in each TickEntry
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.2 Replace modulo-based attack check with energy accumulation in simulateFFAInternal
    - Apply the same energy accumulation logic to the FFA simulation path
    - Ensure eliminated bots are excluded from energy accumulation on subsequent ticks
    - Record `energyStates` in each FFA TickEntry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2, 10.2_

  - [x] 2.3 Verify Guaranteed Survivor Rule and tick limit integration
    - Confirm the existing GSR logic works correctly with energy-triggered attacks (snapshot-based damage model unchanged)
    - Confirm the 1000-tick termination rule works with the new scheduling
    - _Requirements: 10.1, 10.3, 10.4_

  - [x]* 2.4 Write property tests for energy accumulation
    - **Property 1: Energy accumulation per tick**
    - **Validates: Requirements 1.1, 6.2**
    - **Property 2: No attack below threshold**
    - **Validates: Requirements 1.3**

  - [x]* 2.5 Write property tests for attack triggering and overflow
    - **Property 3: Attack triggers at threshold**
    - **Validates: Requirements 2.1, 3.3**
    - **Property 4: Overflow preservation round-trip**
    - **Validates: Requirements 2.2, 3.1, 3.2, 1.5**
    - **Property 5: Overflow cap for high-energy bots**
    - **Validates: Requirements 2.4**

  - [x]* 2.6 Write property tests for attack mechanics and state correctness
    - **Property 6: Attack mechanics invariants**
    - **Validates: Requirements 2.3, 2.5, 10.4**
    - **Property 7: Eliminated bot exclusion**
    - **Validates: Requirements 3.4, 6.5, 9.2**
    - **Property 8: Multiple simultaneous attackers**
    - **Validates: Requirements 6.3**
    - **Property 9: EnergyStates record correctness**
    - **Validates: Requirements 6.4, 9.1**

  - [x]* 2.7 Write property tests for backward compatibility
    - **Property 10: Guaranteed Survivor Rule with energy system**
    - **Validates: Requirements 10.1**
    - **Property 11: FFA target self-exclusion**
    - **Validates: Requirements 10.2**
    - **Property 12: Tick limit termination**
    - **Validates: Requirements 10.3**

- [x] 3. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement EnergyBar UI component
  - [x] 4.1 Create EnergyBar component
    - Create `packages/client/src/games/battle-bots/BattlePhase/EnergyBar.tsx`
    - Render a horizontal bar with fill width = `(currentEnergy / 100) * 100%`
    - Use blue color (#4fc3f7) to differentiate from HP bar, height h-2.5 (smaller than HP bar's h-4)
    - Apply CSS `transition: width ${gameSpeed}ms linear` for smooth fill animation
    - Apply `opacity-50 grayscale` styling when bot is eliminated
    - Retain last known energy value if bot is missing from energyStates
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x]* 4.2 Write property test for EnergyBar fill proportion
    - **Property 15: EnergyBar fill proportion**
    - **Validates: Requirements 7.2**

- [x] 5. Integrate EnergyBar into ReplayBattleArena
  - [x] 5.1 Add energyStates tracking to ReplayBattleArena
    - In `packages/client/src/games/battle-bots/BattlePhase/ReplayBattleArena.tsx`, add `useState<Record<string, number>>` for energy states
    - Update energy state from `tickEntry.energyStates` in the tick callback
    - On reconnect, read `energyStates` from the reconnect tick's TickEntry directly (no iteration)
    - Pass `currentEnergy` to each bot's fighter card
    - Render `EnergyBar` below `HPBar` in the `max-w-[120px] lg:max-w-[160px]` container
    - _Requirements: 7.1, 7.3, 9.3, 9.4_

- [x] 6. Implement ProjectileEngine and replace SlideEngine
  - [x] 6.1 Create ProjectileEngine module
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/ProjectileEngine.ts`
    - Implement `computeProjectilePhases(gameSpeed)`: split into 30% exit, 20% delay, 50% travel; apply 0.9 clamping factor when gameSpeed < 150ms
    - Implement `computeAttackerPoints(attackerBounds, mode)`: center-right edge for 1v1, bottom-center for FFA
    - Implement `computeTargetEntry(targetBounds, mode)`: 150% width left for 1v1, 150% height above for FFA
    - Export `ProjectileDecision` interface and helper functions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7, 8.8_

  - [x]* 6.2 Write property tests for ProjectileEngine
    - **Property 16: Projectile phase timing invariant**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.7, 8.8**
    - **Property 17: Projectile origin and entry positions**
    - **Validates: Requirements 8.1, 8.3**

  - [x] 6.3 Replace SlideEngine with ProjectileEngine in AnimationLayer
    - Modify `packages/client/src/games/battle-bots/BattlePhase/animations/AnimationLayer.tsx`
    - Remove `SlideEngine` import and `slideEnabled` prop
    - For each attack event, compute projectile phases and positions via ProjectileEngine
    - Render a `<motion.div>` projectile element (8px colored circle) animated through three keyframe phases: exit → delay → travel
    - On travel phase completion, trigger existing `buildHitEffect` and `buildDamageNumber` at impact location
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 7. Checkpoint - Ensure all client-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create balance tuning script
  - [x] 8.1 Implement tuneEnergyValues script
    - Create `packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts`
    - Define reference bot as 3-3-3 star distribution with deterministic combat (accuracy always hits, damage = arithmetic mean of 1 to maxHit)
    - Enumerate all 48 valid build configurations (star distributions summing to 9, each star 1–7)
    - Simulate 10,000 matches per build against the reference bot
    - Report win rates and flag builds outside the 48%–52% band with their star distribution and observed win rate
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 9. Wire integration and update FFA phase
  - [x] 9.1 Update FFAPhase components to support energyStates
    - Ensure the FFA replay arena in `packages/client/src/games/battle-bots/FFAPhase/` reads `energyStates` from FFA tick entries
    - Render EnergyBar on FFA fighter cards with the same behavior as 1v1
    - Ensure projectile animation uses FFA mode (bottom-center departure, above entry)
    - _Requirements: 7.1, 8.1, 9.3_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementation should use TypeScript
- The project uses fast-check for property-based testing (already in the test infrastructure)
- Existing test files (BattleEngine.prop.test.ts) show the established PBT patterns to follow

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7"] },
    { "id": 5, "tasks": ["4.1", "6.1"] },
    { "id": 6, "tasks": ["4.2", "5.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "9.1"] },
    { "id": 8, "tasks": ["8.1"] }
  ]
}
```
