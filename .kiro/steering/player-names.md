---
inclusion: auto
---

# Player Names in UI

## Rule

All visible text in the UI that refers to a player MUST display the player's **name** (from `player.name`), never their raw **ID** (from `player.id`).

Player IDs are UUIDs or connection IDs — they are internal identifiers and must never be shown to users.

## How to resolve a player name

The players array is available via:
```typescript
const players = useGameStore((s) => s.roomState?.players)
```

Use the shared hook at `packages/client/src/games/playcaller/hooks/usePlayerName.ts`:
```typescript
import { usePlayerName } from "./hooks/usePlayerName"

const getPlayerName = usePlayerName()
const displayName = getPlayerName(somePlayerId) // returns name or falls back to ID
```

For components outside the playcaller directory, replicate the same pattern:
```typescript
const players = useGameStore((s) => s.roomState?.players)
const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name ?? id
```

## When this applies

- Bracket matchup labels (playerA, playerB, winner)
- Scoreboard entries
- Drive view headers ("You vs {name}")
- Spectator views
- Leaderboard displays
- Any toast, notification, or status message referencing a player

## Internal logic

Comparison logic (e.g., `matchup.winner === playerId`) should continue using raw IDs. Only the **rendered text** must use resolved names.
