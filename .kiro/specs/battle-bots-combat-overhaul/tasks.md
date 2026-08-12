# Implementation Plan: Battle Bots Combat Overhaul

## Overview

This plan replaces the existing flat-stat combat system with a composable part-based build system, tick-interval scheduling, simultaneous snapshot resolution, and pre-computed simulation with client-side replay. Implementation proceeds bottom-up: shared types → server-side engine → plugin wiring → client UI.

## Tasks

- [x] 1. Set up shared types, constants, and core data modules
  - [x] 1.1 Create updated types file with all new interfaces
    - Create/replace `packages/server/src/games/battle-bots/types.ts` with `BattleBotsPick`, `CombatRobot`, `TickEntry`, `AttackEvent`, `TickLogPayload`, `BattleBotsGameState`, `BattlePairing`, `FFABracketState` interfaces
    - Add `WeaponType`, `HeadType`, `BodyType` union types
    - Add `RobotVisual` interface for visual config
    - _Requirements: 1.1, 14.1, 14.2_

  - [x] 1.2 Create PartDefinitions module
    - Create `packages/server/src/games/battle-bots/PartDefinitions.ts`
    - Implement `StarContribution` and `PartDefinition` interfaces
    - Define `WEAPON_PARTS`, `HEAD_PARTS`, `BODY_PARTS` constant records with exact star mappings from design
    - Implement `computeStars(weapon, head, body)` function
    - Implement `validateBuild(weapon, head, body)` function that checks sum=9 and each stat in [1,7]
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1–2.11_

  - [x] 1.3 Create ModifierTable module
    - Create `packages/server/src/games/battle-bots/ModifierTable.ts`
    - Define `ModifierEntry` interface and `MODIFIER_TABLE` record for star counts 1–7
    - Define `BASE_HP`, `BASE_MAX_HIT`, `BASE_ACCURACY` constants
    - Implement `deriveCombatStats(stars)` function: maxHit (floor, min 1), accuracy (floor, cap 90), tickInterval, hp
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 12.1, 12.2, 12.4, 12.5_

  - [x] 1.4 Update constants and settings schema
    - Update `packages/server/src/games/battle-bots/constants.ts` to remove old settings (BOT_HP, DAMAGE_MIN, DAMAGE_MAX, ACCURACY)
    - Add `TICK_LIMIT: 1000` and `VS_SCREEN_DURATION_MS: 4000` constants
    - Update `BATTLE_BOTS_SETTINGS_SCHEMA` to contain exactly 3 fields: PREP_TIMER_MS, CHIPS_MULTIPLIER, GAME_SPEED
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 1.5 Write property tests for star budget and part definitions
    - **Property 1: Star Budget Invariant** — For any valid (weapon, head, body) combination, total stars = 9
    - **Property 2: Part Constraint Invariant** — Each part sums to 3 stars, respects type minimums
    - **Property 3: Stat Range Invariant** — Each individual stat in [1, 7] for all builds
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

  - [ ]* 1.6 Write property test for stat derivation
    - **Property 4: Stat Derivation Correctness** — deriveCombatStats produces correct values for any valid star distribution
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 5.5, 12.2, 12.4**

  - [ ]* 1.7 Write unit tests for part definitions and modifier table
    - Verify each of the 11 concrete part→star mappings from Requirement 2
    - Verify modifier table entries exist for star counts 1–7 with valid values
    - Verify settings schema has exactly 3 fields and old fields are removed
    - _Requirements: 2.1–2.11, 3.1, 3.2, 11.1–11.6_

- [x] 2. Implement BattleEngine simulation
  - [x] 2.1 Create BattleEngine with simulate1v1
    - Create `packages/server/src/games/battle-bots/simulation/BattleEngine.ts`
    - Implement the tick-based simulation loop: snapshot HP → determine attackers → roll accuracy/damage → sum damage → guaranteed survivor check → finalize HP → check termination
    - Implement `simulate1v1(robot1, robot2): BattleResult`
    - Handle 1000-tick timeout (highest HP wins)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1_

  - [x] 2.2 Add simulateFFA to BattleEngine
    - Implement `simulateFFA(robots: CombatRobot[]): FFAResult`
    - Random target selection per attacker (uniform from living opponents, excluding self)
    - Same snapshot model and guaranteed survivor rule as 1v1
    - Track elimination order with tick numbers
    - Handle 1000-tick timeout for FFA
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 17.1, 17.2, 17.3_

  - [ ]* 2.3 Write property tests for attack scheduling and snapshot resolution
    - **Property 5: Attack Scheduling Correctness** — Robot attacks iff tick % tickInterval === 0 AND HP > 0
    - **Property 6: Snapshot Resolution** — All targetHpAfter values computed against pre-tick HP
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 2.4 Write property tests for hit/damage bounds and guaranteed survivor
    - **Property 7: Hit Determination and Damage Bounds** — Hit → damage in [1, maxHit]; miss → damage = 0; targetHpAfter ≥ 0
    - **Property 8: Guaranteed Survivor** — Never all robots eliminated on same tick
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.6, 6.1, 6.2, 6.3, 6.5, 12.2**

  - [ ]* 2.5 Write property tests for FFA target validity and tick sequence
    - **Property 9: FFA Target Validity** — Target is always a living non-self robot
    - **Property 11: Tick Sequence Integrity** — Tick numbers are contiguous starting at 1
    - **Validates: Requirements 8.1, 8.3, 14.1**

  - [ ]* 2.6 Write property tests for tick log and FFA ranking
    - **Property 12: Tick Log Serialization Round Trip** — JSON serialize/deserialize produces equal structure
    - **Property 13: Elimination Event Consistency** — Each eliminated robot appears in exactly one tick's eliminations
    - **Property 14: FFA Ranking Correctness** — Later elimination = higher rank, same-tick = same rank
    - **Property 16: Tick Entry Completeness** — Each TickEntry has valid tick number and complete AttackEvent fields
    - **Validates: Requirements 14.1, 14.2, 14.4, 14.5, 17.1, 17.2, 17.3**

  - [ ]* 2.7 Write unit tests for BattleEngine edge cases
    - Test 1000-tick timeout produces winner (highest HP)
    - Test guaranteed survivor with forced mutual-KO scenario
    - Test simulation with 2 robots of identical stats (mirror match)
    - Test FFA with 3+ robots eliminating each other
    - _Requirements: 4.7, 6.1, 6.4, 8.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update BattleBotsPlugin server logic
  - [x] 4.1 Update BattleBotsPlugin prep phase handling
    - Modify `validatePick` to accept `{ weapon, head, body }` structure
    - Update pick handling to call `validateBuild()`, assign robot name via existing name generator, compute stars, derive combat stats
    - Update auto-lock on timer expiry to select random parts server-side
    - Implement Bot_Persona auto-pick using server-side randomizer
    - Store builds as `CombatRobot` instances in game state
    - _Requirements: 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 15.1, 15.2, 15.3, 15.4_

  - [x] 4.2 Update BattleBotsPlugin resolve round logic
    - Update Round 2 resolution to construct CombatRobots and call `simulate1v1()`
    - Store tick log in `BattlePairing` state
    - Broadcast complete `TickLogPayload` (robots metadata + tickLog + gameSpeed) to clients at RESOLVING phase start
    - Update Round 3 resolution to call `simulateFFA()` for winners and losers brackets
    - Handle reconnect: re-send TickLog + current tick index
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7, 17.4_

  - [x] 4.3 Update FFA ranking integration
    - Ensure `simulateFFA` results feed into existing `RankingEngine.ts` correctly
    - Winners bracket ranks map to positions 1–N/2, losers bracket to N/2+1–N
    - **Property 15: Bracket Position Mapping** validation
    - _Requirements: 17.4, 17.5_

  - [ ]* 4.4 Write property test for bracket position mapping
    - **Property 15: Bracket Position Mapping** — Winners bracket entries rank ≤ N/2, losers bracket entries rank > N/2
    - **Validates: Requirements 17.4**

  - [ ]* 4.5 Write unit tests for plugin prep phase and resolve round
    - Test validatePick with valid and invalid picks
    - Test auto-lock assigns valid random build
    - Test Bot_Persona creation and immediate lock-in
    - Test TickLogPayload structure on broadcast
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 15.1, 15.3_

- [x] 5. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement client-side prep phase UI
  - [x] 6.1 Create PartCarousel component
    - Create `packages/client/src/games/battle-bots/PrepPhase/PartCarousel.tsx`
    - Implement three carousel rows (weapon, head, body) with left/right arrow navigation
    - Implement wrap-around (last→first, first→last)
    - Default selections: first option in each slot (drill, square, square)
    - Show weapon name using existing chip UI style; head/body shown as visual changes only
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 6.2 Add star display and robot preview to PartCarousel
    - Create `packages/client/src/games/battle-bots/PrepPhase/StarDisplay.tsx` showing ⚔️ Damage, 🎯 Accuracy, ⚡ Speed totals
    - Create `packages/client/src/games/battle-bots/PrepPhase/RobotPreview.tsx` using existing RobotParts/CompositeRobot components
    - Update preview and star totals within 100ms on any part change
    - _Requirements: 9.3_

  - [x] 6.3 Implement Lock In, Randomize, and timer
    - Add "Randomize" button: selects random option per slot, updates preview without server submission
    - Add "Lock In" button: submits `{ weapon, head, body }` to server, disables all controls
    - Handle lock-in failure: re-enable controls, show error toast
    - Handle timer expiry: auto-submit current configuration
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

  - [ ]* 6.4 Write property test for carousel index wrapping
    - **Property 10: Carousel Index Wrapping** — Right produces (I+1)%N, left produces (I-1+N)%N
    - **Validates: Requirements 9.2**

  - [ ]* 6.5 Write unit tests for PartCarousel
    - Test navigation wraps correctly for each slot
    - Test randomize selects valid options
    - Test lock-in disables controls
    - Test auto-submit on timer expiry
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 9.8_

- [x] 7. Implement client-side battle replay
  - [x] 7.1 Create ReplayController
    - Create `packages/client/src/games/battle-bots/BattlePhase/ReplayController.ts`
    - Implement `start(tickLog, gameSpeed)`, `getCurrentState()`, `onTick(callback)`, `jumpToTick(index)`
    - Use `setInterval` at gameSpeed ms to advance through ticks
    - Track `currentTickIndex`, `isPlaying`, `isComplete` state
    - Handle reconnect resume via `jumpToTick`
    - _Requirements: 7.3, 7.6_

  - [x] 7.2 Create VsScreen component
    - Create `packages/client/src/games/battle-bots/BattlePhase/VsScreen.tsx`
    - Display each robot's composed SVG, name, owner name, and star values
    - Highlight current player's robot with callout box outline
    - Support "1v1" (VS layout) and "ffa" (bracket grid) modes
    - Auto-transition to replay after ~4 seconds (VS_SCREEN_DURATION_MS)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 7.3 Update BattleArena for replay-driven rendering
    - Update existing `BattleArena` component to accept `TickLogPayload` data
    - Render composed robot SVGs using existing RobotParts system
    - Show HP bars updating per tick from ReplayController
    - Display star values beneath each robot
    - Show robot name + owner name as "RobotName - PlayerName"
    - Show eliminated robots greyed out with "defeated" indicator
    - Display end-of-battle state with winner after final tick
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 7.5_

  - [x] 7.4 Create FFAArena component
    - Create `packages/client/src/games/battle-bots/FFAPhase/FFAArena.tsx`
    - Same tick-event-driven rendering as BattleArena but for multiple robots
    - Use ReplayController for FFA tick playback
    - Display elimination order and rankings at battle end
    - _Requirements: 13.6, 17.1_

  - [ ]* 7.5 Write unit tests for ReplayController
    - Test tick advancement at correct interval
    - Test jumpToTick for reconnect scenarios
    - Test isComplete after final tick
    - _Requirements: 7.3, 7.6_

- [x] 8. Wire everything together and integration
  - [x] 8.1 Connect BattleBotsView to new components
    - Update `BattleBotsView.tsx` to route to `PartCarousel` during PICKING phase (Round 1)
    - Route to `VsScreen` → `BattleArena` during RESOLVING phase (Round 2)
    - Route to `VsScreen` → `FFAArena` during RESOLVING phase (Round 3)
    - Pass `TickLogPayload` from server broadcast to replay components
    - _Requirements: 7.2, 7.3, 13.6, 16.1_

  - [x] 8.2 Handle reconnect and edge cases
    - On reconnect during RESOLVING, receive re-sent TickLog + tick index
    - Resume replay from correct position via `jumpToTick`
    - Handle corrupt/missing TickLog with fallback "battle complete" state
    - Handle missing robot visual config with default fallback
    - _Requirements: 7.6, 7.7_

  - [ ]* 8.3 Write integration tests for full game flow
    - Test complete Prep → 1v1 → FFA → Rankings flow with 4 players
    - Test reconnect during replay receives correct TickLog
    - Test broadcast determinism (identical TickLog to all clients)
    - _Requirements: 7.1, 7.2, 7.6, 7.7_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (16 properties total)
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout; all code examples use TypeScript
- Base combat constants (BASE_MAX_HIT, BASE_ACCURACY) may need tuning via simulation to achieve 48–52% win rate band (Requirement 3.7, 3.9, 12.3, 12.6)
- Existing components (RobotParts, PairingEngine, RankingEngine, name generator) are reused where possible

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.5", "1.6", "1.7", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3"] },
    { "id": 7, "tasks": ["4.4", "4.5", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 9, "tasks": ["6.4", "6.5", "7.2", "7.3"] },
    { "id": 10, "tasks": ["7.4", "7.5"] },
    { "id": 11, "tasks": ["8.1"] },
    { "id": 12, "tasks": ["8.2"] },
    { "id": 13, "tasks": ["8.3"] }
  ]
}
```
