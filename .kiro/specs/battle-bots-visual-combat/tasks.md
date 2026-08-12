# Implementation Plan: Battle Bots Visual Combat

## Overview

This implementation adds a purely cosmetic animation overlay to the Battle Bots replay system. The plan follows a bottom-up approach: first building pure logic engines (testable without React), then SVG components, then the orchestrating AnimationLayer, and finally integrating into the existing arena components. All animation work is additive—no existing replay logic is modified.

## Tasks

- [x] 1. Create animation constants and shared types
  - [x] 1.1 Create animation constants file and TypeScript interfaces
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/constants.ts` with `ANIMATION_CONSTANTS` object
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/types.ts` with all interfaces: `SlideDecision`, `SlideEngineConfig`, `HitEffect`, `DamageNumberEffect`, `TickAnimationState`, `WeaponHitType`, `HitSVGProps`, `AnimationLayerProps`
    - Export all types and constants from an `animations/index.ts` barrel file
    - _Requirements: 1.1, 1.3, 2.3, 4.2, 4.3, 4.4, 6.1, 6.3_

- [x] 2. Implement SlideEngine pure logic module
  - [x] 2.1 Implement SlideEngine functions
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/SlideEngine.ts`
    - Implement `computeSlideProbability(attacksInTick)` → `min(1, attackCount / SLIDE_INTERVAL_TICKS)`
    - Implement `computeSlideDirection(mode, position)` → 'left' | 'right' | 'down'
    - Implement `computeSlideOffset(robotWidth, mode)` → offset in px within configured bounds
    - Implement `computeAnimationDuration(gameSpeed)` → clamped duration
    - Implement `evaluateSlide(attackerId, attacksInTick, config, isEliminated, position?)` → `SlideDecision`
    - Ensure eliminated robots always get `{ shouldSlide: false }` and disabled flag returns no slides
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 6.1, 6.3, 6.4_

  - [ ]* 2.2 Write property tests for SlideEngine — Property 1
    - **Property 1: Slide trigger probability scales correctly**
    - Test `computeSlideProbability` with arbitrary positive attack counts
    - Verify result equals `min(1, attackCount / 3)`
    - **Validates: Requirements 1.1, 2.1**

  - [ ]* 2.3 Write property tests for SlideEngine — Property 2
    - **Property 2: Slide direction correctness**
    - Test `computeSlideDirection` for all mode/position combinations
    - Verify 1v1 left → 'right', 1v1 right → 'left', FFA → 'down'
    - **Validates: Requirements 1.2, 2.2**

  - [ ]* 2.4 Write property tests for SlideEngine — Property 3
    - **Property 3: Slide offset within configured bounds**
    - Test `computeSlideOffset` with arbitrary positive robot widths
    - Verify 1v1 offset ∈ [10%, 25%] of robotWidth and FFA offset ∈ (0, 25%] of cell dimension
    - **Validates: Requirements 1.3, 2.3**

  - [ ]* 2.5 Write property tests for SlideEngine — Properties 4 and 5
    - **Property 4: Eliminated robots produce no animation effects**
    - **Property 5: Disabled slide flag prevents all slide animations**
    - Test `evaluateSlide` with eliminated=true always returns `shouldSlide: false`
    - Test `evaluateSlide` with slideEnabled=false always returns `shouldSlide: false`
    - **Validates: Requirements 1.5, 2.4, 3.1, 3.2, 7.3**

- [x] 3. Implement HitEffectEngine pure logic module
  - [x] 3.1 Implement HitEffectEngine functions
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/HitEffectEngine.ts`
    - Implement `getWeaponSizeLimit(weaponType)` returning configured max percentage
    - Implement `computeHitPosition(targetWidth, targetHeight, index)` → randomized `{ x, y }` within bounds
    - Implement `buildHitEffect(event, attackerWeapon, attackerColor, targetBounds, effectIndex)` → `HitEffect`
    - Handle miss events: set opacity to 0.3 for `hit === false`
    - Default unknown weapon types to 'drill'
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9_

  - [ ]* 3.2 Write property tests for HitEffectEngine — Properties 6, 7, 8
    - **Property 6: Weapon type resolution correctness**
    - **Property 7: Hit SVG size within weapon-specific bounds**
    - **Property 8: Hit SVG colored with attacker color**
    - Test `buildHitEffect` with all weapon types resolves to matching type
    - Test computed size never exceeds weapon-specific limits
    - Test color field always matches attacker color input
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 3.3 Write property tests for HitEffectEngine — Properties 9 and 10
    - **Property 9: Hit positions within target bounding box**
    - **Property 10: Miss events produce reduced opacity and no damage number**
    - Test `computeHitPosition` x ∈ [0, width] and y ∈ [0, height] for any positive bounds
    - Test `buildHitEffect` with hit=false returns opacity 0.3
    - **Validates: Requirements 4.6, 4.8, 4.9, 5.4**

- [x] 4. Implement DamageNumberEngine pure logic module
  - [x] 4.1 Implement DamageNumberEngine functions
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/DamageNumberEngine.ts`
    - Implement `computeDamageNumberOffset(index, totalInTick)` → distinct vertical offset per stacked number
    - Implement `buildDamageNumber(event, targetBounds, gameSpeed, stackIndex)` → `DamageNumberEffect | null`
    - Return null for miss events (hit === false)
    - Use titleText theme token for color
    - Ensure minimum 30px float distance
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 6.1, 6.3, 6.4_

  - [ ]* 4.2 Write property tests for DamageNumberEngine — Properties 11, 12, 13
    - **Property 11: Damage number displays correct integer value**
    - **Property 12: Multiple damage numbers non-overlapping**
    - **Property 13: Animation duration computation**
    - Test `buildDamageNumber` value equals event damage for hits
    - Test `computeDamageNumberOffset` produces distinct offsets for indices 0..N-1
    - Test duration = gameSpeed when ≥ 150, or 0.9 * gameSpeed when < 150
    - **Validates: Requirements 5.1, 5.6, 6.1, 6.3, 6.4**

- [x] 5. Checkpoint - Ensure all pure logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create weapon-specific Hit SVG components
  - [x] 6.1 Implement BlasterHitSVG, BazookaHitSVG, and DrillHitSVG components
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/hitEffects/BlasterHitSVG.tsx` — elongated line graphic
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/hitEffects/BazookaHitSVG.tsx` — jagged starburst outline graphic
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/hitEffects/DrillHitSVG.tsx` — drill icon graphic
    - Each accepts `HitSVGProps` (color, size, opacity)
    - Create `hitEffects/index.ts` barrel with weapon-to-component mapping
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.8_

- [x] 7. Implement AnimationLayer React component
  - [x] 7.1 Implement AnimationLayer component with overlay positioning
    - Create `packages/client/src/games/battle-bots/BattlePhase/animations/AnimationLayer.tsx`
    - Render absolute-positioned overlay div with `pointer-events: none` and appropriate z-index
    - Accept `AnimationLayerProps` and subscribe to tick changes
    - Guard: produce no effects when `isPlaying === false && isComplete === false`
    - Guard: produce no effects for eliminated robots
    - On each tick with AttackEvents, invoke SlideEngine, HitEffectEngine, and DamageNumberEngine
    - Use `framer-motion` for orchestrating slide translate, hit SVG display (150ms), and damage number float+fade
    - Implement DOM cleanup: remove overlay elements within 500ms of animation completion
    - Handle in-progress slide completion when slideEnabled toggled off (allow current cycle to finish)
    - _Requirements: 1.4, 1.5, 3.3, 3.4, 4.6, 4.7, 5.2, 5.5, 6.2, 6.5, 7.1, 7.2, 7.4, 7.5, 7.6_

  - [ ]* 7.2 Write property test for AnimationLayer guard — Property 14
    - **Property 14: Paused state prevents all new animations**
    - Test that when isPlaying=false and isComplete=false, the animation layer logic produces zero effects
    - **Validates: Requirements 6.5**

  - [ ]* 7.3 Write unit tests for AnimationLayer
    - Test overlay uses `position: absolute` and `pointer-events: none`
    - Test Hit_SVG removal after 150ms duration
    - Test damage number DOM cleanup after fade-out
    - Test DOM cleanup within 500ms of animation end
    - Test slide uses CSS transform only (no layout shift)
    - _Requirements: 4.7, 5.5, 7.2, 7.4, 7.5, 7.6_

- [x] 8. Integrate AnimationLayer into ReplayBattleArena (1v1)
  - [x] 8.1 Wire AnimationLayer into ReplayBattleArena
    - Wrap existing content in `ReplayBattleArena.tsx` with a `position: relative` container
    - Add `AnimationLayer` as a sibling overlay inside the container
    - Pass tick data, hpStates, robots, robotColors, gameSpeed, isPlaying, isComplete, mode='1v1', and robotRefs
    - Add ref forwarding to robot card elements for position calculations
    - Ensure no changes to existing HP bar transitions, defeated state rendering, or layout structure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Integrate AnimationLayer into ReplayFFAArena (FFA)
  - [x] 9.1 Wire AnimationLayer into ReplayFFAArena
    - Wrap existing content in `ReplayFFAArena.tsx` with a `position: relative` container
    - Add `AnimationLayer` as a sibling overlay inside the container
    - Pass tick data, hpStates, robots, robotColors, gameSpeed, isPlaying, isComplete, mode='ffa', and robotRefs
    - Add ref forwarding to robot grid cell elements for position calculations
    - Ensure no changes to existing grid layout or defeated state presentation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 10.1 Write integration tests for full animation overlay
  - Test AnimationLayer renders without layout shifts in both 1v1 and FFA modes
  - Test overlay elements don't intercept pointer events
  - Test animation layer reads state immutably (no mutations to hpStates or tick data)
  - Test slide animation only uses CSS transform (no width/margin/padding changes)
  - _Requirements: 1.4, 7.1, 7.4, 7.5_

- [x] 11. Final checkpoint - Verify complete integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All pure logic is separated from React rendering for testability
- `framer-motion` is already in project dependencies — no new libraries needed
- `fast-check` is already in devDependencies for property-based testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.3", "4.2", "6.1"] },
    { "id": 3, "tasks": ["7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3"] },
    { "id": 5, "tasks": ["8.1", "9.1"] },
    { "id": 6, "tasks": ["10.1"] }
  ]
}
```
