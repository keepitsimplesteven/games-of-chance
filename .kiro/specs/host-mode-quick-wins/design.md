# Design Document: Host Mode Quick Wins

## Overview

Three targeted improvements to the host control panel infrastructure:
1. Replace the floating action button (FAB) with an inline gear icon in the header bar
2. Add a rename-player host action via the existing ActionRegistry pattern
3. Introduce a `playerSeeds` field on RoomState for future lottery seed overrides

All changes follow established patterns: side-effect action registration, typed ClientMessage handling, host authorization checks, and STATE_SYNC broadcasting.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/shared/src/types.ts                                   │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │ ClientMessage union  │  │ RoomState                        │ │
│  │ + "RENAME_PLAYER"    │  │ + playerSeeds: Record<str, num>  │ │
│  │ + "SET_PLAYER_SEEDS" │  └──────────────────────────────────┘ │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
         │                                   │
         ▼                                   ▼
┌────────────────────────┐      ┌────────────────────────────────┐
│  packages/server        │      │  packages/client                │
│  room.ts                │      │                                 │
│  + handleRenamePlayer() │      │  host-panel/                    │
│  + handleSetPlayerSeeds()      │    actions/renamePlayer.ts      │
│                         │      │    actions/views/RenameView.tsx  │
│  Auth check → mutate →  │      │    actions/icons/RenameIcon.tsx  │
│  broadcastState()       │      │                                 │
└────────────────────────┘      │  LobbyShell.tsx                 │
                                 │    + GearIcon in all 3 headers   │
                                 │                                 │
                                 │  HostControlPanel.tsx            │
                                 │    - Remove FAB                  │
                                 │    + Export open/close state     │
                                 └────────────────────────────────┘
```

## Detailed Design

### Requirement 1: Replace FAB with Header Gear Icon

#### Approach

The HostControlPanel currently owns both the FAB trigger and the overlay. We split these concerns:

1. **HostControlPanel** loses its internal `isOpen` state and FAB rendering. Instead, it accepts an `isOpen` prop (or uses a shared store slice) and renders only the overlay.
2. **A new `GearIconTrigger` component** is placed in LobbyShell's header sections. It reads the host role from the store and conditionally renders. On click, it toggles the panel open state.
3. A lightweight store slice (`hostPanelOpen: boolean`, `setHostPanelOpen`) is added to `useGameStore` so the trigger (in LobbyShell) and the overlay (HostControlPanel) share open/close state without prop drilling.

#### Component Changes

```typescript
// store/useGameStore.ts — new slice
interface GameStore {
  // ... existing
  hostPanelOpen: boolean
  setHostPanelOpen: (open: boolean) => void
}
```

```tsx
// components/shared/GearIconTrigger.tsx
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

export default function GearIconTrigger() {
  const role = useGameStore((s) => s.role)
  const setHostPanelOpen = useGameStore((s) => s.setHostPanelOpen)
  const theme = useTheme()

  if (role !== "host") return null

  return (
    <button
      type="button"
      onClick={() => setHostPanelOpen(true)}
      className={`inline-flex items-center justify-center p-1.5 rounded hover:bg-white/10 transition-colors ${theme.mutedText}`}
      aria-label="Open Host Controls"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        {/* Gear/cog SVG path */}
        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.434-.901 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291a1.873 1.873 0 0 0-1.116-2.693l-.318-.094c-.835-.246-.835-1.428 0-1.674l.319-.094a1.873 1.873 0 0 0 1.115-2.692l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z" />
      </svg>
    </button>
  )
}
```

#### LobbyShell Integration

The `GearIconTrigger` is placed adjacent to `ConnectionStatus` in all three header variants:

```tsx
// Lobby header
<div className="flex items-center gap-1.5">
  <ShareLink />
  <ConnectionStatus />
  <GearIconTrigger />
</div>

// Active game header (same pattern)
// Playcaller header (same pattern)
```

#### HostControlPanel Refactor

```tsx
// host-panel/HostControlPanel.tsx
export default function HostControlPanel() {
  const role = useGameStore((s) => s.role)
  const isOpen = useGameStore((s) => s.hostPanelOpen)
  const setHostPanelOpen = useGameStore((s) => s.setHostPanelOpen)
  // ... existing action logic

  // Auto-close when demoted
  if (role !== "host") {
    if (isOpen) setHostPanelOpen(false)
    return null
  }

  // No FAB — only render overlay when open
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 ...">
      {/* Existing overlay content, close button calls setHostPanelOpen(false) */}
    </div>
  )
}
```

---

### Requirement 2: Rename Player Host Action

#### Shared Types

Add the new message variant to `ClientMessage`:

```typescript
// packages/shared/src/types.ts
export type ClientMessage =
  | { type: "RENAME_PLAYER"; payload: { playerId: string; newName: string } }
  // ... existing variants
```

#### Action Registration (Client)

```typescript
// packages/client/src/host-panel/actions/renamePlayer.ts
import { actionRegistry } from "../ActionRegistry"
import RenamePlayerIcon from "./icons/RenamePlayerIcon"
import RenamePlayerView from "./views/RenamePlayerView"

actionRegistry.register({
  id: "rename-player",
  label: "Rename Player",
  icon: RenamePlayerIcon,
  isAvailable: (roomState, currentPlayerId) => {
    // Available when at least one non-host player exists (connected or disconnected)
    return roomState.players.some(
      (p) => p.id !== currentPlayerId && p.role !== "host"
    )
  },
  component: RenamePlayerView,
})
```

#### Rename Player View (Client)

```tsx
// packages/client/src/host-panel/actions/views/RenamePlayerView.tsx
import { useState } from "react"
import { useGameStore } from "../../../store/useGameStore"

export default function RenamePlayerView() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const send = useGameStore((s) => s.send)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [renamed, setRenamed] = useState<string | null>(null)

  // All non-host players (connected or disconnected)
  const targets = (roomState?.players ?? []).filter(
    (p) => p.id !== playerId && p.role !== "host"
  )

  function handleSubmit() {
    if (!selectedTarget || !newName.trim()) return
    send({ type: "RENAME_PLAYER", payload: { playerId: selectedTarget, newName: newName.trim() } })
    setRenamed(newName.trim())
    setSelectedTarget(null)
    setNewName("")
  }

  // ... Target picker list → name input → confirmation (follows KickPlayerView pattern)
}
```

#### Server Handler

```typescript
// packages/server/src/room.ts
private handleRenamePlayer(
  sender: Connection,
  payload: { playerId: string; newName: string }
) {
  // Authorization: only host can rename players
  const hostId = this.getHostId()
  const senderId = this.getPlayerIdByConnectionId(sender.id)
  if (senderId !== hostId) {
    this.sendError(sender, "NOT_HOST", "Only the host can rename players")
    return
  }

  // Validate target exists
  const target = this.state.players[payload.playerId]
  if (!target) {
    this.sendError(sender, "INVALID_TARGET", "Player not found")
    return
  }

  // Update name and broadcast
  target.name = payload.newName
  this.broadcastState()
}
```

#### Message Switch Addition

```typescript
case "RENAME_PLAYER":
  this.handleRenamePlayer(sender, msg.payload)
  break
```

---

### Requirement 3: Player Seeds on RoomState

#### Shared Types

```typescript
// packages/shared/src/types.ts
export interface RoomState {
  // ... existing fields
  /** Manual seed overrides for lottery mode. Maps playerId → seed number.
   *  Future intent: override default join-order seeding in Playcaller Lottery mode. */
  playerSeeds: Record<string, number>
}

export type ClientMessage =
  | { type: "SET_PLAYER_SEEDS"; payload: { seeds: Record<string, number> } }
  // ... existing variants
```

#### Server Initialization

```typescript
// In LiveRoomState / room creation
playerSeeds: {} as Record<string, number>
```

#### Server Handler

```typescript
private handleSetPlayerSeeds(
  sender: Connection,
  payload: { seeds: Record<string, number> }
) {
  // Authorization: only host can set player seeds
  const hostId = this.getHostId()
  const senderId = this.getPlayerIdByConnectionId(sender.id)
  if (senderId !== hostId) {
    this.sendError(sender, "NOT_HOST", "Only the host can set player seeds")
    return
  }

  // Replace seeds map and broadcast
  // Future intent: manual override of default join-order seeding in Playcaller Lottery mode
  this.state.playerSeeds = payload.seeds
  this.broadcastState()
}
```

#### getPublicState() Addition

```typescript
private getPublicState(): RoomState {
  return {
    // ... existing fields
    playerSeeds: this.state.playerSeeds ?? {},
  }
}
```

#### Message Switch Addition

```typescript
case "SET_PLAYER_SEEDS":
  this.handleSetPlayerSeeds(sender, msg.payload)
  break
```

---

## Data Models

### New/Modified Types

| Type | Package | Change |
|------|---------|--------|
| `ClientMessage` | shared | Add `"RENAME_PLAYER"` and `"SET_PLAYER_SEEDS"` variants |
| `RoomState` | shared | Add `playerSeeds: Record<string, number>` field |
| `GameStore` | client | Add `hostPanelOpen: boolean` and `setHostPanelOpen` |

### Store Slice Addition

```typescript
// useGameStore — new state for host panel visibility
hostPanelOpen: false,
setHostPanelOpen: (open: boolean) => set({ hostPanelOpen: open }),
```

### Action Store Method

```typescript
// useGameStore — add renamePlayer convenience or use generic send()
// The RenamePlayerView can use the existing send() method directly
```

---

## Error Handling

| Scenario | Server Response | Client Behavior |
|----------|----------------|-----------------|
| Non-host sends RENAME_PLAYER | `ERROR { code: "NOT_HOST", message: "Only the host can rename players" }` | Toast/ignore |
| RENAME_PLAYER with invalid playerId | `ERROR { code: "INVALID_TARGET", message: "Player not found" }` | Toast/ignore |
| Non-host sends SET_PLAYER_SEEDS | `ERROR { code: "NOT_HOST", message: "Only the host can set player seeds" }` | Toast/ignore |

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Modify | Add RENAME_PLAYER, SET_PLAYER_SEEDS to ClientMessage; add playerSeeds to RoomState |
| `packages/server/src/room.ts` | Modify | Add handleRenamePlayer, handleSetPlayerSeeds; add to switch; init playerSeeds; include in getPublicState |
| `packages/client/src/store/useGameStore.ts` | Modify | Add hostPanelOpen slice |
| `packages/client/src/components/shared/GearIconTrigger.tsx` | Create | Gear icon button, host-only |
| `packages/client/src/components/lobby/LobbyShell.tsx` | Modify | Add GearIconTrigger to all 3 header variants |
| `packages/client/src/host-panel/HostControlPanel.tsx` | Modify | Remove FAB, use store-driven isOpen |
| `packages/client/src/host-panel/actions/renamePlayer.ts` | Create | Action registration |
| `packages/client/src/host-panel/actions/icons/RenamePlayerIcon.tsx` | Create | Pencil/edit icon |
| `packages/client/src/host-panel/actions/views/RenamePlayerView.tsx` | Create | Target picker + name input |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Rename action availability matches non-host player existence

*For any* room state and host player ID, the rename-player action's `isAvailable` function returns `true` if and only if at least one player in the room has a role other than "host".

**Validates: Requirements 2.7**

### Property 2: Host-only authorization for RENAME_PLAYER

*For any* sender connection and RENAME_PLAYER payload, if the sender does not have the "host" role, the server SHALL reject the message with a "NOT_HOST" error and the room state SHALL remain unchanged.

**Validates: Requirements 2.4, 2.5**

### Property 3: RENAME_PLAYER mutates only the target player's name

*For any* valid RENAME_PLAYER message (host sender, existing target player, non-empty newName), after server processing the target player's `name` field in the broadcast state SHALL equal `newName`, and all other player fields SHALL remain unchanged.

**Validates: Requirements 2.6**

### Property 4: Rename player list excludes the host

*For any* room state with N players of mixed roles, the list of players shown in the RenamePlayerView SHALL contain exactly those players whose role is not "host" (regardless of connection status).

**Validates: Requirements 2.2**

### Property 5: Host-only authorization for SET_PLAYER_SEEDS

*For any* sender connection and SET_PLAYER_SEEDS payload, if the sender does not have the "host" role, the server SHALL reject the message with a "NOT_HOST" error and the room state's `playerSeeds` SHALL remain unchanged.

**Validates: Requirements 3.6**

### Property 6: SET_PLAYER_SEEDS replaces the seeds map

*For any* valid SET_PLAYER_SEEDS message (host sender, any `Record<string, number>` seeds map), after server processing the room state's `playerSeeds` SHALL exactly equal the submitted seeds map.

**Validates: Requirements 3.5**

### Property 7: STATE_SYNC always includes playerSeeds

*For any* room state broadcast (triggered by any mutation), the STATE_SYNC payload SHALL include a `playerSeeds` field of type `Record<string, number>`.

**Validates: Requirements 3.3**
