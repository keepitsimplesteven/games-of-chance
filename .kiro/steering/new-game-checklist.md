---
inclusion: auto
---

# New Game Checklist

When creating a new game plugin, you MUST also complete these integration steps. These are easy to forget and have been missed multiple times:

## Required Steps

1. **Create a game tile** in `packages/client/src/components/lobby/GameTileGrid.tsx`
   - Add an entry to the `games` array with: `id`, `name`, `emoji`, `description`, `active: true`, and `isFinale` (true/false)
   - If the game is the tournament finale, set `isFinale: true` and remove `isFinale` from the previous finale game

2. **Register in GameView** — add a `case` to the switch in `packages/client/src/components/game/GameView.tsx` that returns the new game's container component

3. **Side-effect import in room.ts** — add an import like `import "./games/{name}/Plugin"` in `packages/server/src/room.ts` so the plugin registers at startup

4. **Include PlaycallerGameState-style state in STATE_SYNC** if the game has custom state that clients need (bracket, spin order, etc.) — add it to `getPublicState()` in `room.ts` and to the `RoomState` type in shared types

## Why This Matters

Without the game tile, the game won't appear in the lobby and players can't select it. This has been forgotten 3 times now. Always verify the game tile exists before considering a new game implementation complete.

---

# Endless Mode Rules

**In endless mode, ALL games MUST ALWAYS be available and selectable. No exceptions.**

Endless mode means:
- No games are ever locked or marked unavailable
- `isFinale` has NO effect — it is a tournament-only concept
- `unlockCriteria` has NO effect — it is a tournament-only concept
- Playing a game does NOT lock it — it can be replayed immediately
- Completing a finale game goes to END_GAME (back to lobby), NEVER to END_TOURNAMENT
- `tournamentProgress` is ALWAYS `null` in endless mode
- The server default progressionMode is `"endless"` — tournament is opt-in

**The server guards all tournament logic behind `progressionMode === "tournament" && this.state.tournamentProgress`.** If you add new tournament features, ALWAYS include both checks. Never apply unlock/lock/finale logic when progressionMode is "endless".

**The client determines tile clickability as:**
```
isTournament && tileStatus ? tileStatus === "available" : game.active
```
In endless mode, `isTournament` is false and all tiles with `active: true` are clickable. Tournament overlays (locked, unavailable) only render when `tileStatus` is non-null (tournament mode only).

