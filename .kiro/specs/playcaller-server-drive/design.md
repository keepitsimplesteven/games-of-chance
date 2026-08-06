# Technical Design: Playcaller Server Drive Integration

## Overview

This design wires the existing drive engine (`packages/server/src/games/playcaller/drive/`) into the PlaycallerPlugin and RoomServer so that when `SKIP_GAMEPLAY` is `false`, bracket rounds use interactive per-down play-calling instead of random resolution. The core idea: each bracket round becomes an internal "down loop" where the PICKING phase repeats per down until all matchup drives complete, then the bracket advances.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GameRoom (room.ts)                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Standard Phase System: LOBBY → PICKING → RESOLVING → RESULT│ │
│  └────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │  Playcaller Down Loop (SKIP_GAMEPLAY=false)                 │ │
│  │                                                             │ │
│  │  PICKING (per-down) ──▶ resolveDown ──▶ broadcast ──▶       │ │
│  │    ▲                                              │         │ │
│  │    └──── not all drives complete ─────────────────┘         │ │
│  │                                                             │ │
│  │    all drives complete ──▶ advance bracket ──▶ RESULT       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │ PlaycallerPlugin│   │  Drive Engine    │   │  BotManager  │  │
│  │ (state mgmt)    │   │  (resolveDown)   │   │  (playcaller)│  │
│  └─────────────────┘   └──────────────────┘   └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Module-Level Drive State (PlaycallerPlugin.ts)

Alongside the existing `bracketState`, add per-matchup drive tracking:

```typescript
// ── Module-level drive state ───────────────────────────────────────────────

import type { DriveState, OffensivePlayId, DefensivePlayId } from "./drive"

/** Per-matchup drive states for the current bracket round */
let driveStates: Record<string, DriveState> | null = null

/** Per-down picks: matchupId → { offense?: play, defense?: play } */
let downPicks: Record<string, { offense?: OffensivePlayId; defense?: DefensivePlayId }> = {}

export function getDriveStates(): Record<string, DriveState> | null {
  return driveStates
}

export function setDriveStates(states: Record<string, DriveState>): void {
  driveStates = states
}

export function resetDriveStates(): void {
  driveStates = null
  downPicks = {}
}

export function getDownPicks(): Record<string, { offense?: OffensivePlayId; defense?: DefensivePlayId }> {
  return downPicks
}

export function clearDownPicks(): void {
  downPicks = {}
}
```

### 2. Drive Initialization (PlaycallerPlugin.ts)

New function to initialize drives for a bracket round:

```typescript
import { createDriveState } from "./drive"
import type { BracketMatchup } from "@games-of-chance/shared"

/**
 * Initialize DriveState objects for all active matchups in the current bracket round.
 * Randomly assigns offense/defense for each matchup.
 */
export function initializeDrives(matchups: BracketMatchup[]): Record<string, DriveState> {
  const states: Record<string, DriveState> = {}

  for (const matchup of matchups) {
    const matchupId = matchup.id
    // Random offense/defense assignment via random seed values
    const aIsOffense = Math.random() < 0.5
    const seedA = aIsOffense ? 2 : 1
    const seedB = aIsOffense ? 1 : 2

    states[matchupId] = createDriveState(matchup.playerA, matchup.playerB, seedA, seedB)
  }

  setDriveStates(states)
  return states
}
```

### 3. Per-Down Pick Handling (PlaycallerPlugin.ts)

```typescript
import { resolveDown, isDriveComplete, selectRandomPlay } from "./drive"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./drive"

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

/**
 * Record a play selection for a player in their matchup.
 * Returns the matchupId if both picks are now present (ready to resolve), else null.
 */
export function recordPlaySelection(
  playerId: string,
  matchupId: string,
  play: OffensivePlayId | DefensivePlayId
): { resolved: boolean; matchupId: string } | { error: string } {
  if (!driveStates || !driveStates[matchupId]) {
    return { error: "Invalid matchup" }
  }

  const drive = driveStates[matchupId]

  // Verify player belongs to this matchup
  if (playerId !== drive.offensePlayerId && playerId !== drive.defensePlayerId) {
    return { error: "Player not in this matchup" }
  }

  // Drive already complete — reject
  if (drive.isComplete) {
    return { error: "Drive already complete" }
  }

  // Initialize picks for this matchup if needed
  if (!downPicks[matchupId]) {
    downPicks[matchupId] = {}
  }

  // Determine role and validate play type
  const isOffense = playerId === drive.offensePlayerId
  if (isOffense) {
    if (downPicks[matchupId].offense !== undefined) {
      return { error: "Already picked" }  // silently ignore in room.ts
    }
    if (!OFFENSIVE_PLAYS.includes(play as OffensivePlayId)) {
      return { error: "Invalid play for role" }
    }
    downPicks[matchupId].offense = play as OffensivePlayId
  } else {
    if (downPicks[matchupId].defense !== undefined) {
      return { error: "Already picked" }
    }
    if (!DEFENSIVE_PLAYS.includes(play as DefensivePlayId)) {
      return { error: "Invalid play for role" }
    }
    downPicks[matchupId].defense = play as DefensivePlayId
  }

  // Check if both picks are in
  const picks = downPicks[matchupId]
  const resolved = picks.offense !== undefined && picks.defense !== undefined
  return { resolved, matchupId }
}

/**
 * Resolve a single matchup's down. Updates driveStates in place.
 * Returns the updated DriveState.
 */
export function resolveMatchupDown(matchupId: string): DriveState {
  const drive = driveStates![matchupId]
  const picks = downPicks[matchupId]

  const { state: newState } = resolveDown(
    drive,
    picks.offense!,
    picks.defense!,
    Math.random,
    DEFAULT_PLAY_CONFIG,
    DEFAULT_PLAY_MATRIX
  )

  driveStates![matchupId] = newState
  return newState
}

/**
 * Fill missing picks with random plays for timeout scenarios.
 */
export function fillMissingPicks(): string[] {
  const resolvedMatchups: string[] = []

  if (!driveStates) return resolvedMatchups

  for (const [matchupId, drive] of Object.entries(driveStates)) {
    if (drive.isComplete) continue

    if (!downPicks[matchupId]) {
      downPicks[matchupId] = {}
    }

    const picks = downPicks[matchupId]
    if (picks.offense === undefined) {
      picks.offense = selectRandomPlay(OFFENSIVE_PLAYS, Math.random) as OffensivePlayId
    }
    if (picks.defense === undefined) {
      picks.defense = selectRandomPlay(DEFENSIVE_PLAYS, Math.random) as DefensivePlayId
    }

    resolvedMatchups.push(matchupId)
  }

  return resolvedMatchups
}

/**
 * Check if all active (non-complete) drives have been resolved for this down cycle.
 */
export function allDrivesComplete(): boolean {
  if (!driveStates) return true
  return Object.values(driveStates).every(d => d.isComplete)
}

/**
 * Get matchup IDs for drives still in progress.
 */
export function getActiveDriveMatchups(): string[] {
  if (!driveStates) return []
  return Object.entries(driveStates)
    .filter(([_, d]) => !d.isComplete)
    .map(([id]) => id)
}
```

### 4. Room.ts Integration — Down Loop

The room needs a playcaller-specific path that bypasses the standard `resolveRound` call:

```typescript
// In room.ts — new method for playcaller down loop

/**
 * Enter the playcaller per-down picking phase.
 * Resets picks, sets a new deadline, and broadcasts state.
 */
private beginPlaycallerDown() {
  clearDownPicks()

  this.state.round = {
    ...this.state.round,
    phase: "PICKING",
    picks: {},
    pickDeadlineMs: Date.now() + PLAYCALLER.PICK_WINDOW_MS,
  }

  this.broadcastState()

  // Schedule bot picks for bots in active matchups
  this.schedulePlaycallerBotPicks()

  // Schedule play clock expiry
  this.scheduleResolve(PLAYCALLER.PICK_WINDOW_MS)
}

/**
 * Handle play_selection message for playcaller down loop.
 */
private handlePlaySelection(sender: Party.Connection, payload: { matchupId: string; play: string }) {
  const playerId = this.getPlayerIdByConnectionId(sender.id)
  if (!playerId) {
    this.sendError(sender, "NOT_IN_ROOM", "Player not found")
    return
  }

  if (this.state.round.phase !== "PICKING") {
    this.sendError(sender, "WRONG_PHASE", "Not in picking phase")
    return
  }

  const result = recordPlaySelection(playerId, payload.matchupId, payload.play as any)

  if ("error" in result) {
    // "Already picked" is silently ignored per requirement 9.1
    if (result.error !== "Already picked") {
      this.sendError(sender, "INVALID_PICK", result.error)
    }
    return
  }

  // Send PICK_ACK
  const ackMsg: ServerMessage = { type: "PICK_ACK", payload: { playerId } }
  sender.send(JSON.stringify(ackMsg))

  if (result.resolved) {
    // Resolve this matchup's down
    const newState = resolveMatchupDown(result.matchupId)
    this.broadcastState()

    // Check if all drives are now complete
    if (allDrivesComplete()) {
      this.cancelDeadlineTimer()
      this.advancePlaycallerBracket()
    }
    // If all active matchups have both picks resolved for this down cycle,
    // begin a new down (or wait for remaining matchups)
  }
}

/**
 * Handle play clock expiry for playcaller down loop.
 */
private resolvePlaycallerTimeout() {
  if (this.state.round.phase !== "PICKING") return

  this.cancelDeadlineTimer()

  // Fill missing picks with random plays
  const matchupsToResolve = fillMissingPicks()

  // Resolve all matchups that now have both picks
  for (const matchupId of matchupsToResolve) {
    resolveMatchupDown(matchupId)
  }

  // Clear picks for next down
  clearDownPicks()

  // Check if all drives complete
  if (allDrivesComplete()) {
    this.advancePlaycallerBracket()
  } else {
    // Start next down
    this.beginPlaycallerDown()
  }
}

/**
 * Advance the bracket after all drives in the round complete.
 */
private advancePlaycallerBracket() {
  // Determine winners from drive completions
  const drives = getDriveStates()!
  const winners: Record<string, string> = {}

  for (const [matchupId, drive] of Object.entries(drives)) {
    winners[matchupId] = drive.completion!.winner
  }

  // Advance bracket using the drive winners
  const bracket = getPlaycallerState()!
  // Apply winners to current round matchups
  const currentRound = bracket.rounds[bracket.currentRoundIndex]
  for (const matchup of currentRound.matchups) {
    matchup.winner = winners[matchup.id] ?? matchup.winner
  }

  // Use resolveCurrentRound with a resolver that returns the pre-determined winner
  const driveResolver = (playerA: string, playerB: string): string => {
    const matchup = currentRound.matchups.find(
      m => (m.playerA === playerA && m.playerB === playerB) ||
           (m.playerA === playerB && m.playerB === playerA)
    )
    return matchup ? winners[matchup.id] : playerA
  }

  const updatedBracket = resolveCurrentRound(bracket, driveResolver)
  setPlaycallerState(updatedBracket)

  // Reset drive states
  resetDriveStates()

  // Transition to RESULT
  const currentRoundIndex = updatedBracket.currentRoundIndex - 1
  const resolvedRound = updatedBracket.rounds[currentRoundIndex]

  this.state.round.phase = "RESULT"
  this.state.round.result = {
    bracketRound: currentRoundIndex,
    matchups: resolvedRound.matchups,
    isComplete: isComplete(updatedBracket),
  }
  this.state.round.resolvedAt = Date.now()

  // Score if tournament complete
  if (isComplete(updatedBracket)) {
    const plugin = registry.lookup("playcaller")
    const scoreResult = plugin.scoreRound(
      {},
      this.state.round.result,
      Object.values(this.state.players),
      this.state.gameSettings
    )
    for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
      this.state.gameScores[playerId] = (this.state.gameScores[playerId] ?? 0) + delta
    }
    this.state.gameLeaderboard = plugin.computeGameLeaderboard(
      Object.values(this.state.players),
      this.state.gameScores
    )
  }

  this.broadcastState()
}
```

### 5. BotManager — Playcaller Case

Add a `playcaller` case to `generatePicks` in BotManager:

```typescript
case "playcaller": {
  // Bot picks are handled per-down by schedulePlaycallerBotPicks in room.ts
  // This case is a no-op for the standard scheduleBotPicks path
  break
}
```

New method in room.ts for per-down bot picks:

```typescript
/**
 * Schedule bot picks for the playcaller down loop.
 * Bots in active matchups submit a random play after a short delay.
 */
private schedulePlaycallerBotPicks() {
  this.cancelBotPickTimers()

  const botIds = this.botManager.getBotIds()
  const activeDrives = getDriveStates()
  if (!activeDrives || botIds.length === 0) return

  for (const [matchupId, drive] of Object.entries(activeDrives)) {
    if (drive.isComplete) continue

    for (const botId of botIds) {
      if (botId !== drive.offensePlayerId && botId !== drive.defensePlayerId) continue

      const isOffense = botId === drive.offensePlayerId
      const delay = 300 + Math.random() * 700 // 300–1000ms delay

      const timerId = setTimeout(() => {
        const play = isOffense
          ? selectRandomPlay(OFFENSIVE_PLAYS, Math.random)
          : selectRandomPlay(DEFENSIVE_PLAYS, Math.random)

        // Submit via the same recordPlaySelection path
        const result = recordPlaySelection(botId, matchupId, play)
        if ("resolved" in result && result.resolved) {
          resolveMatchupDown(result.matchupId)

          if (allDrivesComplete()) {
            this.cancelDeadlineTimer()
            this.advancePlaycallerBracket()
          } else {
            this.broadcastState()
          }
        }
      }, delay)

      this.botPickTimerIds.push(timerId)
    }
  }
}
```

### 6. Room.ts — beginRound Modification

In `beginRound`, after the existing playcaller bracket initialization block, add:

```typescript
// ── Playcaller: start down loop if SKIP_GAMEPLAY is false ──────────
if (this.state.config.gameType === "playcaller" && roundNumber > 0) {
  const skipGameplay = this.state.gameSettings.tuning?.SKIP_GAMEPLAY !== false

  if (!skipGameplay) {
    // Initialize drives for current bracket round
    const bracket = getPlaycallerState()!
    const currentRound = bracket.rounds[bracket.currentRoundIndex]
    initializeDrives(currentRound.matchups)

    // Enter per-down loop instead of standard PICKING
    this.beginPlaycallerDown()
    return
  }
}
```

### 7. Room.ts — handleStartRound Modification

When the host clicks "Next Round" in RESULT phase for playcaller with SKIP_GAMEPLAY=false:

```typescript
// In handleStartRound, after the phase guard:
if (
  this.state.config.gameType === "playcaller" &&
  this.state.round.phase === "RESULT" &&
  this.state.gameSettings.tuning?.SKIP_GAMEPLAY === false
) {
  // Initialize next bracket round drives
  const bracket = getPlaycallerState()!
  if (!isComplete(bracket)) {
    const currentRound = bracket.rounds[bracket.currentRoundIndex]
    initializeDrives(currentRound.matchups)
    this.state.round.roundNumber++
    this.beginPlaycallerDown()
    return
  }
}
```

### 8. PlaycallerGameState Broadcasting

The `getPublicState` method already builds `PlaycallerGameState`. Extend it to include driveStates:

```typescript
// In getPublicState, within the playcaller section:
if (this.state.config.gameType === "playcaller") {
  const bracket = getPlaycallerState()
  const playcallerState: PlaycallerGameState = {
    bracket: bracket!,
    spectators: getSpectators(),
    activeCompetitors: getActiveCompetitors(),
    driveStates: getDriveStates() ?? null,
  }
  // Include in public state payload
}
```

### 9. Message Type Extension

Add `play_selection` to the `ClientMessage` union in shared types:

```typescript
// In packages/shared/src/types.ts
| { type: "play_selection"; payload: { matchupId: string; play: string } }
```

## Data Flow

### Per-Down Cycle

1. `beginPlaycallerDown()` → sets phase=PICKING, deadline=now+3000, broadcasts
2. Players/bots submit `play_selection` messages
3. `recordPlaySelection()` validates and stores in `downPicks`
4. When both picks arrive for a matchup → `resolveMatchupDown()` → updates `driveStates`
5. Broadcast updated state
6. If all drives complete → `advancePlaycallerBracket()`
7. If not all complete → when all active matchups resolved this down → `beginPlaycallerDown()` for next down
8. On timeout → `fillMissingPicks()` → resolve all → next down or advance bracket

### State Relationships

```
bracketState (Bracket)           — tournament bracket structure
driveStates (Record<matchupId, DriveState>) — current round's active drives
downPicks (Record<matchupId, {offense?, defense?}>) — current down's picks
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Player submits to wrong matchup | Reject with error |
| Player submits wrong role play | Reject with error |
| Duplicate pick same down | Silently ignore |
| Play clock expires | Auto-fill with `selectRandomPlay` |
| Drive already complete | Skip matchup in picking loop |
| Invalid play string | Reject with error |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Drive initialization produces correct structure

*For any* set of bracket matchups with distinct player pairs, calling `initializeDrives` SHALL produce a Record where: (a) the keys exactly match the matchup IDs, (b) each DriveState has `offensePlayerId` and `defensePlayerId` equal to the two players in the matchup (in either order), and (c) `offensePlayerId !== defensePlayerId`.

**Validates: Requirements 1.1, 1.2, 1.3, 10.1, 10.2**

### Property 2: SKIP_GAMEPLAY=true produces null driveStates

*For any* bracket round resolved with `SKIP_GAMEPLAY=true`, the `driveStates` field in the broadcast PlaycallerGameState SHALL be `null`, and matches SHALL resolve via the random resolver.

**Validates: Requirements 1.4**

### Property 3: Invalid play selections are rejected

*For any* `play_selection` message where the player does not belong to the specified matchup, OR the player has already submitted a pick for the current down, OR the play does not match the player's assigned role (offensive play set for offense, defensive play set for defense), `recordPlaySelection` SHALL return an error and the `downPicks` state SHALL remain unchanged.

**Validates: Requirements 2.3, 2.4, 2.5, 9.1**

### Property 4: Both picks trigger resolution with correct state update

*For any* matchup in an active drive where both offense and defense picks are recorded, calling `resolveMatchupDown` SHALL update the stored DriveState to equal the output of `resolveDown(previousState, offensivePick, defensivePick, rng, config, matrix)`.

**Validates: Requirements 3.1, 3.2**

### Property 5: Down loop phase transitions are correct

*For any* down resolution: if the drive is NOT complete, the system SHALL transition back to PICKING phase for the next down; if ALL drives in the round are complete, the system SHALL transition to RESULT phase. Completed matchups SHALL be excluded from subsequent pick windows.

**Validates: Requirements 3.3, 3.4, 3.5**

### Property 6: Timeout preserves existing picks and fills missing

*For any* set of per-down picks at play clock expiry, `fillMissingPicks` SHALL assign a valid random play only to roles that have NOT yet submitted, and all previously submitted picks SHALL remain unchanged.

**Validates: Requirements 4.1, 4.2**

### Property 7: Bot picks are valid for assigned role

*For any* bot in an active matchup, the generated play SHALL be a member of `OFFENSIVE_PLAYS` if the bot is assigned offense, or `DEFENSIVE_PLAYS` if the bot is assigned defense.

**Validates: Requirements 5.1, 5.2**

### Property 8: Bracket advancement uses drive completion winners

*For any* completed round where all drives have a `DriveCompletion`, the bracket SHALL advance using exactly the `completion.winner` from each matchup's DriveState as the winner of that matchup.

**Validates: Requirements 6.1**

### Property 9: Broadcast contains all required fields

*For any* PlaycallerGameState broadcast when SKIP_GAMEPLAY is false, the payload SHALL include: `bracket` (non-null), `spectators` (array), `activeCompetitors` (array), and `driveStates` (Record with current drive data for each active matchup).

**Validates: Requirements 7.1, 7.2**

### Property 10: Per-down deadline and picks reset between downs

*For any* down resolution that does NOT end all drives, the subsequent PICKING phase SHALL have: `pickDeadlineMs` set to approximately `now + PICK_WINDOW_MS`, and `downPicks` cleared to an empty record for all active matchups.

**Validates: Requirements 8.4, 9.2**

### Property 11: Offense/defense roles are immutable within a drive

*For any* sequence of downs within a single matchup drive, the `offensePlayerId` and `defensePlayerId` values SHALL remain identical across all DriveState snapshots from first down through completion.

**Validates: Requirements 10.3**
