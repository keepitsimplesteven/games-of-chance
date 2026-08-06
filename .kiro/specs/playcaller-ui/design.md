# Design Document: Playcaller UI

## Visual Reference

**Layout comp:** `packages/client/src/pages/FieldCompGrid.tsx` (route: `/field-grid`)

This is the approved visual comp for the Playcaller gameplay screen. Key layout decisions finalized:

- **CSS Grid layout** (not flexbox) — `grid-template-columns: 60fr 40fr`, `grid-template-rows: auto 40dvh auto 33dvh`
- **Row 1**: Header — "QUARTERFINAL" (gold, large) + "You (OFF) vs Bot_2" (right-aligned)
- **Row 2, Col 1**: Field SVG (vertical, end zone at top, 35-yard range) with down/distance above it
- **Row 2, Col 2**: "Other Games" label (not boxed) + stacked mini scoreboards (each in its own bordered card showing player vs player, down & distance, ball position)
- **Row 3**: Play-by-play single line + "History" pill button (opens popover over play cards)
- **Row 4**: 2×2 play card grid (Madden-style SVG art + play name + type label). Cards use `max-h-[5dvh]` for SVG art.
- **History popover**: CSS Grid with `60px | 1fr | 70px` columns to keep play names truly centered. Full-screen backdrop closes on any tap.
- **No scroll** during gameplay — everything fits within `100dvh`
- **Responsive via `dvh` units** — adapts to different phone sizes proportionally

#[[file:packages/client/src/pages/FieldCompGrid.tsx]]

---

## Architecture Overview

The Playcaller UI is a React component tree living at `packages/client/src/games/playcaller/` that renders the Phase 2 interactive drive experience. It consumes `DriveState` from the server (broadcast via `PlaycallerPlugin` → room state → Zustand store) and provides play selection, ball animation, and spectator views.

The architecture follows the existing game plugin pattern (see `big-wheel/`, `coin-toss/`): a top-level container component reads from `useGameStore`, determines the player's role, and routes to the appropriate sub-view.

---

## Component Architecture

```
packages/client/src/games/playcaller/
├── PlaycallerContainer.tsx        # (existing) Top-level router — extended for Phase 2
├── DriveView.tsx                  # Active competitor drive layout (field + cards + result)
├── FieldPanel.tsx                 # Vertical field SVG with animated ball marker
├── BallMarker.tsx                 # Framer Motion animated football element
├── MiniScoreboard.tsx             # Down, distance, yard line, player names
├── PlayCardGrid.tsx               # 2×2 grid of PlayCard components
├── PlayCard.tsx                   # Single play option with SVG art + name
├── PlayResultLine.tsx             # Single-line outcome display + history toggle
├── HistoryDrawer.tsx              # Expandable play-by-play list
├── DriveCompletionOverlay.tsx     # Touchdown/turnover celebration + summary
├── SpectatorGrid.tsx              # (replaces SpectatorView.tsx) Grid of matchup cards
├── SpectatorDriveView.tsx         # Read-only drive view for spectators
├── RoundHeader.tsx                # (existing) Round name + opponent display
├── play-art/
│   ├── types.ts                   # PlayArtData, RouteSegment, PlayerMarker interfaces
│   ├── offense.ts                 # Offensive play art definitions (4 plays × 3 circumstances)
│   ├── defense.ts                 # Defensive play art definitions (4 plays × 3 circumstances)
│   └── PlayArtSvg.tsx            # Renders PlayArtData → inline SVG
├── play-names/
│   ├── types.ts                   # Circumstance enum, PlayNamePool interface
│   ├── classify.ts               # (down, yardsToGo) → Circumstance pure function
│   ├── offense-names.ts          # Offensive play name pools by circumstance
│   └── defense-names.ts          # Defensive play name pools by circumstance
├── animations/
│   ├── types.ts                   # AnimationConfig, BallAnimationVariant interfaces
│   ├── variants.ts               # Framer Motion variant definitions
│   └── timing.ts                 # PlayOutcome → duration mapping
├── hooks/
│   ├── useDriveState.ts          # Extracts DriveState from room state for current matchup
│   ├── useCircumstance.ts        # Derives current Circumstance from DriveState
│   └── usePlayCards.ts           # Combines play art + names + circumstance into card data
├── BracketVisualization.tsx       # (existing) Phase 1 bracket display
├── MatchPanel.tsx                 # (existing) Phase 1 match panel — kept for fallback
└── SideMatchPanels.tsx            # (existing) Phase 1 side panels
```

---

## Data Flow

```
Server (PlaycallerPlugin)
  │
  ├── broadcasts RoomState.playcallerGameState: { bracket, spectators, activeCompetitors, driveStates }
  │
  ▼
Zustand Store (useGameStore)
  │
  ├── roomState.playcallerGameState.driveStates: Record<matchupId, DriveState>
  │
  ▼
PlaycallerContainer
  │
  ├── isActiveCompetitor? → DriveView (full interactive)
  ├── isSpectator? → SpectatorGrid → SpectatorDriveView (read-only)
  └── no driveStates? → BracketVisualization (Phase 1 fallback)
```

### Server Integration

The `PlaycallerGameState` interface will be extended to include drive states:

```typescript
// Extended PlaycallerGameState (shared types)
export interface PlaycallerGameState {
  bracket: Bracket
  spectators: string[]
  activeCompetitors: string[]
  /** Phase 2: per-matchup drive states. Null when SKIP_GAMEPLAY is true. */
  driveStates?: Record<string, DriveState> | null
}
```

Play selections are submitted via the existing `useGameStore.submitPick()` mechanism:

```typescript
// Phase 2 pick payload
interface PlaycallerDrivePick {
  type: "play_selection"
  matchupId: string
  play: OffensivePlayId | DefensivePlayId
}
```

---

## Play Art SVG Data Structure

Play art is stored as structured data and rendered by a single `PlayArtSvg` component. Each play has 3 variants (one per circumstance).

```typescript
// packages/client/src/games/playcaller/play-art/types.ts

/** A point on the play art canvas (0-100 coordinate space) */
interface Point {
  x: number
  y: number
}

/** A single route/path segment */
interface RouteSegment {
  /** Starting position */
  from: Point
  /** Ending position */
  to: Point
  /** Route style: solid arrow, dashed (zone), or curved */
  style: "arrow" | "dashed" | "curved"
  /** Optional: curve control point for curved routes */
  control?: Point
}

/** A player position marker */
interface PlayerMarker {
  /** Position on the canvas */
  position: Point
  /** Shape: circle for skill players, square for linemen */
  shape: "circle" | "square"
  /** Whether this player is highlighted (ball carrier, blitzer) */
  highlighted?: boolean
}

/** Coverage zone (defense only) */
interface CoverageZone {
  /** Center of the zone */
  center: Point
  /** Radius of the zone circle */
  radius: number
  /** Opacity (0-1) */
  opacity: number
}

/** Complete play art definition */
interface PlayArtData {
  /** Player position markers */
  markers: PlayerMarker[]
  /** Route/movement arrows */
  routes: RouteSegment[]
  /** Coverage zones (defense only) */
  zones?: CoverageZone[]
  /** Line of scrimmage Y position (0-100) */
  lineOfScrimmage: number
}

/** Map of play art variants by circumstance */
type PlayArtVariants = Record<Circumstance, PlayArtData>
```

The `PlayArtSvg` component renders this data into an inline SVG with the following structure:
- Line of scrimmage (horizontal line)
- Player markers (circles/squares at positions)
- Route segments (SVG `<path>` elements with arrow markers)
- Coverage zones (semi-transparent circles, defense only)

All colors are derived from the theme's `field` tokens.

---

## Context-Aware Play Naming System

### Circumstance Classification

A pure function maps `(down, yardsToGo)` to a `Circumstance`:

```typescript
// packages/client/src/games/playcaller/play-names/classify.ts

export type Circumstance = "standard" | "short_yardage" | "desperation"

export function classifyCircumstance(down: number, yardsToGo: number): Circumstance {
  if (yardsToGo <= 3) return "short_yardage"
  if (down === 4 && yardsToGo > 5) return "desperation"
  return "standard"
}
```

### Play Name Pools

Each play ID × circumstance has a display name:

```typescript
// packages/client/src/games/playcaller/play-names/types.ts

export interface PlayNameEntry {
  displayName: string
  formation: string  // e.g. "I-Formation", "Shotgun", "4-3 Under"
}

export type PlayNamePool = Record<OffensivePlayId | DefensivePlayId, PlayNameEntry>
export type PlayNameMap = Record<Circumstance, PlayNamePool>
```

Example names by circumstance:

| Play ID | Standard | Short Yardage | Desperation |
|---------|----------|---------------|-------------|
| run-safe | "HB Dive" | "QB Sneak" | "Draw Play" |
| run-aggressive | "Stretch Run" | "Power Sweep" | "Reverse" |
| pass-safe | "Slant Route" | "Quick Out" | "Screen Pass" |
| pass-aggressive | "Fly Route" | "Fade" | "Hail Mary" |

Defense names follow the same pattern with schemes like "Cover 2", "Blitz Package", etc.

---

## Animation System

### Framer Motion Variants

All animations use Framer Motion's `variants` API for declarative control.

```typescript
// packages/client/src/games/playcaller/animations/types.ts

export type BallAnimationType = "run" | "pass" | "turnover" | "touchdown"

export interface BallAnimationConfig {
  type: BallAnimationType
  duration: number         // seconds
  fromY: number           // pixel position (previous yard line)
  toY: number             // pixel position (new yard line)
}
```

### Variant Definitions

```typescript
// packages/client/src/games/playcaller/animations/variants.ts
import { Variants } from "framer-motion"

export const ballVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  run: (config: BallAnimationConfig) => ({
    y: config.toY,
    transition: {
      duration: config.duration,
      ease: "easeInOut",
    },
  }),
  pass: (config: BallAnimationConfig) => ({
    y: config.toY,
    scale: [1, 1.4, 1],
    rotate: [0, 180, 360],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
  turnover: (config: BallAnimationConfig) => ({
    y: config.toY,
    x: [0, -8, 8, -4, 4, 0],
    rotate: [0, -30, 30, -15, 15, 0],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
  touchdown: (config: BallAnimationConfig) => ({
    y: config.toY,
    scale: [1, 1.2, 1.5],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
}

export const playCardVariants: Variants = {
  idle: { scale: 1, opacity: 1, borderColor: "transparent" },
  selected: { scale: 0.95, opacity: 1, borderColor: "var(--accent)" },
  unselected: { scale: 1, opacity: 0.5 },
  disabled: { scale: 1, opacity: 0.6, pointerEvents: "none" },
}

export const historyDrawerVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1 },
}
```

### Timing Configuration

Duration varies by drama level:

```typescript
// packages/client/src/games/playcaller/animations/timing.ts
import type { PlayOutcome } from "@games-of-chance/shared"

export type DramaLevel = "normal" | "high" | "critical"

export function getDramaLevel(outcome: PlayOutcome): DramaLevel {
  switch (outcome) {
    case "critical_success":
    case "interception":
    case "fumble":
      return "critical"
    case "tackle_for_loss":
      return "high"
    default:
      return "normal"
  }
}

export function getAnimationDuration(dramaLevel: DramaLevel): number {
  switch (dramaLevel) {
    case "critical": return 1.2
    case "high": return 0.9
    case "normal": return 0.6
  }
}

export function getBallAnimationType(
  outcome: PlayOutcome,
  playAxis: "run" | "pass"
): BallAnimationType {
  if (outcome === "interception" || outcome === "fumble") return "turnover"
  if (playAxis === "pass") return "pass"
  return "run"
}
```

---

## State Flow: Server DriveState → UI

### Hook: useDriveState

```typescript
// packages/client/src/games/playcaller/hooks/useDriveState.ts

export function useDriveState(matchupId: string): DriveState | null {
  const driveStates = useGameStore(
    (s) => (s.roomState?.playcallerGameState as PlaycallerGameState)?.driveStates
  )
  return driveStates?.[matchupId] ?? null
}
```

### UI State Derivation

From `DriveState`, the UI derives:
1. **Ball position** — `yardLine` → Y pixel coordinate via `(yardLine / maxYards) * fieldHeight`
2. **Down/distance text** — `formatDownDistance(down, yardsToGo)` → e.g. "2nd & 7"
3. **Circumstance** — `classifyCircumstance(down, yardsToGo)` → play names + art variants
4. **Latest result** — `playHistory[playHistory.length - 1]?.result` → Play_Result_Line text
5. **Completion state** — `isComplete && completion` → overlay with summary stats

### Play Result Formatting

```typescript
export function formatPlayResult(result: PlayResult): string {
  const playName = getPlayDisplayName(result.offensivePlay, /* circumstance */)
  if (result.outcome === "interception") return `${playName} — Intercepted!`
  if (result.outcome === "fumble") return `${playName} — Fumble!`
  if (result.outcome === "incomplete_pass") return `${playName} — Incomplete`
  if (result.outcome === "tackle_for_loss") return `${playName} — Loss of ${Math.abs(result.yardsGained)}`
  return `${playName} — ${result.yardsGained} yard${result.yardsGained !== 1 ? "s" : ""}`
}
```

---

## Spectator vs Active Player View Branching

The `PlaycallerContainer` determines view mode:

```typescript
// Decision logic in PlaycallerContainer
const hasDriveStates = !!playcallerGameState?.driveStates
const isSpectator = spectators.includes(playerId)
const isActiveCompetitor = activeCompetitors.includes(playerId)

if (!hasDriveStates) {
  // Phase 1 fallback — no drive engine active
  return <BracketVisualization />
}

if (isActiveCompetitor && playerMatchup) {
  // Full interactive drive view
  return <DriveView matchupId={playerMatchup.matchupId} driveState={...} />
}

if (isSpectator) {
  // Spectator grid with tap-to-view
  return <SpectatorGrid matchups={activeMatchups} driveStates={driveStates} />
}
```

### Spectator Flow

1. **SpectatorGrid** — renders a card per active matchup showing player names + current down/yardLine
2. **Tap** → navigates to `SpectatorDriveView` (same as `DriveView` but with `PlayCardGrid` hidden and a back button)
3. State is local (no URL routing) — managed by a `selectedMatchupId` state in the container

### Active Competitor Flow

1. **DriveView** renders: `RoundHeader` → `FieldPanel + MiniScoreboard` → `PlayResultLine` → `PlayCardGrid`
2. Player taps a `PlayCard` → `submitPick({ type: "play_selection", matchupId, play })` → `pickSubmitted = true`
3. Cards show selected/unselected/disabled states
4. Server resolves the down → new `DriveState` arrives → ball animates, result line updates, new circumstance derived
5. On drive completion → `DriveCompletionOverlay` shows, then signals `roundAnimationDone`

---

## Field Panel Design

The `FieldPanel` builds on the existing `FieldComp.tsx` vertical field SVG:
- Fixed 125px width
- End zone at top (y=0), starting yard line at bottom
- Uses theme `field.*` tokens for colors
- Ball marker is a Framer Motion `motion.g` element with the `ballVariants`

```typescript
// Yard line → Y position mapping (pure function)
export function yardLineToY(
  yardLine: number,
  maxYards: number,
  fieldHeight: number,
  endZoneHeight: number
): number {
  return endZoneHeight + (yardLine / maxYards) * fieldHeight
}
```

---

## Down/Distance Formatting

```typescript
const ORDINALS = ["1st", "2nd", "3rd", "4th"]

export function formatDownDistance(down: number, yardsToGo: number): string {
  const ordinal = ORDINALS[down - 1] ?? `${down}th`
  return `${ordinal} & ${yardsToGo}`
}
```

---

## Round Name Derivation

```typescript
export function getRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundIndex
  if (roundsFromEnd === 1) return "Final"
  if (roundsFromEnd === 2) return "Semifinal"
  if (roundsFromEnd === 3) return "Quarterfinal"
  return `Round ${roundIndex + 1}`
}
```

---

## Drive Summary Stats

When `driveState.isComplete === true`:

```typescript
export function computeDriveSummary(state: DriveState) {
  return {
    totalPlays: state.playHistory.length,
    totalYards: state.playHistory.reduce((sum, entry) => sum + entry.result.yardsGained, 0),
    endingType: state.completion!.endingType,
    winner: state.completion!.winner,
  }
}
```

---

## Error Handling

- **No DriveState available**: Fall back to Phase 1 bracket visualization (Requirement 14.4)
- **Disconnection during play**: `pickSubmitted` persists locally; reconnection re-syncs from server state
- **Invalid play history**: Defensive rendering — if `playHistory` is empty, show "Drive starting..." placeholder
- **Missing player names**: Display player IDs as fallback if name lookup fails

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ball position maps yard line to Y coordinate

*For any* valid yard line value (0 through maxYards), the `yardLineToY` function SHALL produce a Y coordinate equal to `endZoneHeight + (yardLine / maxYards) * fieldHeight`, placing yard line 0 at the top of the playing field and maxYards at the bottom.

**Validates: Requirements 2.2**

### Property 2: Down/distance formatting produces correct ordinal text

*For any* valid down number (1–4) and positive yards-to-go value, the `formatDownDistance` function SHALL produce a string in the format "{ordinal} & {yardsToGo}" where the ordinal is "1st", "2nd", "3rd", or "4th".

**Validates: Requirements 2.4**

### Property 3: Animation variant selection is determined by play outcome and axis

*For any* PlayResult, the `getBallAnimationType` function SHALL return "turnover" for interception or fumble outcomes, "pass" for non-turnover plays with pass axis, and "run" for non-turnover plays with run axis. The animation duration SHALL always be a positive number determined by the drama level of the outcome.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: Play set correctness by player role

*For any* DriveState where the drive is not complete and it is the picking phase, when the current player is on offense the UI SHALL present exactly the 4 offensive play IDs (run-safe, run-aggressive, pass-safe, pass-aggressive), and when on defense SHALL present exactly the 4 defensive play IDs.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: Circumstance classification is exhaustive and deterministic

*For any* valid down (1–4) and positive yards-to-go, the `classifyCircumstance` function SHALL return "short_yardage" when yardsToGo ≤ 3, "desperation" when down === 4 and yardsToGo > 5, and "standard" for all other cases. Every valid (down, yardsToGo) pair maps to exactly one circumstance.

**Validates: Requirements 5.4, 5.5, 5.6, 5.7**

### Property 6: Lock-in disables further play selection

*For any* UI state where `pickSubmitted` is true and the drive is not complete, all play cards SHALL be in a non-interactive (disabled) state, preventing additional submissions for the current down.

**Validates: Requirements 6.3**

### Property 7: Play result formatting includes play name and outcome

*For any* PlayResult, the `formatPlayResult` function SHALL produce a non-empty string containing a recognizable outcome descriptor (yards gained, "Intercepted!", "Fumble!", "Incomplete", or yardage loss).

**Validates: Requirements 7.1**

### Property 8: History drawer shows all play history entries in order

*For any* DriveState with N entries in playHistory (N ≥ 0), the History_Drawer SHALL render exactly N entries in chronological order (index 0 = first play, index N-1 = most recent play).

**Validates: Requirements 7.4**

### Property 9: Scoreboard reflects current drive state

*For any* DriveState, the Mini_Scoreboard SHALL display values equal to `driveState.down`, `driveState.yardsToGo`, and `driveState.yardLine` respectively.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 10: Spectator grid renders one card per active matchup

*For any* set of N active matchups (N ≥ 1), the SpectatorGrid SHALL render exactly N matchup cards, one for each active matchup.

**Validates: Requirements 9.1**

### Property 11: Spectators cannot see or interact with play cards

*For any* spectator viewing any matchup, the play card grid SHALL not be rendered, ensuring zero play card elements are present in the spectator drive view.

**Validates: Requirements 9.3**

### Property 12: Round name derivation is correct for all bracket sizes

*For any* valid (roundIndex, totalRounds) pair where roundIndex < totalRounds, the `getRoundName` function SHALL return "Final" for the last round, "Semifinal" for the second-to-last, "Quarterfinal" for the third-to-last, and "Round N" for all earlier rounds.

**Validates: Requirements 10.1**

### Property 13: Drive summary computes correct totals from play history

*For any* completed DriveState, the `computeDriveSummary` function SHALL return `totalPlays` equal to `playHistory.length` and `totalYards` equal to the sum of all `playHistory[i].result.yardsGained` values.

**Validates: Requirements 11.3**
