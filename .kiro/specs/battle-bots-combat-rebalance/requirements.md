# Requirements Document

## Introduction

Combat rebalance for Battle Bots that tightens the fairness band from 45–55% to 49–51%, introduces a deterministic reference bot for simulation, caps speed at 50 energyPerTick, preserves the 90% accuracy cap, rebalances damage/accuracy multipliers, fixes the EnergyBar snap-back visual artifact, and updates the fairness simulator script to use the new methodology.

## Glossary

- **Combat_Engine**: The server-side tick-based combat simulation that processes energy accumulation, attack resolution, and damage application each tick
- **MODIFIER_TABLE**: The constant mapping star counts (1–7) to damageMultiplier, accuracyMultiplier, and attackEnergyPerTick values
- **Reference_Bot**: A deterministic bot used in the fairness simulator that deals exactly 1 damage per tick with guaranteed hits (no accuracy roll)
- **EnergyBar_Component**: The client-side React component that renders a bot's energy accumulation progress as a horizontal bar
- **Fairness_Simulator**: The tuneEnergyValues.ts script that runs simulated trials to validate build balance
- **Build_Configuration**: A valid star distribution where damage + accuracy + speed = 9, each value in [1, 7], yielding 28 valid configurations
- **Balance_Band**: The acceptable win-rate range (49%–51%) that every Build_Configuration must achieve against the Reference_Bot
- **Tick**: A single 100ms game loop iteration during which energy accumulates and attacks resolve
- **energyPerTick**: The amount of energy a bot gains each Tick, determined by speed stars via the MODIFIER_TABLE

## Requirements

### Requirement 1: Deterministic Reference Bot

**User Story:** As a developer, I want a deterministic reference bot in the fairness simulator, so that balance tuning isolates challenger build performance against a fixed, predictable baseline.

#### Acceptance Criteria

1. THE Reference_Bot SHALL deal exactly 1 damage per Tick to the opposing bot.
2. THE Reference_Bot SHALL hit on every Tick without performing an accuracy roll.
3. THE Reference_Bot SHALL have 100 HP (equal to BASE_HP).
4. THE Reference_Bot SHALL deal 10 damage per second against a 100 HP target at 100ms Ticks (1 damage × 10 Ticks per second).
5. WHEN the Fairness_Simulator runs a trial, THE Reference_Bot SHALL apply its 1 damage per Tick independently of the energy accumulation system.

### Requirement 2: Tight Balance Band

**User Story:** As a developer, I want all 28 valid build configurations to achieve 49–51% win rate against the reference bot, so that no build has a systematic advantage or disadvantage.

#### Acceptance Criteria

1. WHEN the Fairness_Simulator completes 10,000 trials for a Build_Configuration, THE Fairness_Simulator SHALL report the win rate for that configuration.
2. THE Fairness_Simulator SHALL flag any Build_Configuration with a win rate below 49% as out-of-band.
3. THE Fairness_Simulator SHALL flag any Build_Configuration with a win rate above 51% as out-of-band.
4. THE MODIFIER_TABLE SHALL contain damageMultiplier, accuracyMultiplier, and attackEnergyPerTick values tuned so that all 28 Build_Configurations achieve win rates within the 49%–51% Balance_Band.
5. THE Fairness_Simulator SHALL run exactly 10,000 trials per Build_Configuration.

### Requirement 3: Accuracy Cap at 90

**User Story:** As a developer, I want the accuracy cap preserved at 90, so that even maximum accuracy investment retains a 10% miss chance and maintains combat variance.

#### Acceptance Criteria

1. THE Combat_Engine SHALL compute accuracy as min(floor(56 × accuracyMultiplier), 90).
2. WHEN a Build_Configuration has 7 accuracy stars, THE Combat_Engine SHALL produce a final accuracy value of 90 or less.
3. THE MODIFIER_TABLE SHALL contain accuracyMultiplier values that do not allow any star level to produce a computed accuracy exceeding 90 after the floor operation.

### Requirement 4: Speed Cap at 50 energyPerTick

**User Story:** As a developer, I want the maximum attack speed capped at 50 energyPerTick (2 attacks per second), so that the fastest bots attack predictably and the energy curve spans a defined range.

#### Acceptance Criteria

1. THE MODIFIER_TABLE SHALL set attackEnergyPerTick for star 7 speed to exactly 50.
2. THE MODIFIER_TABLE SHALL set attackEnergyPerTick for star 1 speed to approximately 12 (resulting in an attack every 8–9 Ticks).
3. THE MODIFIER_TABLE SHALL define attackEnergyPerTick values that increase monotonically from star 1 through star 7.
4. WHEN a bot has 7 speed stars, THE Combat_Engine SHALL accumulate energy such that the bot attacks every 2 Ticks (100 energy threshold reached in 2 × 50 = 100).

### Requirement 5: Damage and Accuracy Multiplier Rebalance

**User Story:** As a developer, I want damageMultiplier and accuracyMultiplier values retuned to achieve the 49–51% balance band given the new speed range, so that all stats interact fairly.

#### Acceptance Criteria

1. THE MODIFIER_TABLE SHALL contain damageMultiplier values for stars 1–7 that, combined with BASE_MAX_HIT of 5, produce meaningful damage scaling.
2. THE MODIFIER_TABLE SHALL contain accuracyMultiplier values for stars 1–7 where the star 7 value produces floor(56 × accuracyMultiplier) that is at most 90.
3. WHEN the Fairness_Simulator runs with the updated MODIFIER_TABLE, THE Fairness_Simulator SHALL report all 28 Build_Configurations within the 49%–51% Balance_Band.
4. THE MODIFIER_TABLE SHALL define damageMultiplier values that increase monotonically from star 1 through star 7.
5. THE MODIFIER_TABLE SHALL define accuracyMultiplier values that increase monotonically from star 1 through star 7.

### Requirement 6: Energy Bar Snap-Back Fix

**User Story:** As a player, I want the energy bar to instantly reset when an attack fires, so that I do not see a visual "ping pong" artifact from the CSS transition animating the reset.

#### Acceptance Criteria

1. WHEN an attack fires and energy resets to 0 or overflow, THE EnergyBar_Component SHALL set the bar width to the new value without a CSS transition.
2. WHILE energy is increasing during the charging phase, THE EnergyBar_Component SHALL apply a linear CSS transition to the width property using the gameSpeed duration.
3. THE EnergyBar_Component SHALL distinguish between energy-increasing updates and energy-reset updates to apply the correct transition behavior.

### Requirement 7: Updated Fairness Simulator

**User Story:** As a developer, I want the fairness simulator updated to use the deterministic reference bot and tighter balance band, so that the tuning script validates the new balance targets accurately.

#### Acceptance Criteria

1. THE Fairness_Simulator SHALL use the Reference_Bot (1 damage per Tick, guaranteed hit) as the opponent for all challenger builds.
2. THE Fairness_Simulator SHALL use 49%–51% as the Balance_Band boundaries.
3. THE Fairness_Simulator SHALL execute a dual-pass validation: first tuning against the Reference_Bot, then validating with random mirror matches.
4. WHEN the first pass completes, THE Fairness_Simulator SHALL report per-build win rates against the Reference_Bot.
5. WHEN the second pass completes, THE Fairness_Simulator SHALL report per-build win rates from random mirror matches as a secondary validation.
6. THE Fairness_Simulator SHALL report results for all 28 valid Build_Configurations.
