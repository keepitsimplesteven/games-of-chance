# Design Document: Player Seeds UI

## Architecture Overview

This feature adds a "Set Seeds" host action to the existing ActionRegistry system. It follows the established pattern of: side-effect registration file → icon component → view component. The only server-side change is a 3-line sort in the lottery init path.

### Component Diagram

```
HostControlPanel
  └── imports "./actions/setSeeds" (side-effect registration)
        ├── SetSeedsIcon (SVG icon)
        └── SetSeedsView (drag-and-drop Reorder UI)
              ├── framer-motion Reorder.Group + Reorder.Item
              ├── Local state: ordered player ID array
              └── Submit → _socketSend({ type: "SET_PLAYER_SEEDS", payload: { seeds } })

Server (room.ts)
  └── Lottery init (line ~1693)
        └── If playerSeeds non-empty → sort playerIds by seed ascending
```

## Components

### 1. Action Registration — `packages/client/src/host-panel/actions/setSeeds.ts`

Side-effect module that registers the action in the ActionRegistry on import.

```typescript
import { actionRegistry } from "../ActionRegistry"
import SetSeedsIcon from "./icons/SetSeedsIcon"
import SetSeedsView from "./views/SetSeedsView"

actionRegistry.register({
  id: "set-seeds",
  label: "Set Seeds",
  icon: SetSeedsIcon,
  isAvailable: (roomState) =>
    roomState.round.phase === "LOBBY" && roomState.players.length >= 2,
  component: SetSeedsView,
})
```

The `HostControlPanel.tsx` will import this module alongside the existing action imports.

### 2. Icon Component — `packages/client/src/host-panel/actions/icons/SetSeedsIcon.tsx`

An SVG icon depicting a numbered list or seed concept. Uses the same `h-5 w-5` sizing and `currentColor` stroke pattern as existing icons.

```typescript
export default function SetSeedsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {/* Numbered list icon */}
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="4" y="7" fontSize="6" fill="currentColor" stroke="none">1</text>
      <text x="4" y="13" fontSize="6" fill="currentColor" stroke="none">2</text>
      <text x="4" y="19" fontSize="6" fill="currentColor" stroke="none">3</text>
    </svg>
  )
}
```

### 3. View Component — `packages/client/src/host-panel/actions/views/SetSeedsView.tsx`

The main UI. Uses framer-motion `Reorder.Group` and `Reorder.Item` for drag-and-drop.

#### State Management

- **Local state**: `orderedIds: string[]` — initialized from `roomState.players.map(p => p.id)`
- **Derived**: Seed number for each player is `index + 1` in the `orderedIds` array
- **Submission**: Converts `orderedIds` to `Record<string, number>` and sends via `_socketSend`

#### Component Structure

```typescript
import { useState } from "react"
import { Reorder } from "framer-motion"
import { useGameStore } from "../../../store/useGameStore"

export default function SetSeedsView() {
  const roomState = useGameStore((s) => s.roomState)
  const _socketSend = useGameStore((s) => s._socketSend)
  const players = roomState?.players ?? []

  const [orderedIds, setOrderedIds] = useState<string[]>(
    () => players.map((p) => p.id)
  )

  function handleSubmit() {
    const seeds: Record<string, number> = {}
    orderedIds.forEach((id, i) => {
      seeds[id] = i + 1
    })
    _socketSend?.({ type: "SET_PLAYER_SEEDS", payload: { seeds } })
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-zinc-200">Assign Seed Order</h3>
      <p className="text-sm text-zinc-400">
        Drag to reorder. Seed 1 gets the best lottery odds.
      </p>

      <Reorder.Group
        axis="y"
        values={orderedIds}
        onReorder={setOrderedIds}
        className="space-y-2"
      >
        {orderedIds.map((id, index) => {
          const player = players.find((p) => p.id === id)
          return (
            <Reorder.Item
              key={id}
              value={id}
              className="flex items-center gap-3 rounded-lg border border-zinc-600
                         bg-zinc-800 px-4 py-3 cursor-grab active:cursor-grabbing
                         hover:bg-zinc-700 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full
                              bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="font-medium text-zinc-200">
                {player?.name ?? id}
              </span>
              {player && !player.connected && (
                <span className="text-xs text-zinc-500">(disconnected)</span>
              )}
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white
                   hover:bg-blue-700 transition-colors"
      >
        Set Seeds
      </button>
    </div>
  )
}
```

### 4. HostControlPanel Import Addition

Add the side-effect import to `HostControlPanel.tsx`:

```typescript
import "./actions/setSeeds"
```

### 5. Server-Side Lottery Init Change — `packages/server/src/room.ts`

Minimal edit at the lottery init block (~line 1693). Replace:

```typescript
if (this.state.config.progressionMode === "lottery") {
  rankedPlayerIds = playerIds
}
```

With:

```typescript
if (this.state.config.progressionMode === "lottery") {
  const seeds = this.state.playerSeeds
  if (Object.keys(seeds).length > 0) {
    rankedPlayerIds = [...playerIds].sort((a, b) => (seeds[a] ?? Infinity) - (seeds[b] ?? Infinity))
  } else {
    rankedPlayerIds = playerIds
  }
}
```

The `?? Infinity` fallback ensures any player not in the seeds map sorts to the end (defensive, should not happen given the UI guarantees complete coverage).

## Interfaces

### Message Interface (existing)

```typescript
// Already defined in shared types — no changes needed
type SET_PLAYER_SEEDS = {
  type: "SET_PLAYER_SEEDS"
  payload: { seeds: Record<string, number> }
}
```

### ActionRegistry Interface (existing)

```typescript
// Used by setSeeds.ts — no changes to the interface
interface HostAction {
  id: string
  label: string
  icon: () => ReactNode
  isAvailable: (roomState: RoomState, currentPlayerId: string) => boolean
  component: () => ReactNode
}
```

### Seed Conversion Function (pure, extracted for testability)

```typescript
/**
 * Convert an ordered array of player IDs to a seeds record.
 * Position 0 → seed 1, position 1 → seed 2, etc.
 */
export function buildSeedsRecord(orderedIds: string[]): Record<string, number> {
  const seeds: Record<string, number> = {}
  orderedIds.forEach((id, i) => {
    seeds[id] = i + 1
  })
  return seeds
}
```

### Lottery Sort Function (pure, extracted for testability)

```typescript
/**
 * Sort player IDs by their seed value ascending.
 * Players without a seed entry sort to the end.
 */
export function sortBySeed(
  playerIds: string[],
  seeds: Record<string, number>
): string[] {
  return [...playerIds].sort((a, b) => (seeds[a] ?? Infinity) - (seeds[b] ?? Infinity))
}
```

## Data Models

No new data models are introduced. The feature uses the existing `playerSeeds: Record<string, number>` field on `RoomState` and the existing `SET_PLAYER_SEEDS` message type.

### State Flow

```
1. Host opens Set Seeds view
2. Local state initialized: orderedIds = roomState.players.map(p => p.id)
3. Host drags items to reorder → setOrderedIds(newOrder)
4. Host clicks "Set Seeds" → buildSeedsRecord(orderedIds) → _socketSend(SET_PLAYER_SEEDS)
5. Server receives → handleSetPlayerSeeds validates host auth → state.playerSeeds = seeds → broadcastState
6. At game start (lottery mode, round 1) → sortBySeed(playerIds, state.playerSeeds) → rankedPlayerIds
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| `_socketSend` is null (disconnected) | Optional chaining `_socketSend?.()` — submit is a no-op; user sees no feedback but reconnection will restore state |
| Non-host sends SET_PLAYER_SEEDS | Server rejects with `NOT_HOST` error (existing handler) |
| playerSeeds has stale player IDs (player left after seeding) | `?? Infinity` in sort pushes unknown IDs to end; server re-validates active players at game start |
| Empty player list (< 2 players) | `isAvailable` returns false, action button is disabled |
| Room phase changes while view is open | No crash — submit still works but seeds may be irrelevant; host panel closes on game start anyway |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: isAvailable is true if and only if LOBBY phase with 2+ players

*For any* RoomState, the isAvailable function returns true if and only if `roomState.round.phase === "LOBBY"` and `roomState.players.length >= 2`. For all other states, it returns false.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Displayed list is a bijection of the players array

*For any* Room_State players array, the Seed_List_UI displays exactly the same set of player IDs with no omissions, duplications, or extra entries — establishing a one-to-one correspondence between list items and players.

**Validates: Requirements 3.1, 6.1, 6.2**

### Property 3: Seed number equals position plus one

*For any* ordering of the player list (including the initial join-order and any subsequent reordering), the displayed seed number for the item at position `i` is always `i + 1`.

**Validates: Requirements 3.3, 4.2**

### Property 4: Seed submission produces a complete correct mapping

*For any* ordered array of N player IDs, `buildSeedsRecord(orderedIds)` produces a `Record<string, number>` where: (a) every player ID in the input appears as a key, (b) no extra keys exist, and (c) the value for the player at position `i` is `i + 1`.

**Validates: Requirements 5.1, 5.3**

### Property 5: Seed-aware lottery ordering sorts ascending by seed value

*For any* non-empty playerSeeds record and player ID array, `sortBySeed(playerIds, seeds)` produces an array where each element's seed value is less than or equal to the next element's seed value.

**Validates: Requirements 7.1**

### Property 6: Empty seeds fallback preserves join order

*For any* player ID array, when playerSeeds is an empty record, the lottery init produces a `rankedPlayerIds` array identical to the input join-order array.

**Validates: Requirements 7.2, 8.1**
