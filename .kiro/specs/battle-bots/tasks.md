# Implementation Plan: Battle Bots Game Plugin

## Overview

Build the Battle Bots game plugin as a new game type in the existing GamePlugin architecture. The implementation proceeds from foundational types and constants, through the core battle simulation engine, to the plugin interface implementation, room lifecycle integration, and finally the client-side UI components. TypeScript throughout, using Vitest + fast-check for property-based testing of battle simulation invariants.

## Tasks

- [x] 1. Define types, constants, and shared infrastructure
  - [x] 1.1 Create Battle Bots type definitions
    - Create `packages/server/src/games/battle-bots/types.ts` with all type definitions: RobotTemplate, RobotInstance, BattleBotsPick, BattlePairing, TickEvent, AttackResult, FFABracket, BotPersona, BattleBotsGameState, FinalRanking, BattleTickUpdate, BattleHPSnapshot
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Create Battle Bots constants and settings schema
    - Create `packages/server/src/games/battle-bots/constants.ts` with BATTLE_BOTS constants object (PICK_WINDOW_MS, BOT_HP, ACCURACY, DAMAGE_MIN, DAMAGE_MAX, TICK_RATE_MS, ROUND_COUNT, ROBOT_OPTIONS_COUNT, CHIPS_MULTIPLIER)
    - Define BATTLE_BOTS_SETTINGS_SCHEMA with tuning fields for prep timer, HP, damage range, accuracy, and chips multiplier
    - _Requirements: 1.2, 1.3_

  - [x] 1.3 Add BATTLE_TICK to shared message types
    - Add `BattleTickUpdate` type to ServerMessage union in `packages/shared/src/types.ts`
    - Add "battle-bots" as a recognized game type where needed
    - _Requirements: 10.1, 10.2_

- [x] 2. Implement Battle Engine (core simulation)
  - [x] 2.1 Implement 1v1 battle simulation
    - Create `packages/server/src/games/battle-bots/simulation/BattleEngine.ts`
    - Implement `simulateBattle1v1(robot1, robot2, settings)` as a synchronous function that processes ticks: accuracy roll (1-100 vs accuracy %), damage roll (damageMin-damageMax), HP reduction, returns full tick log and winner/loser
    - Both robots attack each tick; robot1 resolves first (deterministic attack order)
    - Battle ends when exactly one robot reaches 0 HP
    - Implement simultaneous KO tiebreaker: when both robots reach 0 HP in same tick, perform up to 3 additional attack rolls; if one hits and other misses → hitter wins; if both hit → higher damage wins; if still tied after 3 rolls → 50/50 coin flip; winner's HP left untouched from before the KO tick
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 2.2 Implement FFA battle simulation
    - Implement `simulateFFA(participants, settings)` in BattleEngine.ts
    - Each tick: every living robot picks a random living target, rolls accuracy, deals damage
    - All attacks resolve before removing eliminated robots (overkill within a tick is valid)
    - Eliminated robots removed from target pool for next tick
    - Track elimination order; last standing is final survivor
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 2.3 Write property-based tests for battle engine
    - **Property: HP Monotonicity** — robot HP is monotonically non-increasing across ticks
    - **Property: Battle Termination** — every battle terminates (at least one robot reaches 0 HP)
    - **Property: Damage Bounds** — all damage values fall within [damageMin, damageMax]
    - **Property: Elimination Finality** — once eliminated, a robot never appears as attacker or target in subsequent ticks
    - **Property: Simultaneous KO Resolution** — when both robots reach 0 HP in the same tick, exactly one winner is always produced (never a tie result)
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 7.5**

- [x] 3. Implement Pairing and Ranking Engines
  - [x] 3.1 Implement pairing engine
    - Create `packages/server/src/games/battle-bots/simulation/PairingEngine.ts`
    - Implement `createPairings(participants, selectedRobots)` — randomly shuffles participant IDs and pairs them sequentially
    - Returns array of BattlePairing objects with robot instances assigned
    - _Requirements: 4.1, 4.2_

  - [x] 3.2 Implement ranking engine
    - Create `packages/server/src/games/battle-bots/simulation/RankingEngine.ts`
    - Implement `computeFinalRankings(winnersBracket, losersBracket, participants)` — maps elimination order to rank positions
    - Winners bracket: last standing = rank 1, second-to-last = rank 2, etc.
    - Losers bracket: rankings start from winnersCount + 1
    - Handle tied eliminations (same tick = same rank)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.3 Write property-based tests for pairing engine
    - **Property: Pairing Completeness** — every participant appears in exactly one pairing
    - **Property: Pairing Count** — pairings.length * 2 = participants.length
    - **Validates: Requirements 4.1, 4.2**

  - [x] 3.4 Write property-based tests for ranking engine
    - **Property: Ranking Completeness** — finalRankings.length = participants.length
    - **Property: Ranking Bounds** — all ranks between 1 and participants.length inclusive
    - **Property: Bracket Partition** — winners + losers participants = total participants
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 4. Implement Bot Persona system
  - [x] 4.1 Implement bot persona creation
    - Implement `ensureEvenParticipants(players)` — creates BotPersona when player count is odd or equals 1
    - Bot persona gets prefixed ID ("bot_") and generated display name ("MechBot-N")
    - _Requirements: 3.4, 3.5, 11.1_

  - [x] 4.2 Implement bot persona robot selection
    - Bot persona receives 3 robot options same as human players
    - Bot persona selects one at random automatically
    - _Requirements: 3.4, 11.2_

  - [x] 4.3 Write tests for bot persona exclusion from scoring
    - Verify bot persona IDs never appear in RoundScoreResult.deltas
    - Verify bot persona IDs never appear in GameLeaderboardEntry[]
    - _Requirements: 11.3, 11.4_

- [x] 5. Implement BattleBotsPlugin (GamePlugin interface)
  - [x] 5.1 Create plugin scaffold and registration
    - Create `packages/server/src/games/battle-bots/BattleBotsPlugin.ts` implementing GamePlugin interface with gameType "battle-bots", settingsSchema, and pickWindowMs
    - Create `packages/server/src/games/battle-bots/index.ts` with side-effect registration in GameRegistry
    - _Requirements: 1.1, 1.4_

  - [x] 5.2 Implement validatePick
    - Validate pick has robotTemplateId string field
    - Cross-reference against the player's assigned robot options stored in pluginState
    - _Requirements: 3.2_

  - [x] 5.3 Implement resolveRound (Round 1 — Prep Phase)
    - Finalize robot selections: use player's pick or randomly assign one of their 3 options if pick is missing
    - Store selectedRobots in pluginState for use in Round 2
    - Generate robot options for all participants at round start
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.4 Implement resolveRound (Round 2 — 1v1 Battles)
    - Call PairingEngine to create random matchups
    - Run all 1v1 battles via BattleEngine (concurrent within tick loop)
    - Categorize winners and losers for bracket assignment
    - Return battle results (winner/loser per pairing, tick logs)
    - _Requirements: 4.1, 5.6, 6.1, 6.2, 6.3_

  - [x] 5.5 Implement resolveRound (Round 3 — Free-For-All)
    - Create winners and losers FFA brackets from Round 2 results
    - Reset all robots to full HP
    - Run both FFA brackets via BattleEngine
    - Call RankingEngine to compute final rankings from elimination order
    - _Requirements: 7.1, 7.2, 7.8, 8.1, 8.2, 8.3, 8.5_

  - [x] 5.6 Implement scoreRound
    - Round 1: return empty deltas (no scoring in prep phase)
    - Round 2: return 1 for winners, 0 for losers (bot personas excluded)
    - Round 3: return ranking-based points (bot personas excluded)
    - _Requirements: 6.2, 9.1_

  - [x] 5.7 Implement computeGameLeaderboard
    - Map finalRankings to GameLeaderboardEntry array
    - Exclude bot personas from the leaderboard
    - Score value = totalParticipants - rank (for display ordering)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 6. Integrate with room lifecycle
  - [x] 6.1 Add pluginState to LiveRoomState
    - Add `pluginState: Record<string, unknown>` field to LiveRoomState in room.ts for multi-round plugin state persistence
    - Initialize to empty object on room start, clear on END_GAME
    - _Requirements: 12.1_

  - [x] 6.2 Add battle-bots plugin registration to room.ts
    - Add side-effect import of `./games/battle-bots/index` in room.ts
    - _Requirements: 1.1_

  - [x] 6.3 Implement tick emission during RESOLVING phase
    - During battle-bots RESOLVING phase, emit BATTLE_TICK messages via room.broadcast() at configured tick interval
    - Use setTimeout/setInterval loop with tickRateMs delay between emissions
    - Emit final STATE_SYNC with RESULT phase when all battles complete
    - _Requirements: 5.7, 7.9, 10.1, 10.2, 12.3_

  - [x] 6.4 Handle multi-round lifecycle differences
    - Round 1 uses standard PICKING phase with pickWindowMs timer
    - Rounds 2 and 3 skip PICKING and go directly to RESOLVING when host sends START_ROUND (no player input needed)
    - Ensure roundCount of 3 is fixed and not overridden by settings
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 7. Checkpoint — ensure all server-side tests pass
  - Run all property-based tests and unit tests for battle engine, pairing, ranking, and plugin
  - Verify full 3-round game simulation produces correct rankings

- [x] 8. Client — Prep Phase UI (Round 1)
  - [x] 8.1 Create RobotCard component
    - Create `packages/client/src/games/battle-bots/PrepPhase/RobotCard.tsx`
    - Display placeholder robot sprite, name, and stats (V1: visual differences only)
    - Selected state styling (highlight border, checkmark)
    - _Requirements: 3.1_

  - [x] 8.2 Create RobotSelector component
    - Create `packages/client/src/games/battle-bots/PrepPhase/RobotSelector.tsx`
    - Show 3 RobotCards side by side with selection interaction
    - Display countdown timer for prep phase
    - "Lock In" button that sends SUBMIT_PICK with robotTemplateId
    - Show confirmed state after pick is acknowledged
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 9. Client — Battle Phase UI (Round 2)
  - [x] 9.1 Create HPBar component
    - Create `packages/client/src/games/battle-bots/BattlePhase/HPBar.tsx`
    - Animated HP bar with smooth CSS transitions (250ms matching tick rate)
    - Color gradient from green (full) to red (low HP)
    - _Requirements: 10.2_

  - [x] 9.2 Create BattleArena component
    - Create `packages/client/src/games/battle-bots/BattlePhase/BattleArena.tsx`
    - Primary view showing player's own 1v1 battle with robot sprites and HP bars
    - Attack hit/miss visual feedback
    - _Requirements: 10.3_

  - [x] 9.3 Create BattleSidebar component
    - Create `packages/client/src/games/battle-bots/BattlePhase/BattleSidebar.tsx`
    - List of other active battles showing robot names and compact HP values
    - _Requirements: 10.3_

  - [x] 9.4 Handle BATTLE_TICK messages in client store
    - Parse BATTLE_TICK messages and update local HP state for all active battles
    - Drive HPBar animations from tick data
    - _Requirements: 10.1, 10.2_

- [x] 10. Client — FFA Phase UI (Round 3)
  - [x] 10.1 Create FFAArena component
    - Create `packages/client/src/games/battle-bots/FFAPhase/FFAArena.tsx`
    - Display all combatants in player's bracket with HP bars
    - Greyed-out styling with X overlay for eliminated robots
    - Winner animation for last standing
    - _Requirements: 10.4_

  - [x] 10.2 Create FFASidebar component
    - Create `packages/client/src/games/battle-bots/FFAPhase/FFASidebar.tsx`
    - Show other bracket's HP summary in compact list format
    - _Requirements: 10.4_

- [x] 11. Client — Results and game shell
  - [x] 11.1 Create FinalRankings component
    - Create `packages/client/src/games/battle-bots/Results/FinalRankings.tsx`
    - Final ranking table showing position, player name, bracket (winners/losers), and points awarded
    - _Requirements: 8.5_

  - [x] 11.2 Create BattleBotsView container
    - Create `packages/client/src/games/battle-bots/BattleBotsView.tsx`
    - Main container that switches between PrepPhase, BattlePhase, FFAPhase, and Results based on round number and phase
    - _Requirements: 12.1_

  - [x] 11.3 Add Battle Bots game tile to lobby
    - Add Battle Bots tile to GameTileGrid with placeholder cover art
    - Wire tile selection to SET_GAME_TYPE message with "battle-bots"
    - _Requirements: 1.1_

  - [x] 11.4 Create placeholder robot sprites
    - Create 3 visually distinct placeholder robot SVGs in `packages/client/src/games/battle-bots/assets/sprites/`
    - Simple geometric robot shapes with different colors/silhouettes
    - _Requirements: 2.3, 2.4_

- [x] 12. Integration testing
  - [x] 12.1 Full 3-round game flow test (4 players)
    - Verify correct phase transitions: LOBBY → PICKING → RESULT → RESOLVING → RESULT → RESOLVING → RESULT
    - Verify 2 pairings created, 2 winners + 2 losers, correct final ranking positions 1-4
    - _Requirements: 12.1, 12.4_

  - [x] 12.2 Single player game test
    - Verify bot persona created for solo player
    - Verify player is paired with bot persona in 1v1
    - Verify player gets 1st place (wins 1v1, alone in winners bracket)
    - _Requirements: 3.5, 11.1, 11.2_

  - [x] 12.3 Odd player count test (3 players)
    - Verify bot persona added to make 4 participants
    - Verify 2 pairings created with even count
    - Verify correct bracket sizes (2 winners, 2 losers)
    - _Requirements: 3.4, 4.1_

  - [x] 12.4 Bot persona scoring exclusion test
    - Verify bot personas excluded from RoundScoreResult.deltas
    - Verify bot personas excluded from GameLeaderboardEntry[]
    - Verify bot personas excluded from session leaderboard
    - _Requirements: 11.3, 11.4_

  - [x] 12.5 Settings integration test
    - Verify custom HP, accuracy, damage range values from settingsSchema are applied to robot instances
    - Verify prep timer uses configured pickWindowMs value
    - _Requirements: 1.2, 2.4, 12.2_

- [x] 13. Final checkpoint — all tests green
  - Run full test suite including property-based tests and integration tests
  - Verify no regressions in existing CoinToss plugin tests

## Notes

- The battle simulation runs synchronously on the server — tick emission is handled by an async wrapper that calls the sync simulation step-by-step with delays
- V1 uses a single robot template (identical stats); the data structure supports future expansion to multiple templates with individual tuning
- Tie-breaking within brackets is a future consideration — V1 uses shared ranks for simultaneous eliminations
- The BATTLE_TICK message type is specific to this plugin and does not affect other game plugins
- Bot personas are lightweight system entities distinct from the Simulation package's bot players — they exist only to fill pairings, not for testing/simulation purposes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "4.1", "4.2"] },
    { "id": 2, "tasks": ["2.3", "3.3", "3.4", "4.3"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "5.5", "5.6", "5.7"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8.1", "8.2", "9.1", "9.4"] },
    { "id": 8, "tasks": ["9.2", "9.3", "10.1", "10.2"] },
    { "id": 9, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 10, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5"] },
    { "id": 11, "tasks": ["13"] }
  ]
}
```
