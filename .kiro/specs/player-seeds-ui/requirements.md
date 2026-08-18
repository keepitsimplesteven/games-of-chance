# Requirements Document

## Introduction

This feature adds a "Set Seeds" host action to the control panel, allowing the host to manually assign seed order to players via a drag-and-drop reorderable list. The assigned seeds are then consumed by the Playcaller Lottery mode at game start to determine the ranked player ordering (seed 1 = best lottery odds), falling back to join order when no seeds are set.

## Glossary

- **Host_Control_Panel**: The UI panel available to the host player for managing room actions (kick, rename, set seeds, etc.)
- **ActionRegistry**: A singleton registry that stores and retrieves host actions by ID, preserving insertion order
- **Set_Seeds_Action**: A host action registered in the ActionRegistry that renders a drag-and-drop seed assignment UI
- **Seed_List_UI**: A drag-and-drop reorderable list component using framer-motion Reorder API that displays all players in the room
- **Player_Seeds**: A `Record<string, number>` mapping each player ID to a 1-based seed number
- **Lottery_Init**: The one-time initialization logic at round 1 start in lottery progression mode that builds `rankedPlayerIds`
- **Room_State**: The shared state object representing the current room, including players, phase, config, and playerSeeds

## Requirements

### Requirement 1: Action Registration

**User Story:** As a host, I want the "Set Seeds" action to appear in the host control panel so that I can assign seed order to players.

#### Acceptance Criteria

1. THE Set_Seeds_Action SHALL register in the ActionRegistry with id "set-seeds", label "Set Seeds", an icon component, an isAvailable function, and a component function.
2. WHEN the ActionRegistry returns all actions, THE Set_Seeds_Action SHALL appear in the registered action list alongside existing actions.

### Requirement 2: Action Availability

**User Story:** As a host, I want the "Set Seeds" action to only be available when appropriate so that I do not attempt seeding in invalid states.

#### Acceptance Criteria

1. WHILE the Room_State phase is "LOBBY" and the Room_State contains 2 or more players, THE Set_Seeds_Action isAvailable function SHALL return true.
2. WHILE the Room_State phase is not "LOBBY", THE Set_Seeds_Action isAvailable function SHALL return false.
3. WHILE the Room_State contains fewer than 2 players, THE Set_Seeds_Action isAvailable function SHALL return false.

### Requirement 3: Seed List UI Rendering

**User Story:** As a host, I want to see all players in the room as a reorderable list so that I can assign seed positions by dragging.

#### Acceptance Criteria

1. WHEN the Set_Seeds_Action component renders, THE Seed_List_UI SHALL display all players currently in the Room_State as an ordered list.
2. THE Seed_List_UI SHALL use framer-motion Reorder.Group and Reorder.Item components for drag-and-drop reordering.
3. THE Seed_List_UI SHALL display the seed number (1-based position) next to each player entry.
4. WHEN the Seed_List_UI initially renders, THE Seed_List_UI SHALL order players by their current join order from the Room_State players array.

### Requirement 4: Drag-and-Drop Reordering

**User Story:** As a host, I want to reorder the player list by dragging so that I can assign seeds intuitively.

#### Acceptance Criteria

1. WHEN the host drags a player item to a new position, THE Seed_List_UI SHALL update the visual order to reflect the new arrangement.
2. WHEN the list order changes, THE Seed_List_UI SHALL update all displayed seed numbers to match the new positional order (position 0 displays seed 1, position 1 displays seed 2, etc.).

### Requirement 5: Seed Submission

**User Story:** As a host, I want to submit the seed assignment so that the server records the seed order for game start.

#### Acceptance Criteria

1. WHEN the host activates the submit control, THE Seed_List_UI SHALL convert the current list order to a Player_Seeds record where each player ID maps to its 1-based position in the list.
2. WHEN the host activates the submit control, THE Seed_List_UI SHALL send a SET_PLAYER_SEEDS message with the Player_Seeds record as the payload.
3. THE Seed_List_UI SHALL include all players present in the Room_State in the submitted Player_Seeds record with no omissions.

### Requirement 6: Complete Player Coverage

**User Story:** As a host, I want the seed list to always reflect the full room roster so that no player is left unseeded.

#### Acceptance Criteria

1. THE Seed_List_UI SHALL display every player (including bots) present in the Room_State players array.
2. THE Seed_List_UI SHALL maintain a one-to-one mapping between the displayed list items and the Room_State players array with no gaps or duplicates.

### Requirement 7: Lottery Init Seed Integration

**User Story:** As a system operator, I want the lottery mode to respect host-assigned seeds so that the host can control lottery odds ordering.

#### Acceptance Criteria

1. WHEN lottery mode initializes at round 1 and the Room_State playerSeeds record is non-empty, THE Lottery_Init SHALL sort player IDs by their seed value ascending (seed 1 first) to build the rankedPlayerIds array.
2. WHEN lottery mode initializes at round 1 and the Room_State playerSeeds record is empty, THE Lottery_Init SHALL use the default player join order as the rankedPlayerIds array.
3. THE Lottery_Init SHALL apply the playerSeeds ordering only once at round 1 initialization per game session.

### Requirement 8: Fallback Transparency

**User Story:** As a player, I want the game to work identically to before when the host has not set seeds so that existing behavior is preserved.

#### Acceptance Criteria

1. WHILE the Room_State playerSeeds record is empty, THE Lottery_Init SHALL produce the same rankedPlayerIds as the current default behavior (join order).
2. THE Lottery_Init SHALL introduce no breaking changes to the lottery draw logic, bracket generation, or odds table application.
