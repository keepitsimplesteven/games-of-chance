# Requirements Document

## Introduction

This spec defines a complete overhaul of the Battle Bots combat system. The 3-round game structure (Prep → 1v1 → FFA) and round lifecycle integration remain unchanged. What changes:

1. **Robot building** — replaces the "pick from 3 random options" model with a composable part system (weapon + head + body) where each part contributes star points to 3 stats (Damage, Accuracy, Speed)
2. **Stat system** — replaces flat tunable settings (HP, accuracy%, damage range) with a star budget system (9 stars across 3 stats) mapped through a modifier table to combat values
3. **Combat engine** — replaces the per-tick accuracy/damage roll model with a tick-interval-based attack scheduler, simultaneous resolution (snapshot model), and a guaranteed survivor rule instead of tiebreakers
4. **Prep phase UI** — replaces the 3-option card picker with a carousel-based part selector showing live star totals
5. **Client replay** — replaces real-time tick emission with pre-computed simulation + configurable-speed playback
6. **Settings** — removes per-stat tuning fields (BOT_HP, DAMAGE_MIN, DAMAGE_MAX, ACCURACY) and adds GAME_SPEED

This is a breaking change to the combat system. The existing BattleEngine, prep phase UI, and settings schema will be replaced.

**Future consideration:** Accuracy above 100% may later introduce critical hit chance, but this is NOT in scope for this version.

## Glossary

- **Combat_Engine**: The server-side module that pre-computes a full tick-based battle simulation synchronously at round start, producing a complete tick log
- **Star_Budget**: The fixed total of 9 stars distributed across Damage, Accuracy, and Speed stats for every robot, contributed by its 3 parts (weapon, head, body)
- **Part**: One of three composable robot components (Weapon, Head, Body) that each contribute exactly 3 stars to the Star_Budget
- **Weapon_Part**: A part that selects the robot's weapon visual and contributes stars with a minimum guarantee of 1 Damage star; options are Drill, Blaster, Bazooka
- **Head_Part**: A part that selects the robot's head visual and contributes stars with a minimum guarantee of 1 Accuracy star; options are Square, Rounded, Triangular, Hexagonal
- **Body_Part**: A part that selects the robot's body visual and contributes stars with a minimum guarantee of 1 Speed star; options are Square, Rounded, Triangular, Hexagonal
- **Damage_Stat**: A derived combat value controlling the robot's maximum hit damage, calculated as base_max_hit × damage_modifier for the robot's Damage star count
- **Accuracy_Stat**: A derived combat value controlling the robot's hit chance percentage, calculated as base_accuracy × accuracy_modifier for the robot's Accuracy star count; hard-capped at 90%
- **Speed_Stat**: A derived combat value controlling how frequently the robot attacks, expressed as a tick interval (ticks between attacks); lower tick interval = more frequent attacks
- **Modifier_Table**: A server-side constant mapping star counts (1–7) to multipliers for Damage, Accuracy, and tick intervals for Speed
- **Tick_Interval**: The number of ticks between a robot's attacks, determined by its Speed star count via the Modifier_Table; a robot attacks when `current_tick % tick_interval == 0`
- **Tick**: A discrete simulation step within the Combat_Engine; all attacks scheduled for a tick resolve simultaneously using snapshot HP values
- **Snapshot_Model**: The simultaneous resolution rule where all attacks within a single tick are resolved against HP values captured at the start of that tick, before any damage is applied
- **Guaranteed_Survivor_Rule**: The rule ensuring at least one robot survives every battle: if all remaining robots would be eliminated on the same tick, one random robot takes no damage that tick
- **Tick_Log**: The complete ordered list of tick events produced by a pre-computed simulation, stored server-side and streamed to clients for replay
- **Game_Speed**: A host-configurable setting controlling the playback interval (in milliseconds) at which tick events are streamed to clients; range 50–250ms, default 100ms
- **Carousel_UI**: The prep phase interface where players scroll through part options using left/right arrows for each of the 3 part slots (weapon, head, body)
- **Lock_In**: The action of submitting a final robot configuration to the server, after which no further changes are allowed for that player
- **Bot_Persona**: A system-generated participant added for odd player counts, which uses the server-side randomizer to select parts and immediately locks in
- **Build**: A specific combination of one Weapon_Part, one Head_Part, and one Body_Part; there are 48 possible builds (3 × 4 × 4)

## Requirements

### Requirement 1: Star Budget System

**User Story:** As a player, I want my robot's stats to be determined by the parts I choose, so that robot building involves meaningful tradeoffs between damage, accuracy, and speed.

#### Acceptance Criteria

1. THE Combat_Engine SHALL assign every robot exactly 9 stars distributed across Damage, Accuracy, and Speed stats, where each stat value is a whole number
2. THE Combat_Engine SHALL derive a robot's star distribution by summing the star contributions of its three parts (Weapon_Part + Head_Part + Body_Part)
3. THE Combat_Engine SHALL enforce that each Part contributes exactly 3 stars total across the three stats, with each individual stat contribution being a whole number between 0 and 3 inclusive
4. THE Combat_Engine SHALL enforce that every Weapon_Part contributes a minimum of 1 Damage star
5. THE Combat_Engine SHALL enforce that every Head_Part contributes a minimum of 1 Accuracy star
6. THE Combat_Engine SHALL enforce that every Body_Part contributes a minimum of 1 Speed star
7. THE Combat_Engine SHALL constrain each individual stat to a range of 1 to 7 stars for any valid Build
8. IF a Build's total star count does not equal 9 or any individual stat falls outside the 1 to 7 range, THEN THE Combat_Engine SHALL reject the Build and indicate which constraint was violated

### Requirement 2: Part Definitions and Star Mapping

**User Story:** As a developer, I want a fixed mapping from part shapes to star contributions, so that the 48 possible builds produce deterministic and balanced stat distributions.

#### Acceptance Criteria

1. THE Combat_Engine SHALL map Weapon_Part "Drill" to star contributions of 1 Damage, 0 Accuracy, 2 Speed
2. THE Combat_Engine SHALL map Weapon_Part "Blaster" to star contributions of 1 Damage, 2 Accuracy, 0 Speed
3. THE Combat_Engine SHALL map Weapon_Part "Bazooka" to star contributions of 3 Damage, 0 Accuracy, 0 Speed
4. THE Combat_Engine SHALL map Head_Part "Square" to star contributions of 1 Damage, 1 Accuracy, 1 Speed
5. THE Combat_Engine SHALL map Head_Part "Rounded" to star contributions of 0 Damage, 1 Accuracy, 2 Speed
6. THE Combat_Engine SHALL map Head_Part "Triangular" to star contributions of 0 Damage, 3 Accuracy, 0 Speed
7. THE Combat_Engine SHALL map Head_Part "Hexagonal" to star contributions of 2 Damage, 1 Accuracy, 0 Speed
8. THE Combat_Engine SHALL map Body_Part "Square" to star contributions of 1 Damage, 1 Accuracy, 1 Speed
9. THE Combat_Engine SHALL map Body_Part "Rounded" to star contributions of 0 Damage, 0 Accuracy, 3 Speed
10. THE Combat_Engine SHALL map Body_Part "Triangular" to star contributions of 0 Damage, 2 Accuracy, 1 Speed
11. THE Combat_Engine SHALL map Body_Part "Hexagonal" to star contributions of 2 Damage, 0 Accuracy, 1 Speed

### Requirement 3: Modifier Table

**User Story:** As a developer, I want a centralized modifier table that converts star counts into combat multipliers, so that balance tuning can be adjusted in one place via simulation.

#### Acceptance Criteria

1. THE Combat_Engine SHALL store the Modifier_Table as a server-side constant not exposed in the settings UI
2. THE Modifier_Table SHALL define a damage multiplier (decimal, minimum 0.1), an accuracy multiplier (decimal, minimum 0.1), and a ticks-per-attack value (positive integer, minimum 1) for each star count from 1 through 7
3. WHEN computing a robot's maximum hit damage, THE Combat_Engine SHALL multiply base_max_hit by the damage multiplier for the robot's Damage star count, rounding down to produce an integer
4. WHEN computing a robot's hit chance, THE Combat_Engine SHALL multiply base_accuracy by the accuracy multiplier for the robot's Accuracy star count, capping the result at 90
5. WHEN computing a robot's attack frequency, THE Combat_Engine SHALL use the ticks-per-attack value for the robot's Speed star count as the Tick_Interval
6. THE Combat_Engine SHALL use integer-only damage values, rounding down fractional results from modifier calculations, with a minimum effective max hit of 1
7. THE Modifier_Table SHALL use initial values that produce win rates between 48% and 52% for each of the 48 builds when simulated against a zero-variance control opponent (one that deals exact average DPS with no randomness) with a perfect 20-second time-to-kill
8. THE Modifier_Table damage multipliers at higher tiers SHALL include a calibrated overkill budget buff to offset wasted damage on killing blows, ensuring speed-focused builds do not gain a net DPS advantage over damage-focused builds
9. IF initial simulation results show any build with a win rate outside the 48–52% band, THEN the base constants (base_max_hit, base_accuracy, tick intervals) SHALL be revisited before finalizing the Modifier_Table values

### Requirement 4: Tick-Based Attack Scheduling

**User Story:** As a player, I want faster robots to attack more frequently than slower ones, so that investing in Speed provides a distinct visual play style without conferring a net statistical advantage.

#### Acceptance Criteria

1. THE Combat_Engine SHALL start the tick counter at 1 and increment by 1 each simulation step, scheduling a robot's attack on any tick where `current_tick % robot.tick_interval == 0`
2. THE Combat_Engine SHALL resolve all attacks scheduled for the same tick simultaneously using the Snapshot_Model
3. WHEN resolving attacks within a tick, THE Combat_Engine SHALL capture each robot's HP at the start of the tick and apply all damage against those snapshot values
4. WHEN a robot is scheduled to attack on a tick where that robot's snapshot HP is above 0, THE Combat_Engine SHALL allow the attack to resolve regardless of damage received that same tick
5. IF a robot's snapshot HP is 0 at the start of a tick, THEN THE Combat_Engine SHALL NOT schedule or resolve an attack for that robot on that tick
6. AFTER all attacks in a tick resolve, THE Combat_Engine SHALL apply the accumulated damage to produce updated HP values and eliminate any robot whose HP reaches 0 or below
7. IF the simulation reaches 1000 ticks without a winner, THEN THE Combat_Engine SHALL terminate the battle and select the robot with the highest remaining HP as the winner
8. THE stat system SHALL be balanced such that no single stat (Damage, Accuracy, or Speed) provides a net win-rate advantage over the others; all three stats SHALL affect only the visual pacing of combat while maintaining equivalent expected DPS

### Requirement 5: Attack Resolution

**User Story:** As a player, I want combat to involve both hit chance and variable damage, so that battles have exciting uncertainty on each attack.

#### Acceptance Criteria

1. WHEN a robot attacks, THE Combat_Engine SHALL generate an accuracy roll as a random integer from 1 to 100 (inclusive, uniform distribution)
2. WHEN the accuracy roll is less than or equal to the robot's final accuracy value, THE Combat_Engine SHALL register the attack as a hit
3. WHEN the accuracy roll is greater than the robot's final accuracy value, THE Combat_Engine SHALL register the attack as a miss and record 0 damage dealt to the target
4. WHEN an attack hits, THE Combat_Engine SHALL generate damage as a random integer from 1 to the robot's calculated maximum hit (inclusive, uniform distribution)
5. THE Combat_Engine SHALL cap a robot's final accuracy value at a maximum of 90, regardless of star configuration, so that every attack retains at least a 10% miss chance
6. WHEN an attack hits, THE Combat_Engine SHALL subtract the generated damage from the target robot's current HP, to a minimum of 0 HP

### Requirement 6: Guaranteed Survivor Rule

**User Story:** As a player, I want every battle to produce a clear winner without tiebreakers, so that results feel decisive and fair.

#### Acceptance Criteria

1. WHEN all robots with currentHp greater than 0 at the start of a tick would reach 0 HP after all attacks for that tick are resolved, THE Combat_Engine SHALL select one robot from those remaining with uniform random probability and prevent all damage to that robot for that tick, leaving it with its pre-tick HP value
2. THE Combat_Engine SHALL calculate all attack damage for a tick as a snapshot (determining hits and damage amounts for all robots before applying any HP reductions), then apply the Guaranteed_Survivor_Rule if the snapshot would eliminate all remaining robots, then finalize HP values
3. THE Combat_Engine SHALL apply the Guaranteed_Survivor_Rule identically in both 1v1 and FFA battles
4. THE Combat_Engine SHALL NOT implement any tiebreaker system, relying solely on the Guaranteed_Survivor_Rule to ensure a winner exists
5. IF only a subset of remaining robots would be eliminated on a tick (at least one robot would survive with HP greater than 0), THEN THE Combat_Engine SHALL NOT invoke the Guaranteed_Survivor_Rule for that tick

### Requirement 7: Pre-Computed Simulation and Client Delivery

**User Story:** As a player, I want to watch the battle play out smoothly and simultaneously with other players, so that combat feels cinematic and fair.

#### Acceptance Criteria

1. WHEN a battle round begins, THE Combat_Engine SHALL run the entire simulation synchronously and produce a complete Tick_Log before any events are sent to clients
2. THE Combat_Engine SHALL deliver the complete Tick_Log to all clients in a single broadcast at the start of the RESOLVING phase, rather than streaming individual ticks over time
3. THE client SHALL play back the Tick_Log locally at the rate defined by Game_Speed, advancing one tick per Game_Speed interval (default 100ms, configurable 50–250ms)
4. THE Tick_Log SHALL contain for each tick: the tick number, all attack events (attacker, target, hit/miss, damage dealt, HP after damage) for that tick
5. WHEN the client finishes playing back the final tick in the Tick_Log, THE client SHALL display an end-of-battle state indicating the winner
6. IF a client reconnects during the RESOLVING phase, THEN THE server SHALL re-send the complete Tick_Log and the current tick index so the client can resume playback from the correct position
7. ALL clients viewing the same battle SHALL receive a byte-identical Tick_Log payload, ensuring deterministic replay across all viewers

### Requirement 8: FFA Target Selection

**User Story:** As a player, I want FFA battles to feel chaotic with robots attacking random opponents, so that free-for-all rounds are unpredictable and exciting.

#### Acceptance Criteria

1. WHEN a robot attacks during an FFA tick, THE Combat_Engine SHALL select one random living target (uniform distribution) from the other robots in the same bracket, excluding itself
2. THE Combat_Engine SHALL perform target selection independently for each robot on each attack tick
3. THE Combat_Engine SHALL remove eliminated robots from the living target pool only after all attacks for the current tick have resolved
4. THE Combat_Engine SHALL apply the same simultaneous resolution (Snapshot_Model) and Guaranteed_Survivor_Rule in FFA as in 1v1
5. IF the FFA simulation reaches 1000 ticks without a single survivor, THEN THE Combat_Engine SHALL terminate and select the robot with the highest remaining HP as the winner

### Requirement 9: Prep Phase Carousel UI

**User Story:** As a player, I want to build my robot by scrolling through part options with immediate visual feedback, so that the building process is intuitive and fun.

#### Acceptance Criteria

1. WHEN Round 1 enters the PICKING phase, THE Carousel_UI SHALL display three part slots (Weapon, Head, Body) each with left/right navigation arrows, with the first option in each slot selected by default
2. THE Carousel_UI SHALL cycle through available options for each slot (3 weapons, 4 heads, 4 bodies) via the navigation arrows, wrapping from the last option back to the first and from the first back to the last
3. WHEN the player changes a part selection via the navigation arrows, THE Carousel_UI SHALL update the robot preview SVG and the star total display beneath it within 100ms, showing aggregate stars per stat (Damage, Accuracy, Speed) as the sum of star values from all three currently selected parts
4. THE Carousel_UI SHALL display only the weapon name using the existing chip UI style; head and body selections SHALL be shown as visual changes to the robot SVG only without text names
5. WHEN the player activates the "Randomize" button, THE Carousel_UI SHALL select a random option for each of the three slots and update the preview without submitting the configuration to the server
6. WHEN the player activates "Lock In", THE Carousel_UI SHALL submit the final part configuration to the server and disable the navigation arrows, "Randomize" button, and "Lock In" button for that player
7. IF the "Lock In" submission fails due to a network or server error, THEN THE Carousel_UI SHALL re-enable controls and display an error message indicating the submission was not received
8. IF the pick deadline expires before the player activates "Lock In", THEN THE Carousel_UI SHALL submit the currently displayed part configuration automatically and disable further part changes

### Requirement 10: Prep Phase Server Behavior

**User Story:** As a host, I want the prep phase to have a timer with automatic fallback, so that the game progresses even if a player is idle.

#### Acceptance Criteria

1. THE Battle_Bots_Plugin SHALL use simultaneous blind pick where all parts (3 Weapon_Parts, 4 Head_Parts, 4 Body_Parts) are always available to all players
2. THE Battle_Bots_Plugin SHALL transmit only the final locked-in Build to the server; no intermediate part selections SHALL be sent
3. WHEN the prep timer expires and a player has not locked in, THE Battle_Bots_Plugin SHALL select one random option from each part category (Weapon, Head, Body) with uniform probability server-side and auto-lock the resulting Build
4. WHEN an odd number of players are present at the start of the prep phase, THE Bot_Persona SHALL select parts using the server-side randomizer with uniform probability and lock in before the prep timer begins counting down
5. THE Battle_Bots_Plugin SHALL use a default prep timer of 60 seconds, configurable via the PREP_TIMER_MS setting with a minimum of 10 seconds, maximum of 300 seconds, and step of 5 seconds

### Requirement 11: Settings Schema Changes

**User Story:** As a host, I want simplified game settings focused on pacing rather than combat tuning, so that I can adjust the experience without breaking balance.

#### Acceptance Criteria

1. THE Battle_Bots_Plugin SHALL remove the following settings from the settings UI: BOT_HP, DAMAGE_MIN, DAMAGE_MAX, ACCURACY
2. THE Battle_Bots_Plugin SHALL retain the PREP_TIMER_MS setting with type "number", default value 60, minimum 10, maximum 300, and step 5, labeled "Prep timer (seconds)"
3. THE Battle_Bots_Plugin SHALL retain the CHIPS_MULTIPLIER setting with type "number", default value 10, minimum 1, maximum 100, and step 1, labeled "Chips multiplier"
4. THE Battle_Bots_Plugin SHALL add a GAME_SPEED setting with type "number", default value 100, minimum 50, maximum 250, and step 10, labeled "Game speed (ms per tick)"
5. THE Battle_Bots_Plugin SHALL store all combat tuning values (base HP, base accuracy, base max hit, Modifier_Table) as server-side constants not exposed in the settings UI
6. WHEN the settings UI is queried, THE Battle_Bots_Plugin SHALL return exactly three setting fields in the schema: PREP_TIMER_MS, CHIPS_MULTIPLIER, and GAME_SPEED

### Requirement 12: HP and Combat Tuning Constants

**User Story:** As a developer, I want all combat balance values centralized as server constants, so that simulation-based tuning is straightforward and isolated from player-facing settings.

#### Acceptance Criteria

1. THE Combat_Engine SHALL use a base HP constant of 100 for all robots, applied as the initial currentHp and maxHp values at the start of each battle
2. THE Combat_Engine SHALL use integer arithmetic (floor rounding for any multiplication or scaling) for all damage calculations, ensuring no fractional HP values are produced
3. THE Combat_Engine SHALL target a mean fight duration of approximately 200 ticks for a baseline 1v1 (3/3/3 star mirror match), yielding approximately 20 seconds at the default Game_Speed of 100ms per tick
4. THE Combat_Engine SHALL set base accuracy low enough that 7 Accuracy stars produces a hit chance capped at approximately 80–90% (hard cap at 90)
5. THE Combat_Engine SHALL set base max hit low enough that a robot at maximum Damage stars (7) cannot reduce an opponent from full HP to 0 in fewer than 10 attacks, assuming every attack hits
6. IF simulation results demonstrate that the 48–52% win rate target cannot be achieved with HP=100 due to integer rounding granularity, THEN base HP SHALL be increased (and base_max_hit scaled proportionally) until the target band is achievable

### Requirement 13: Client Battle Display (MVP)

**User Story:** As a player, I want to see composed robot SVGs with HP bars and stat information during battle replay, so that I can follow the action and understand my opponents' builds.

#### Acceptance Criteria

1. WHILE a battle replay is in progress, THE client SHALL display the composed robot SVGs for all combatants using the existing RobotParts component system (HeadType, BodyType, WeaponType), with each robot identifiable by its generated robot name and owner's player name (formatted as "Robot Name - Player Name")
2. WHILE a battle replay is in progress, THE client SHALL display an HP bar above each robot showing current HP as a percentage of max HP, updating as each tick event is played back at the Game_Speed interval
3. WHILE a battle replay is in progress, THE client SHALL display the star values (Damage, Accuracy, Speed) beneath each robot's SVG so players can see what configuration their opponents picked
4. WHEN a robot is eliminated (HP reaches 0), THE client SHALL visually indicate elimination by greying out the robot SVG and showing a "defeated" indicator
5. THE client SHALL defer fancy animations (hit splats, slide gestures, weapon-specific effects, FFA grid layout) to a follow-up spec
6. THE client SHALL display battle replay for both 1v1 (Round 2) and FFA (Round 3) using the same tick-event-driven rendering approach

### Requirement 15: Robot Naming

**User Story:** As a player, I want my robot to have a unique generated name when I lock in, so that robots feel like individual combatants rather than generic builds.

#### Acceptance Criteria

1. WHEN a player locks in their Build, THE Battle_Bots_Plugin SHALL assign the robot a random name using the existing random name generator
2. THE robot name SHALL be visually associated with the robot throughout combat, displayed alongside the owner's player name in the format "Robot Name - Player Name"
3. WHEN a Bot_Persona's Build is auto-locked, THE Battle_Bots_Plugin SHALL assign it a random name using the same name generator
4. THE robot name SHALL be included in the battle state sent to clients so it can be displayed during pre-combat screens and replay

### Requirement 16: Pre-Combat "VS" Screen

**User Story:** As a player, I want to see a dramatic reveal of all robots involved in the upcoming battle, so that I can assess my opponents before combat begins.

#### Acceptance Criteria

1. WHEN the RESOLVING phase begins for Round 2 or Round 3, THE client SHALL display a pre-combat screen showing all robots participating in that battle before replay playback starts
2. THE pre-combat screen SHALL display each robot's composed SVG, generated name, owner player name, and star values (Damage, Accuracy, Speed)
3. THE pre-combat screen SHALL highlight the current player's robot with a callout box outline, visually distinguishing it from opponents (similar to how the player is highlighted in the session leaderboard)
4. FOR Round 2 (1v1), THE pre-combat screen SHALL display both robots in a "VS" layout
5. FOR Round 3 (FFA), THE pre-combat screen SHALL display all robots in the player's bracket
6. THE pre-combat screen SHALL display for a fixed duration (e.g., 3–5 seconds) before automatically transitioning to replay playback

### Requirement 14: Tick Event Data Structure

**User Story:** As a developer, I want tick events to carry enough data for the client to render battles without additional server queries, so that replay is self-contained.

#### Acceptance Criteria

1. THE Tick_Log for a battle SHALL consist of an ordered array of tick entries, where each entry includes a tick number (integer starting at 1, incrementing by 1 with no gaps) and an array of attack events listed in resolution order
2. THE attack event SHALL include: attacker identifier (string), target identifier (string), hit or miss result (boolean), damage dealt (integer, 0 if miss), and target HP after damage (integer, minimum 0)
3. THE Tick_Log SHALL be produced once during pre-computation and SHALL NOT be modified after production; all clients viewing that battle SHALL receive an identical serialized representation
4. FOR ALL valid Tick_Logs produced by the Combat_Engine, serializing then deserializing the Tick_Log SHALL produce an equivalent data structure (round-trip property)
5. THE Tick_Log SHALL also include elimination events indicating which robots were eliminated on each tick and on which tick number they were eliminated, for use in FFA ranking

### Requirement 17: FFA Ranking by Survival Duration

**User Story:** As a player, I want my FFA ranking to be determined by how long my robot survived, so that lasting longer in combat is directly rewarded.

#### Acceptance Criteria

1. THE Combat_Engine SHALL rank FFA participants by the tick number on which they were eliminated, where later elimination equals higher rank
2. THE last surviving robot in a bracket SHALL receive rank 1 within that bracket
3. WHEN multiple robots are eliminated on the same tick, THE Combat_Engine SHALL assign them the same rank (tied elimination)
4. THE Winners_Bracket rankings SHALL map to overall positions 1 through N/2, and the Losers_Bracket rankings SHALL map to positions N/2+1 through N (where N is total participants)
5. THE ranking logic SHALL remain consistent with the existing implementation in RankingEngine.ts
