# Battle Bots Animation Timing Bugfix Design

## Overview

The Battle Bots combat replay has two visual timing defects: (1) projectile animations transition abruptly between phases with no opacity fading, creating a choppy visual, and (2) HP damage and "Defeated" status are applied immediately when a tick fires rather than when the projectile visually impacts the target. The fix adds opacity transitions to the framer-motion projectile phases and defers HP/elimination state updates until `handleProjectileImpact` fires in AnimationLayer.

## Glossary

- **Bug_Condition (C)**: The condition where a projectile animation fires — any tick with attack data triggers projectiles that currently lack fade transitions and whose associated HP damage is applied prematurely.
- **Property (P)**: Projectiles should fade-out during exit and fade-in during travel, and HP/elimination updates should only apply when the projectile impact animation completes.
- **Preservation**: Mouse clicks, game state progression, final HP totals, energy display, hit effects, damage numbers, elimination detection, and replay completion must remain unchanged.
- **AnimationLayer**: Component in `animations/AnimationLayer.tsx` that manages projectile lifecycle (exit → delay → travel → impact) using framer-motion's `AnimatePresence`.
- **ReplayBattleArena**: Component in `BattlePhase/ReplayBattleArena.tsx` that owns `hpStates` and calls `processTick` on each `ReplayController` tick callback.
- **ReplayController**: Class in `BattlePhase/ReplayController.ts` that fires tick callbacks at `gameSpeed` intervals.
- **handleProjectileImpact**: Callback in AnimationLayer that fires when a projectile's travel phase animation completes (framer-motion `onAnimationComplete`).
- **processTick**: Function in ReplayBattleArena that applies `attack.targetHpAfter` and elimination status to `hpStates` state.
- **gameSpeed**: Milliseconds per tick; projectile phases split as 30% exit, 20% delay, 50% travel.

## Bug Details

### Bug Condition

The bug manifests on every tick that contains attack data. Two issues co-occur:

1. **Opacity transitions**: The exit phase animates position from `attackerOrigin` to `attackerExit` but keeps opacity fixed at 1. The travel phase starts and ends at opacity 1. This means the projectile appears/disappears instantly at phase boundaries.

2. **Premature HP update**: `processTick` is called by the `controller.onTick` callback and immediately sets `hpStates` with `attack.targetHpAfter` values and marks eliminations. This happens before the projectile animation has even begun its exit phase.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { tickEntry: TickEntry, animationPhase: string }
  OUTPUT: boolean

  RETURN tickEntry.attacks.length > 0
         AND (
           (animationPhase IN ['exit', 'travel'] AND opacityTransitionMissing(animationPhase))
           OR hpAppliedBeforeImpact(tickEntry)
         )
END FUNCTION
```

### Examples

- **Choppy exit**: Robot A fires a projectile. The projectile moves from `attackerOrigin` to `attackerExit`, then instantly vanishes (opacity stays 1, then the element is removed). Expected: projectile fades from opacity 1 → 0 during exit movement.
- **Abrupt travel start**: After the delay phase, the travel-phase projectile pops in at full opacity at `targetEntry`. Expected: projectile fades from opacity 0 → 1 as it travels to impact.
- **Premature HP loss**: Tick fires with Robot B taking 15 damage. HP bar immediately shows the damage before the projectile has left Robot A. Expected: HP bar updates only when the projectile reaches Robot B (travel phase completes).
- **Premature elimination**: Robot C is eliminated in a tick. "Defeated" badge appears and robot greys out instantly while the killing projectile hasn't arrived yet. Expected: elimination visual only triggers after the killing blow projectile impacts.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Projectile position movement from `attackerOrigin` → `attackerExit` (exit phase) at 30% of gameSpeed
- Projectile position movement from `targetEntry` → `targetImpact` (travel phase) at 50% of gameSpeed
- Hit effect SVGs and floating damage numbers triggered by `handleProjectileImpact`
- Fast-speed clamping (0.9 factor when gameSpeed < 150ms)
- Skipping projectile creation when attacker or target is already eliminated
- Final correct HP totals (same values, just deferred timing)
- Winner determination and `onComplete` callback after all ticks processed
- Energy state updates per tick (unrelated to projectile timing)
- EnergyBar, StarDisplay, and label rendering

**Scope:**
All non-animation state management (energy, replay completion, winner detection) should be unaffected. The final HP values after all projectile impacts for a tick must equal what `attack.targetHpAfter` specifies — only the visual timing of when they appear changes.

## Hypothesized Root Cause

Based on the code analysis, the root causes are:

1. **Missing opacity keyframes in framer-motion `animate` props**: In `AnimationLayer.tsx`, the exit phase renders a `<motion.div>` with `initial={{ opacity: 1 }}` and `animate={{ opacity: 1 }}` — no fade-out. The travel phase uses `initial={{ opacity: 1 }}` and `animate={{ opacity: 1 }}` — no fade-in. These should use opacity transitions.

2. **Synchronous HP application in `processTick`**: `ReplayBattleArena.tsx` registers `controller.onTick((tickEntry) => { processTick(tickEntry); ... })`. This immediately calls `setHpStates` with the final HP values for that tick. There is no mechanism to defer damage until AnimationLayer signals impact completion.

3. **No communication channel from AnimationLayer to parent for damage application**: AnimationLayer's `handleProjectileImpact` currently only triggers hit effects and damage numbers internally. It does not notify the parent component that an attack has landed, so the parent cannot defer HP application until that moment.

4. **AnimationLayerProps lacks an `onImpact` callback**: The `AnimationLayerProps` interface has no prop for signaling impact events back to the parent. This needs to be added.

## Correctness Properties

Property 1: Bug Condition - Projectile Opacity Transitions

_For any_ tick where attacks exist and projectiles are created, the exit phase animation SHALL transition opacity from 1 to 0 over its duration, and the travel phase animation SHALL transition opacity from 0 to 1 over its duration, providing smooth visual continuity.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - Deferred HP Application

_For any_ tick where attacks cause HP changes or eliminations, the `hpStates` update SHALL NOT be applied until `handleProjectileImpact` fires for the corresponding projectile, ensuring visual cause-and-effect between the projectile hitting and HP changing.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation - Final HP Correctness

_For any_ tick after all projectile impacts have completed, the final `hpStates` values SHALL equal the `attack.targetHpAfter` values from the tick's attack data, preserving gameplay correctness.

**Validates: Requirements 3.6**

Property 4: Preservation - Non-Animation Behavior

_For any_ interaction that does not involve projectile animations (energy updates, replay completion, winner detection, hit effect rendering, damage number rendering), the behavior SHALL be identical to the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/client/src/games/battle-bots/BattlePhase/animations/AnimationLayer.tsx`

**Changes**:

1. **Add opacity fade-out to exit phase**: Change the exit phase `<motion.div>` from `animate={{ ..., opacity: 1 }}` to `animate={{ ..., opacity: 0 }}`. The `initial` stays at `opacity: 1`. This makes the projectile fade out as it exits the attacker bounds.

2. **Add opacity fade-in to travel phase**: Change the travel phase `<motion.div>` from `initial={{ ..., opacity: 1 }}` to `initial={{ ..., opacity: 0 }}` and keep `animate={{ ..., opacity: 1 }}`. This makes the projectile fade in as it approaches the target.

3. **Add `onImpact` callback prop**: Extend `AnimationLayerProps` to include an `onImpact?: (attack: { attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number }) => void` prop. Call this in `handleProjectileImpact` before or alongside the existing hit effect logic, passing the `attackEvent` data (extended to include `targetHpAfter`).

4. **Store `targetHpAfter` on ActiveProjectile**: Extend the `attackEvent` field on `ActiveProjectile` to include `targetHpAfter` so it can be passed to the `onImpact` callback when impact occurs.

5. **Pass elimination data through projectile**: For attacks whose target appears in the tick's `eliminations` array, store an `isElimination: boolean` field on the projectile so the `onImpact` callback can signal elimination timing.

---

**File**: `packages/client/src/games/battle-bots/BattlePhase/animations/types.ts`

**Changes**:

6. **Extend `AnimationLayerProps`**: Add `onImpact?: (attack: { attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number; isElimination: boolean }) => void` to the interface.

---

**File**: `packages/client/src/games/battle-bots/BattlePhase/ReplayBattleArena.tsx`

**Changes**:

7. **Split `processTick` into two parts**: Keep tick metadata processing (energy states, setting `currentTickEntry`) in the `onTick` callback but remove the immediate HP/elimination updates from `processTick`.

8. **Add `handleImpact` callback**: Create a new callback that receives individual attack impact events from AnimationLayer and applies the HP update for that specific attack. When `isElimination` is true, also mark the robot as eliminated.

9. **Pass `onImpact` to AnimationLayer**: Wire the `handleImpact` callback as the `onImpact` prop on `<AnimationLayer>`.

10. **Handle edge case: fast-forward/reconnect**: When `initialTickIndex` is set, the fast-forward logic that silently processes ticks should continue to apply HP immediately (no animation to wait for). Only live playback ticks defer.

11. **Handle edge case: replay completion**: The completion check currently uses `hpStates` to determine the winner. Since HP is now deferred, ensure the `isComplete` flag is only evaluated after all pending projectile impacts for the final tick have resolved. This can be achieved by tracking pending impacts and deferring the completion signal.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write component tests that render `AnimationLayer` with mock tick data and inspect the framer-motion animation props. Inspect `ReplayBattleArena` to verify that `hpStates` updates synchronously with tick callbacks.

**Test Cases**:
1. **Exit Opacity Test**: Render AnimationLayer with a tick containing one attack. Assert the exit-phase motion.div has `animate.opacity === 1` (bug confirmation — no fade-out). Will fail assertion that opacity should be 0.
2. **Travel Opacity Test**: Render AnimationLayer with a tick containing one attack. Wait for travel phase. Assert the travel-phase motion.div has `initial.opacity === 1` (bug confirmation — no fade-in). Will fail assertion that initial opacity should be 0.
3. **Immediate HP Test**: Render ReplayBattleArena with a tick log. After first tick fires, assert `hpStates` is already updated before any animation completes (demonstrates premature application).
4. **Immediate Elimination Test**: Render ReplayBattleArena with a tick containing an elimination. Assert the eliminated state is set before projectile animation resolves.

**Expected Counterexamples**:
- Exit phase opacity stays at 1 throughout (no transition to 0)
- Travel phase starts at opacity 1 (no transition from 0)
- HP bar value changes on the same frame the tick fires, not when projectile lands

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL tickEntry WHERE tickEntry.attacks.length > 0 DO
  result := renderAnimationLayer(tickEntry)
  
  // Opacity checks
  exitDiv := result.getExitPhaseDiv()
  ASSERT exitDiv.initial.opacity == 1
  ASSERT exitDiv.animate.opacity == 0
  
  travelDiv := result.getTravelPhaseDiv()
  ASSERT travelDiv.initial.opacity == 0
  ASSERT travelDiv.animate.opacity == 1
  
  // Deferred HP check
  ASSERT hpStates NOT updated until onImpact callback fires
  
  simulateImpact(tickEntry.attacks[0])
  ASSERT hpStates[targetId].currentHp == attack.targetHpAfter
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL tickEntry WHERE tickEntry.attacks.length == 0 DO
  ASSERT renderOriginal(tickEntry) == renderFixed(tickEntry)
END FOR

FOR ALL tickEntry WHERE tickEntry.attacks.length > 0 DO
  // After all impacts resolve, final HP values match
  resolveAllImpacts(tickEntry)
  ASSERT hpStates_fixed == hpStates_original (same final values)
  
  // Position animation unchanged
  ASSERT exitPhase.position == originalExitPhase.position
  ASSERT travelPhase.position == originalTravelPhase.position
  
  // Hit effects and damage numbers still fire on impact
  ASSERT hitEffectsTriggered == originalHitEffectsTriggered
  ASSERT damageNumbersTriggered == originalDamageNumbersTriggered
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of attack counts, damage values, and elimination states
- It catches edge cases like multiple simultaneous eliminations or zero-damage hits
- It provides strong guarantees that final HP state is unchanged across all scenarios

**Test Plan**: Observe behavior on UNFIXED code for final HP values, hit effect triggering, and damage number display. Write property-based tests that verify these remain identical after the fix.

**Test Cases**:
1. **Final HP Preservation**: For any tick log, after all projectile impacts resolve, final `hpStates` must match `attack.targetHpAfter` values from the tick data
2. **Hit Effect Preservation**: For any attack where `hit === true`, a hit effect SVG is rendered at the target after impact
3. **Damage Number Preservation**: For any attack where `hit === true` and `damage > 0`, a floating damage number appears after impact
4. **Position Animation Preservation**: Exit phase moves from `attackerOrigin` to `attackerExit`; travel phase moves from `targetEntry` to `targetImpact` (same positions as before)
5. **Fast-Speed Clamping Preservation**: When gameSpeed < 150ms, phase durations use 0.9 factor (unchanged)

### Unit Tests

- Test exit phase framer-motion props include `animate.opacity: 0`
- Test travel phase framer-motion props include `initial.opacity: 0` and `animate.opacity: 1`
- Test `onImpact` callback is called with correct attack data when travel completes
- Test `hpStates` does not change until `onImpact` is invoked
- Test elimination is deferred until `onImpact` with `isElimination: true`
- Test fast-forward/reconnect still applies HP immediately (no deferral)

### Property-Based Tests

- Generate random tick logs with varying attack counts (1–8 attacks per tick) and verify final HP values equal `targetHpAfter` after all impacts resolve
- Generate random gameSpeed values (50ms–500ms) and verify phase durations maintain 30/20/50 split with clamping
- Generate random elimination patterns and verify winner detection produces same result as immediate application

### Integration Tests

- Full replay with multiple ticks: verify HP bar transitions are visually synchronized with projectile impacts
- Reconnect scenario: verify fast-forward applies HP immediately, then live ticks defer correctly
- Multiple simultaneous eliminations in one tick: verify all "Defeated" badges appear only after respective projectile impacts
- Replay completion: verify winner is determined correctly even with deferred HP
