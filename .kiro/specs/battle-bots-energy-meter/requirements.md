# Requirements Document

## Introduction

This feature replaces the current discrete "ticks per attack" speed system in Battle Bots with a continuous energy meter mechanic. Each bot accumulates energy per tick based on its speed star rating. When energy reaches the 100-unit threshold, the bot executes an attack, and overflow energy carries into the next cycle. This eliminates the discrete jumps between speed tiers and enables smooth, fractional attack scaling. The feature also introduces a visible energy meter UI element and replaces the current slide-based attack animation with a projectile-based approach.

## Glossary

- **Energy_Meter**: A numeric accumulator (0–100 range per cycle) that tracks a bot's readiness to attack. Resets on attack with overflow preserved.
- **Attack_Energy_Per_Tick**: The amount of energy a bot gains each tick, determined by its speed star rating via the Modifier_Table.
- **Overflow_Energy**: The amount of energy exceeding 100 after an attack trigger. Carried forward as the starting energy for the next accumulation cycle.
- **Modifier_Table**: Server-side lookup table mapping star ratings (1–7) to combat multipliers including Attack_Energy_Per_Tick values.
- **Battle_Engine**: Server-side simulation engine that processes each tick of combat, determining attacks, damage, and eliminations.
- **Replay_Arena**: Client-side component that renders the battle replay including robot visuals, HP bars, and animations.
- **Animation_Layer**: Client-side overlay component that coordinates visual effects (slides, hit effects, damage numbers) during battle replay.
- **Projectile_Animation**: A visual effect where an element travels from the attacker toward the target to indicate an attack action.
- **Energy_Bar**: A UI element displayed on each bot's fighter card showing the current energy accumulation progress toward the next attack.
- **Combat_Robot**: The server-side data structure representing a robot's complete combat-ready state during simulation.

## Requirements

### Requirement 1: Energy Accumulation per Tick

**User Story:** As a game designer, I want bots to accumulate energy each tick based on their speed rating, so that attack frequency scales smoothly without discrete jumps between star tiers.

#### Acceptance Criteria

1. WHEN a tick is processed, THE Battle_Engine SHALL add the bot's Attack_Energy_Per_Tick value to the energy accumulator of each living bot.
2. WHEN a battle starts, THE Battle_Engine SHALL initialize each bot's energy accumulator to 0.
3. WHILE a bot's energy accumulator is below 100, THE Battle_Engine SHALL not trigger an attack for that bot on the current tick.
4. THE Modifier_Table SHALL define an Attack_Energy_Per_Tick value for each speed star rating from 1 to 7, where each value is a positive number greater than 0 and no greater than 100.
5. THE Battle_Engine SHALL maintain the energy accumulator as a numeric value preserving fractional precision across ticks without rounding.

### Requirement 2: Attack Trigger and Energy Reset

**User Story:** As a game designer, I want a bot to attack when its energy reaches 100, so that attack timing emerges naturally from the energy accumulation rate.

#### Acceptance Criteria

1. WHEN a bot's energy accumulator reaches or exceeds 100 after accumulation, THE Battle_Engine SHALL trigger an attack for that bot on the current tick.
2. WHEN an attack is triggered, THE Battle_Engine SHALL subtract 100 from the bot's energy accumulator to preserve overflow energy for the next cycle.
3. WHEN an attack is triggered, THE Battle_Engine SHALL perform an accuracy roll by generating a uniform random integer from 1 to 100 inclusive, and SHALL register a hit if the roll is less than or equal to the bot's accuracy stat (capped at a maximum of 90), then SHALL perform a damage roll by generating a uniform random integer from 1 to the bot's maxHit inclusive and apply that damage to the target only if the accuracy roll registered a hit.
4. IF a bot's Attack_Energy_Per_Tick value is 100 or greater, THEN THE Battle_Engine SHALL trigger exactly one attack per tick for that bot and SHALL cap the post-subtraction energy accumulator at a maximum of 99 to prevent unbounded overflow accumulation.
5. IF the accuracy roll does not register a hit, THEN THE Battle_Engine SHALL record the attack as a miss, apply no damage to the target, and still subtract 100 from the attacking bot's energy accumulator.

### Requirement 3: Overflow Energy Preservation

**User Story:** As a game designer, I want overflow energy to carry into the next cycle, so that high-speed bots gain a smooth advantage rather than losing accumulated energy.

#### Acceptance Criteria

1. WHEN an attack is triggered for a bot with energy accumulator value E greater than or equal to 100, THE Battle_Engine SHALL set the bot's energy accumulator to (E minus 100), resulting in a non-negative overflow value that becomes the starting energy for the next tick's accumulation.
2. THE Battle_Engine SHALL carry the post-attack overflow energy value forward as the bot's energy accumulator starting value on the immediately following tick, without resetting or clamping the value between ticks.
3. WHEN a bot's energy accumulator reaches or exceeds 100 after accumulation on a given tick, THE Battle_Engine SHALL trigger exactly one attack for that bot on that tick regardless of how far the accumulator exceeds 100.
4. IF a bot is eliminated during a tick, THEN THE Battle_Engine SHALL discard that bot's energy accumulator state and exclude the bot from further energy accumulation on subsequent ticks.

### Requirement 4: Modifier Table Energy Values and Balance Tuning

**User Story:** As a game designer, I want energy-per-tick values mapped to star ratings and validated via simulation, so that all 48 build configurations remain competitively balanced within the target win-rate band.

#### Acceptance Criteria

1. THE Modifier_Table SHALL define an Attack_Energy_Per_Tick value for each speed star rating from 1 to 7, where each value is a positive number greater than 0 and values increase monotonically with star rating (higher star rating produces strictly higher Attack_Energy_Per_Tick).
2. THE Modifier_Table SHALL use initial values of 10.5, 15.0, 20.0, 25.0, 31.5, 37.0, and 44.2 for star ratings 1 through 7 respectively as tuning starting points, and SHALL preserve the existing damageMultiplier and accuracyMultiplier values unchanged.
3. WHEN a balance tuning script is executed, THE tuning script SHALL simulate all 48 build configurations against a reference bot defined as a 3-3-3 star distribution (damage 3, accuracy 3, speed 3) with deterministic combat rolls (accuracy always hits, damage always deals the arithmetic mean of 1 to maxHit each attack) to eliminate randomness from the baseline.
4. THE tuning script SHALL run a minimum of 10,000 simulated matches per build configuration to establish statistical confidence when verifying that each build achieves a win rate between 48% and 52% against the reference bot.
5. IF a build configuration falls outside the 48%–52% win-rate band, THEN THE tuning script SHALL report the build's star distribution and its observed win rate as a percentage for manual adjustment of Attack_Energy_Per_Tick values.

### Requirement 5: Interface Migration from ticksPerAttack to attackEnergyPerTick

**User Story:** As a developer, I want the ModifierEntry interface to use attackEnergyPerTick instead of ticksPerAttack, so that the data model reflects the new energy mechanic.

#### Acceptance Criteria

1. THE Modifier_Table SHALL define ModifierEntry with an attackEnergyPerTick field of type number replacing the ticksPerAttack field.
2. THE Combat_Robot type SHALL replace the tickInterval field with an energyPerTick field of type number.
3. THE Combat_Robot type SHALL include a currentEnergy field of type number initialized to 0 to store the current accumulator state.
4. THE deriveCombatStats function SHALL return energyPerTick derived from the speed star rating's attackEnergyPerTick value instead of tickInterval.
5. THE robotInstanceToCombatRobot legacy adapter SHALL map legacy RobotInstance objects to the new CombatRobot shape by assigning an energyPerTick value and setting currentEnergy to 0.

### Requirement 6: Battle Engine Energy-Based Attack Scheduling

**User Story:** As a developer, I want the BattleEngine to use energy accumulation instead of modulo-based tick checks, so that the simulation correctly implements the energy meter mechanic.

#### Acceptance Criteria

1. THE Battle_Engine SHALL determine attackers each tick by comparing each living bot's energy accumulator against the threshold of 100, replacing the `tick % tickInterval === 0` check, in both simulate1v1 and simulateFFA (including simulateFFAInternal).
2. WHEN processing a tick, THE Battle_Engine SHALL add each living bot's energyPerTick value to its energy accumulator before evaluating attack triggers, where "living" means the bot's snapshot HP at tick start is greater than 0.
3. WHEN multiple bots reach the attack threshold on the same tick, THE Battle_Engine SHALL process all triggered attacks within that tick using the existing snapshot-based damage model, subtracting 100 from each triggered bot's energy accumulator to preserve overflow.
4. THE Battle_Engine SHALL record the energy state of each living bot after each tick as an energyStates record in the TickEntry, mapping each bot's ownerId to their energy accumulator value at the end of the tick.
5. IF a bot is eliminated (HP reaches 0) during a tick, THEN THE Battle_Engine SHALL not accumulate energy for that bot on subsequent ticks.

### Requirement 7: Energy Bar UI Display

**User Story:** As a player, I want to see an energy meter on each bot during battle replay, so that I can anticipate when bots will attack next.

#### Acceptance Criteria

1. THE Replay_Arena SHALL display an Energy_Bar on each bot's fighter card below the HP bar, within the same max-w-[120px] lg:max-w-[160px] container used by the HP bar.
2. THE Energy_Bar SHALL render as a horizontal filled bar where the filled width equals (current energy / 100) * container width, representing progress toward the attack threshold.
3. WHEN a tick is replayed, THE Energy_Bar SHALL update its filled width to reflect the bot's energy accumulator value from the energyStates record for that tick, using a CSS transition duration matching the game speed interval.
4. WHEN a bot is eliminated, THE Energy_Bar SHALL stop updating and apply the same opacity-50 and grayscale styling used on eliminated bot elements.
5. IF the energyStates record for the current tick does not contain an entry for a bot, THEN THE Energy_Bar SHALL retain the last known energy value for that bot.
6. WHEN a bot's energy resets after an attack (overflow energy carried forward), THE Energy_Bar SHALL display the post-reset overflow value for that tick rather than 100.

### Requirement 8: Projectile Attack Animation

**User Story:** As a player, I want to see a projectile visual cue when an attack occurs, so that attacks are visually clear and satisfying.

#### Acceptance Criteria

1. WHEN an attack is triggered during replay, THE Animation_Layer SHALL render a Projectile_Animation that departs from the horizontal center-right edge of the attacker's robot SVG bounds in 1v1 mode, or from the bottom edge in FFA mode.
2. WHEN the outgoing Projectile_Animation is rendered, THE Animation_Layer SHALL animate it moving away from the attacker (rightward in 1v1, downward in FFA) until it exits the attacker's bounding area, completing the exit phase within 30% of the current gameSpeed duration.
3. WHEN the attacker's projectile exit phase completes, THE Animation_Layer SHALL wait a delay of 20% of the current gameSpeed duration, then render a separate incoming projectile entering the target's robot visual area from a distance equal to 150% of the target's SVG width to the left of the target in 1v1 mode, or from above at 150% of the target's SVG height in FFA mode.
4. WHEN the incoming projectile is rendered, THE Animation_Layer SHALL animate it traveling from its entry point to the randomized hit location (as computed by the existing HitEffectEngine position logic) on the target's robot SVG area, completing the travel phase within 50% of the current gameSpeed duration.
5. WHEN the incoming projectile reaches the hit location, THE Animation_Layer SHALL trigger the existing hit effect and damage number at the impact location.
6. THE Animation_Layer SHALL remove the current slide-based twitching animation (SlideEngine) and replace it with the Projectile_Animation for all attack events.
7. THE Animation_Layer SHALL complete the full projectile sequence (exit phase + delay + travel phase) within the current gameSpeed duration so that no projectile animation overlaps with the next tick's effects.
8. IF the gameSpeed is below 150ms, THEN THE Animation_Layer SHALL apply the existing fast-speed clamping factor (0.9) to each phase duration proportionally.

### Requirement 9: Tick Log Energy State for Client Replay

**User Story:** As a developer, I want the tick log to include energy state data, so that the client can accurately render energy meters during replay.

#### Acceptance Criteria

1. THE Battle_Engine SHALL include an energyStates record in each TickEntry, mapping each bot's ownerId that has HP greater than 0 at the end of the tick to their energy accumulator value (a number from 0 up to but not including 100) recorded after energy accumulation and any attack reset for that tick.
2. THE Battle_Engine SHALL omit eliminated bots (HP equal to 0) from the energyStates record for the tick in which they are eliminated and all subsequent ticks.
3. WHEN a tick is replayed, THE Replay_Arena SHALL set each bot's Energy_Bar fill percentage to the value from the energyStates field of that TickEntry divided by 100.
4. WHEN replaying from a reconnect position, THE Replay_Arena SHALL read the energyStates field from the TickEntry at the reconnect tick index to initialize Energy_Bar display state without iterating prior ticks.

### Requirement 10: Backward Compatibility with Existing Systems

**User Story:** As a developer, I want the energy meter system to integrate with the existing Guaranteed Survivor Rule and FFA targeting, so that core battle mechanics remain unchanged.

#### Acceptance Criteria

1. THE Battle_Engine SHALL apply the Guaranteed Survivor Rule using the same snapshot-based damage model regardless of whether attacks were triggered by energy accumulation, selecting the survivor uniformly at random from all living bots that would reach zero HP on that tick.
2. THE Battle_Engine SHALL maintain random target selection in FFA mode for bots that trigger attacks via energy accumulation, choosing uniformly at random from all living bots excluding the attacker.
3. THE Battle_Engine SHALL support the existing 1000-tick limit termination rule with the energy-based attack scheduling, declaring as winner the bot with the highest HP at timeout, or selecting uniformly at random among bots tied for highest HP.
4. THE Battle_Engine SHALL maintain the existing accuracy roll (1–100 inclusive) and damage roll (1 to maxHit inclusive) mechanics for energy-triggered attacks.
5. WHEN a legacy RobotInstance is adapted to a Combat_Robot via the legacy adapter, THE Battle_Engine SHALL assign an energyPerTick value of 100 so that the legacy bot triggers exactly one attack per tick.
