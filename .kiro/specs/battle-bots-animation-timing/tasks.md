# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Projectile Opacity and Premature HP Application
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both opacity and deferred-HP bugs exist
  - **Scoped PBT Approach**: For any tick where `tickEntry.attacks.length > 0`, scope to concrete cases: a single attack with known attacker/target bounds
  - Test 1a — Exit opacity bug: Render AnimationLayer with a tick containing one attack. Assert the exit-phase motion.div animates opacity from 1 → 0 over exitDurationMs. On unfixed code, exit phase keeps `animate.opacity === 1` (no fade-out), so assertion fails.
  - Test 1b — Travel opacity bug: Render AnimationLayer with a tick containing one attack. Wait for travel phase. Assert travel-phase motion.div has `initial.opacity === 0` and `animate.opacity === 1`. On unfixed code, both are 1 (no fade-in), so assertion fails.
  - Test 1c — Premature HP bug: Render ReplayBattleArena with a tick log containing one attack (targetHpAfter < maxHp). After the tick fires but before any animation completes, assert hpStates has NOT yet been updated. On unfixed code, hpStates updates immediately, so assertion fails.
  - Test 1d — Premature elimination bug: Render ReplayBattleArena with a tick containing an elimination. Assert the robot is NOT marked eliminated until projectile impact. On unfixed code, eliminated is set immediately, so assertion fails.
  - `isBugCondition(input)`: `tickEntry.attacks.length > 0 AND (opacityTransitionMissing(phase) OR hpAppliedBeforeImpact(tickEntry))`
  - `expectedBehavior(result)`: Exit phase has `animate.opacity === 0`, travel phase has `initial.opacity === 0` and `animate.opacity === 1`, and hpStates only updates after onImpact fires
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Position Animation, Hit Effects, Final HP Values, and Fast-Speed Clamping
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: projectile exit phase moves from `attackerOrigin` to `attackerExit` positionally (30% gameSpeed duration)
  - Observe on UNFIXED code: projectile travel phase moves from `targetEntry` to `targetImpact` positionally (50% gameSpeed duration)
  - Observe on UNFIXED code: `handleProjectileImpact` triggers hit effect SVGs and floating damage numbers for `attack.hit === true`
  - Observe on UNFIXED code: when gameSpeed < 150ms, phase durations apply 0.9 clamping factor
  - Observe on UNFIXED code: projectile creation is skipped when attacker or target is already eliminated
  - Observe on UNFIXED code: final HP values after all ticks equal `attack.targetHpAfter` from tick data
  - Write property-based tests:
    - For all gameSpeed values, exit duration === effective * 0.3, delay === effective * 0.2, travel === effective * 0.5 (with clamping when < 150ms)
    - For all ticks with attacks, exit phase position animates from `attackerOrigin` to `attackerExit`
    - For all ticks with attacks, travel phase position animates from `targetEntry` to `targetImpact`
    - For all attacks where `hit === true`, hit effect SVG is rendered after impact
    - For all attacks where `hit === true` and `damage > 0`, floating damage number appears after impact
    - For any tick log, after all impacts resolve, final hpStates values equal `attack.targetHpAfter`
    - For eliminated robots, no new projectiles are created
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for projectile opacity transitions and deferred HP application

  - [x] 3.1 Extend AnimationLayerProps with onImpact callback (types.ts)
    - Add `onImpact?: (attack: { attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number; isElimination: boolean }) => void` to `AnimationLayerProps` interface
    - _Requirements: 2.4, 2.5_

  - [x] 3.2 Extend ActiveProjectile to carry targetHpAfter and isElimination (AnimationLayer.tsx)
    - Add `targetHpAfter: number` and `isElimination: boolean` to `ActiveProjectile.attackEvent` interface
    - Update projectile creation in the tick processing useEffect to populate these fields from the tick's attack data and eliminations array
    - _Bug_Condition: isBugCondition(input) where tickEntry.attacks.length > 0 AND hpAppliedBeforeImpact_
    - _Requirements: 2.4, 2.5_

  - [x] 3.3 Add opacity transitions to exit and travel phases (AnimationLayer.tsx)
    - Exit phase: change `animate={{ ..., opacity: 1 }}` to `animate={{ ..., opacity: 0 }}`
    - Travel phase: change `initial={{ ..., opacity: 1 }}` to `initial={{ ..., opacity: 0 }}`, keep `animate={{ ..., opacity: 1 }}`
    - Delay phase: no change needed (already opacity 0)
    - _Bug_Condition: isBugCondition(input) where animationPhase IN ['exit', 'travel'] AND opacityTransitionMissing_
    - _Expected_Behavior: Exit fades 1→0, travel fades 0→1_
    - _Preservation: Position animation unchanged (attackerOrigin→attackerExit, targetEntry→targetImpact)_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.4 Call onImpact in handleProjectileImpact (AnimationLayer.tsx)
    - In `handleProjectileImpact`, after existing hit effect logic, call `onImpact?.({ attackerId, targetId, hit, damage, targetHpAfter, isElimination })` using data from the projectile's `attackEvent`
    - Accept `onImpact` from props destructuring
    - _Expected_Behavior: onImpact fires with correct attack data when projectile completes travel_
    - _Preservation: Hit effects and damage numbers still triggered on impact (unchanged)_
    - _Requirements: 2.4, 2.5, 3.3_

  - [x] 3.5 Split processTick in ReplayBattleArena — defer HP updates (ReplayBattleArena.tsx)
    - Remove HP/elimination updates from `processTick` — keep only energy state updates and `setCurrentTickEntry`
    - Create `handleImpact` callback that receives individual attack events from AnimationLayer's `onImpact` and applies: `setHpStates(prev => ({ ...prev, [targetId]: { ...prev[targetId], currentHp: targetHpAfter, ...(isElimination ? { eliminated: true, currentHp: 0 } : {}) } }))`
    - Pass `onImpact={handleImpact}` to `<AnimationLayer>`
    - _Bug_Condition: isBugCondition(input) where hpAppliedBeforeImpact(tickEntry)_
    - _Expected_Behavior: hpStates only updates when onImpact fires_
    - _Preservation: Final HP totals same as before, energy/metadata still immediate_
    - _Requirements: 2.4, 2.5, 3.6, 3.7_

  - [x] 3.6 Handle fast-forward/reconnect edge case (ReplayBattleArena.tsx)
    - Ensure the existing fast-forward loop (when `initialTickIndex > 0`) still applies HP immediately (no deferral during fast-forward — no animations play)
    - This should already work since fast-forward directly calls `setHpStates` outside of `processTick`, but verify it's not broken by the refactor
    - _Preservation: Reconnect HP state matches expected values without waiting for animations_
    - _Requirements: 3.6_

  - [x] 3.7 Handle replay completion edge case (ReplayBattleArena.tsx)
    - Track pending projectile impacts: add a `pendingImpactsRef` (or state counter) that increments when a tick creates projectiles and decrements in `handleImpact`
    - Defer `isComplete` evaluation until `pendingImpactsRef.current === 0` after the controller signals completion
    - Ensure winner determination only fires after all pending impacts are resolved
    - _Preservation: Winner detection and onComplete callback still work correctly_
    - _Requirements: 3.7_

  - [x] 3.8 Apply same deferred HP pattern to ReplayFFAArena (ReplayFFAArena.tsx)
    - Same pattern as ReplayBattleArena: split `processTick` to defer HP/elimination updates
    - Create `handleImpact` callback, pass `onImpact={handleImpact}` to `<AnimationLayer>`
    - Preserve elimination recording (still record to `eliminations` state for ranking display, but defer until impact)
    - Handle fast-forward and completion edge cases same as 1v1
    - _Bug_Condition: Same premature HP application exists in FFA arena_
    - _Expected_Behavior: HP/elimination deferred until projectile impact in FFA mode_
    - _Preservation: Elimination rankings still computed correctly after all impacts_
    - _Requirements: 2.4, 2.5, 3.6, 3.7_

  - [x] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Projectile Opacity and Deferred HP
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied:
      - Exit phase animates opacity 1 → 0
      - Travel phase animates opacity 0 → 1
      - hpStates only updates after onImpact fires
      - Elimination deferred until projectile impact
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [x] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - Position Animation, Hit Effects, Final HP Values, and Fast-Speed Clamping
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions):
      - Position animations unchanged
      - Hit effects and damage numbers still fire on impact
      - Fast-speed clamping still applies
      - Final HP values correct after all impacts resolve
      - Eliminated robots still skipped for projectile creation

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite to ensure no regressions
  - Verify both exploration and preservation tests pass
  - Ensure all tests pass, ask the user if questions arise.
