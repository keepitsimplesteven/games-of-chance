# Requirements Document

## Introduction

Three quick-win improvements to the host control panel: relocating the floating action button into the header as a gear icon, adding a rename-player host action via the existing ActionRegistry pattern, and introducing a `playerSeeds` map on RoomState for future lottery seed overrides.

## Glossary

- **Host_Control_Panel**: The full-screen overlay UI accessible only to the host player, containing registered host actions (kick, reassign, adjust score, rename).
- **Header_Bar**: The top-level navigation bar rendered in LobbyShell across all layout variants (lobby, active game, playcaller).
- **Gear_Icon**: A small settings/cog icon rendered in the Header_Bar that opens the Host_Control_Panel.
- **FAB**: The existing fixed-position 12×12 floating action button (bottom-right) that currently opens the Host_Control_Panel.
- **ActionRegistry**: The client-side registry where host actions are registered with `{ id, label, icon, isAvailable, component }`.
- **Rename_Player_Action**: A new host action that allows the host to change the display name of any player in the room.
- **Player_Seeds**: A `Record<string, number>` field on RoomState mapping player IDs to manually-assigned seed numbers for lottery mode.
- **Client**: The React + Vite frontend application (packages/client).
- **Server**: The PartyKit backend application (packages/server).
- **STATE_SYNC**: The server-to-client message that broadcasts the full RoomState to all connected clients.
- **ClientMessage**: The typed union of all client-to-server WebSocket message types defined in shared/types.ts.

## Requirements

### Requirement 1: Replace FAB with Header Gear Icon

**User Story:** As a host, I want the Host Control Panel trigger to be a small gear icon in the header bar, so that it is less intrusive and consistently positioned across all views.

#### Acceptance Criteria

1. WHEN the Host_Control_Panel trigger is rendered for a host player, THE Client SHALL display a Gear_Icon in the Header_Bar instead of the FAB.
2. THE Client SHALL render the Gear_Icon in all three Header_Bar variants: lobby layout, active game layout, and playcaller layout.
3. WHEN the current user is not a host, THE Client SHALL hide the Gear_Icon from the Header_Bar.
4. WHEN the host taps the Gear_Icon, THE Host_Control_Panel SHALL open as a full-screen overlay.
5. THE Client SHALL remove the fixed-position FAB button from HostControlPanel rendering.
6. THE Client SHALL position the Gear_Icon adjacent to the ConnectionStatus indicator in the Header_Bar.

### Requirement 2: Rename Player Host Action

**User Story:** As a host, I want to rename any player in the room, so that I can correct misspellings or assign recognizable names during a session.

#### Acceptance Criteria

1. THE Client SHALL register a Rename_Player_Action in the ActionRegistry following the existing pattern used by kick-player, reassign-host, and adjust-score actions.
2. WHEN the host selects the Rename_Player_Action, THE Client SHALL display a list of connected players (excluding the host) available for renaming.
3. WHEN the host selects a target player and submits a new name, THE Client SHALL send a ClientMessage of type "RENAME_PLAYER" with payload `{ playerId: string; newName: string }` to the Server.
4. WHEN the Server receives a "RENAME_PLAYER" message, THE Server SHALL verify that the sender has host role before processing the rename.
5. IF a non-host player sends a "RENAME_PLAYER" message, THEN THE Server SHALL reject the message and return an ERROR response.
6. WHEN the Server processes a valid "RENAME_PLAYER" message, THE Server SHALL update the target Player.name field and broadcast the change to all clients via STATE_SYNC.
7. THE Rename_Player_Action SHALL be available whenever at least one non-host player exists in the room (connected or disconnected).
8. THE shared types package SHALL define the "RENAME_PLAYER" ClientMessage variant with payload `{ playerId: string; newName: string }`.

### Requirement 3: Player Seeds on RoomState

**User Story:** As a host, I want to manually assign seed numbers to players, so that lottery mode can use custom seedings instead of default join order.

#### Acceptance Criteria

1. THE shared types package SHALL define `playerSeeds: Record<string, number>` as a field on the RoomState interface.
2. THE Server SHALL initialize `playerSeeds` as an empty object `{}` when a room is created.
3. THE Server SHALL include `playerSeeds` in every STATE_SYNC broadcast to all clients.
4. THE shared types package SHALL define a "SET_PLAYER_SEEDS" ClientMessage variant with payload `{ seeds: Record<string, number> }`.
5. WHEN the Server receives a "SET_PLAYER_SEEDS" message from a host, THE Server SHALL replace the current `playerSeeds` value with the provided seeds map and broadcast via STATE_SYNC.
6. IF a non-host player sends a "SET_PLAYER_SEEDS" message, THEN THE Server SHALL reject the message and return an ERROR response.
7. THE Server SHALL include a code comment on the `playerSeeds` field noting its future intent: manual override of default join-order seeding in Playcaller Lottery mode.
8. THE Client SHALL not integrate `playerSeeds` with actual lottery draw logic in this iteration.
