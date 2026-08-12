# Requirements Document

## Introduction

Visual combat animations for the Battle Bots replay system. This feature adds attack slide animations, weapon-specific hit effect SVGs, and floating damage numbers to the existing tick-based replay without modifying any gameplay logic or combat resolution code. All new work is a purely cosmetic animation layer rendered on top of the existing ReplayBattleArena and ReplayFFAArena components.

## Glossary

- **Animation_Layer**: The set of React components and CSS animations that render visual effects on top of existing robot fighters during replay playback
- **Attack_Slide**: A brief translate animation that moves an attacking robot toward its target and back to its original position
- **Hit_SVG**: A weapon-specific SVG graphic displayed on or near the target robot to indicate an attack landed or missed
- **Damage_Number**: A floating numeric label showing the amount of HP removed from the target robot, animated upward with a fade-out
- **Replay_Arena**: The existing ReplayBattleArena (1v1) and ReplayFFAArena (FFA) components that render tick-by-tick battle playback
- **Tick**: A single step in the replay playback driven by ReplayController at the configured gameSpeed interval
- **AttackEvent**: The data object describing a single attack within a tick, containing attackerId, targetId, hit, damage, and targetHpAfter
- **Attacker_Color**: The color assigned to the attacking robot from the 8-color ROBOT_COLORS palette
- **CompositeRobot**: The existing SVG component (128x128 viewBox) that renders a robot from head, body, and weapon parts

## Requirements

### Requirement 1: Attack Slide Animation (1v1)

**User Story:** As a player watching a 1v1 replay, I want to see my robot slide toward the opponent at a natural cadence, so that the combat feels more dynamic without being visually overwhelming at high attack speeds.

#### Acceptance Criteria

1. WHILE a robot is alive and the slide animation is enabled, THE Animation_Layer SHALL trigger Attack_Slide animations by evaluating a per-tick random chance derived from the robot's attack count in that tick, such that on average no more than one slide occurs every 3 ticks for a robot attacking once per tick, scaling proportionally for robots with higher attacks-per-tick counts
2. WHEN an Attack_Slide is triggered for the left-positioned robot in 1v1 mode, THE Animation_Layer SHALL translate that robot to the right toward the opponent, and WHEN an Attack_Slide is triggered for the right-positioned robot, THE Animation_Layer SHALL translate that robot to the left toward the opponent
3. WHEN an Attack_Slide is triggered, THE Animation_Layer SHALL translate the robot toward the opponent by an offset between 10% and 25% of the robot's rendered width, then return the robot to its original position, completing both movements within the duration of the current tick as determined by gameSpeed
4. WHILE an Attack_Slide is in progress, THE Animation_Layer SHALL apply the translation using CSS transform so that the robot remains within its existing flex layout allocation and does not shift adjacent elements or the VS divider
5. WHEN a robot is eliminated, THE Animation_Layer SHALL cease producing Attack_Slide animations for that robot and cancel any in-progress slide, returning the robot to its original position immediately

### Requirement 2: Attack Slide Animation (FFA)

**User Story:** As a player watching a FFA replay, I want to see attacking robots slide in a consistent direction at a natural cadence, so that I can tell which robots are actively attacking without visual chaos.

#### Acceptance Criteria

1. WHILE a robot is alive and the slide animation is enabled in an FFA Layout, THE Animation_Layer SHALL trigger Attack_Slide animations at randomized intervals between 1x and 2x the robot's tickInterval (in ticks) rather than on every individual AttackEvent
2. IF calculating the direction toward a specific target in the FFA grid is not feasible at render time, THEN THE Animation_Layer SHALL use a fixed downward slide direction for all FFA Attack_Slides
3. WHILE an Attack_Slide is in progress in FFA mode, THE Animation_Layer SHALL translate the robot by no more than 25% of the grid cell dimension in the slide direction and return it to its original position within the duration of the current tick
4. WHEN a robot is eliminated in FFA mode, THE Animation_Layer SHALL cease producing Attack_Slide animations for that robot

### Requirement 3: Attack Slide Toggle

**User Story:** As a developer or player, I want to be able to disable the slide animation, so that it can be turned off if it becomes visually obnoxious at certain speed configurations.

#### Acceptance Criteria

1. THE Animation_Layer SHALL accept a boolean flag controlling whether Attack_Slide animations are enabled, defaulting to true, applicable to both 1v1 and FFA modes
2. WHILE the Attack_Slide flag is set to false, THE Animation_Layer SHALL not produce any Attack_Slide translate animations and SHALL not begin any new Attack_Slide animations
3. IF the Attack_Slide flag is set to false while an Attack_Slide animation is in progress, THEN THE Animation_Layer SHALL allow the in-progress animation to complete its current cycle rather than interrupting it mid-translate
4. THE Animation_Layer SHALL accept the Attack_Slide flag without requiring changes to ReplayController or gameplay state

### Requirement 4: Weapon-Specific Hit SVG Effects

**User Story:** As a player, I want to see a different visual hit effect depending on the weapon type used, so that I can distinguish weapon types during combat.

#### Acceptance Criteria

1. WHEN an AttackEvent with hit equal to true is processed, THE Animation_Layer SHALL resolve the attacker's weapon type from the attacker robot's visual data and display the corresponding Hit_SVG on the target robot
2. THE Animation_Layer SHALL render the Blaster Hit_SVG as an elongated line graphic no larger than 20% of the target robot's rendered width
3. THE Animation_Layer SHALL render the Bazooka Hit_SVG as a jagged starburst outline graphic no larger than 30% of the target robot's rendered width
4. THE Animation_Layer SHALL render the Drill Hit_SVG as a drill icon graphic no larger than 20% of the target robot's rendered width
5. WHEN a Hit_SVG is displayed, THE Animation_Layer SHALL color the Hit_SVG using the Attacker_Color of the attacking robot
6. WHEN a Hit_SVG is displayed, THE Animation_Layer SHALL position the Hit_SVG at a randomized location within the bounding box of the target robot's rendered area
7. WHEN a Hit_SVG is displayed, THE Animation_Layer SHALL show the Hit_SVG as a still image for 150 milliseconds and then remove the graphic
8. WHEN an AttackEvent with hit equal to false is processed, THE Animation_Layer SHALL display the Hit_SVG at 0.3 opacity and without an accompanying Damage_Number
9. IF multiple AttackEvents within the same tick target the same robot, THEN THE Animation_Layer SHALL display each Hit_SVG at a separate randomized position so that overlapping effects remain individually distinguishable

### Requirement 5: Floating Damage Numbers

**User Story:** As a player, I want to see the amount of damage dealt float upward from a hit robot, so that I can understand how much HP each attack removes.

#### Acceptance Criteria

1. WHEN an AttackEvent with hit equal to true is processed, THE Animation_Layer SHALL display a Damage_Number showing the integer damage value positioned at the top-center of the target robot's bounding area
2. WHEN a Damage_Number is displayed, THE Animation_Layer SHALL animate the Damage_Number upward by at least 30 pixels from its origin position while fading its opacity from fully opaque to zero over the duration of the current tick
3. WHEN a Damage_Number is displayed, THE Animation_Layer SHALL color the Damage_Number text using the titleText theme token
4. WHEN an AttackEvent with hit equal to false is processed, THE Animation_Layer SHALL not display a Damage_Number
5. WHEN a Damage_Number fade-out animation completes, THE Animation_Layer SHALL remove the Damage_Number element from the DOM
6. IF multiple AttackEvents targeting the same robot occur within a single tick, THEN THE Animation_Layer SHALL display each Damage_Number individually without overlapping previous Damage_Numbers that are still animating

### Requirement 6: Animation Timing Synchronization

**User Story:** As a player, I want animations to look correct regardless of the configured game speed, so that the visual effects remain readable at both fast and slow playback speeds.

#### Acceptance Criteria

1. THE Animation_Layer SHALL complete all Attack_Slide and Damage_Number animations within the duration of a single tick as determined by the gameSpeed value in milliseconds
2. THE Animation_Layer SHALL display Hit_SVG effects for 150 milliseconds regardless of gameSpeed, removing the graphic after that fixed duration even if it spans multiple ticks at very fast speeds
3. IF gameSpeed is less than 150 milliseconds, THEN THE Animation_Layer SHALL clamp Attack_Slide and Damage_Number animation durations to 90% of the gameSpeed value so that effects complete before the next tick fires
4. IF gameSpeed is greater than or equal to 150 milliseconds, THEN THE Animation_Layer SHALL use gameSpeed as the animation duration for Attack_Slide and Damage_Number effects
5. WHILE the ReplayController isPlaying state is false and isComplete is false, THE Animation_Layer SHALL not produce any new animations

### Requirement 7: Non-Interference with Existing Replay

**User Story:** As a developer, I want the animation layer to be fully additive and contained, so that existing replay logic, HP bar transitions, and defeated state rendering remain unchanged.

#### Acceptance Criteria

1. THE Animation_Layer SHALL consume ReplayController tick data and HP state (hpStates, isComplete, winnerId, eliminations) in a read-only manner without calling setState, mutating, or dispatching updates to those values
2. THE Animation_Layer SHALL render overlay elements using CSS positioning (absolute or fixed) with a z-index above existing robot and HP bar components, without wrapping, re-parenting, or inserting elements into the existing DOM tree of Replay_Arena components
3. THE Animation_Layer SHALL preserve the existing defeated state presentation by not applying CSS transforms, opacity, or filter properties that override the eliminated robot's opacity-50, grayscale filter, or the ✕ overlay with its semi-transparent background
4. THE Animation_Layer SHALL render animations without causing layout shifts or displacement of existing robot cards, HP bars, or grid cells in Layout1v1, LayoutFFA within ReplayBattleArena, and the grid layout within ReplayFFAArena
5. THE Animation_Layer SHALL set pointer-events to none on all overlay elements so that existing interactive behaviors of the Replay_Arena components are not intercepted or blocked
6. WHEN all animation effects for a given tick complete, THE Animation_Layer SHALL remove the associated overlay DOM elements within 500 milliseconds of the animation ending, leaving no residual nodes in the document
