# Implementation Plan: Games of Chance — Live Multiplayer Web Suite

## Overview

Implementation follows three sequential milestones. Each milestone is a hard stop — validate before proceeding. The stack is TypeScript throughout: React/Vite/Tailwind/Zustand client, `@cloudflare/partykit` server, pnpm workspace monorepo. **CRITICAL**: Use `@cloudflare/partykit` for the server and `partysocket` for the client. The defunct `partykit` package MUST NOT be used anywhere.

## Tasks

---

### MILESTONE 1: Runnable Lobby

---

- [x] 1. Scaffold monorepo and project infrastructure
  - [x] 1.1 Initialize pnpm workspace with `shared`, `client`, and `server` packages
    - Create root `package.json` with `"workspaces"` field pointing to `packages/*`
    - Create root `pnpm-workspace.yaml` listing `packages/*`
    - Create root `tsconfig.json` with project references
    - Create `packages/shared/package.json` with name `@games-of-chance/shared`
    - Create `packages/client/package.json` with Vite, React 18, Tailwind CSS, Zustand, Framer Motion, `partysocket`, react-router-dom dependencies
    - Create `packages/server/package.json` with `@cloudflare/partykit` dependency — **the defunct `partykit` package MUST NOT appear**
    - Both `client` and `server` depend on `@games-of-chance/shared`
    - Create `partykit.json` at repo root specifying server entry point
    - _Requirements: 1.1, 1.5, 1.6, 1.7_

  - [x] 1.2 Configure Vite + React + Tailwind for the client package
    - Initialize Vite with React-TS template in `packages/client`
    - Configure Tailwind CSS with `tailwind.config.ts`
    - Set up `postcss.config.js`
    - Create `src/main.tsx` entry point and `src/App.tsx` with react-router-dom (routes: `/` and `/:roomId`)
    - Configure `PARTYKIT_HOST` env variable in Vite config
    - _Requirements: 1.3, 22.1_

- [x] 2. Define shared types package
  - [x] 2.1 Create all shared TypeScript types in `packages/shared/src/types.ts`
    - Export: `Player`, `RoomConfig`, `RoomState`, `RoundState`, `RoundPhase` (exactly `"LOBBY" | "PICKING" | "RESOLVING" | "RESULT"` — NO `BETWEEN_ROUNDS`)
    - Export: `GameLeaderboardEntry`, `SessionLeaderboardEntry`, `RoundScoreResult`, `ScoreModifier`
    - Export: `ScoringMode` (`"grand-prix" | "chips"`), `SessionScoringStrategy` interface, `SessionUpdate`
    - Export: `ClientMessage` and `ServerMessage` discriminated union types covering all message types (JOIN, SUBMIT_PICK, START_ROUND, END_GAME, SET_AUTO_MODE, KICK_PLAYER, LINK_PLAYER for ClientMessage; STATE_SYNC, PICK_ACK, ERROR for ServerMessage)
    - Export: `GameType` string type
    - `Player.connectionId` is `string | null` for future host-assisted reconnection
    - _Requirements: 1.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 2.2 Create coin-toss-specific shared types in `packages/shared/src/games/coin-toss/types.ts`
    - Export: `CoinSide` (`"HEADS" | "TAILS"`), `CoinTossPick` (`{ side: CoinSide }`), `CoinTossResult` (`{ outcome: CoinSide, flippedAt: number }`)
    - _Requirements: 7.5_

- [x] 3. Implement PartyServer with lobby-only logic
  - [x] 3.1 Create GamePlugin interface and GameRegistry in `packages/server/src/games/`
    - Define `GamePlugin<TPick, TResult>` interface with `validatePick`, `resolveRound`, `scoreRound`, `computeGameLeaderboard`, `pickWindowMs`
    - Implement `GameRegistry` class with `register`, `lookup`, `list` methods
    - _Requirements: 8.3_

  - [x] 3.2 Implement PartyServer room class (`packages/server/src/room.ts`)
    - Implement `PartyServer` interface from `@cloudflare/partykit/server` using class-based pattern with `onStart`, `onConnect`, `onMessage`, `onClose`
    - On first connection: initialize room state with phase `LOBBY`, roundNumber 0, empty picks, empty leaderboards
    - On new connection: send full STATE_SYNC to that client immediately
    - Handle `JOIN` message: create player, assign host role to first joiner or explicit host when no host exists, demote duplicate host attempts to `"player"`, reject when at `maxPlayers` capacity with `ERROR { code: "ROOM_FULL" }`
    - Handle disconnect (`onClose`): mark player `connected: false`, set `connectionId: null`, promote first connected player to host if host disconnected, broadcast STATE_SYNC
    - Implement `cancelDeadlineTimer()` as an idempotent method (safe to call at any time — no-op if no timer)
    - Implement `broadcastState()` — sends full STATE_SYNC to all connections
    - Wire message dispatch for JOIN only (other message types return ERROR until M2)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.5, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 3.3 Write property tests for host uniqueness and phase ordering
    - **Property 3: Host Uniqueness** — For any sequence of player joins and disconnects, exactly one connected player holds `"host"` role when room is non-empty.
    - **Property 6: Phase Ordering** — Phase transitions follow only the permitted DAG. Room initializes in LOBBY.
    - **Validates: Requirements 4.1, 4.2, 4.3, 9.1, 9.4, 12.1**

- [x] 4. Implement client landing page and room creation
  - [x] 4.1 Create LandingPage component at `packages/client/src/pages/LandingPage.tsx`
    - Display "Create Room" button and "Join Room" input field
    - On "Create Room": generate UUID v4 Room_ID, navigate to `/:roomId`
    - On "Join Room" submit: navigate to `/:roomId` using entered code
    - Mobile-first responsive layout with Tailwind
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 22.1_

  - [x] 4.2 Create Zustand store (`packages/client/src/store/useGameStore.ts`)
    - Define `JoinState` type: `"NAME_ENTRY" | "CONNECTING" | "IN_ROOM"`
    - Store fields: `joinState`, `roomId`, `playerId`, `playerName`, `role`, `connectionStatus`, `roomState`, `pickSubmitted`, `currentRoundNumber`
    - Actions: `connect`, `submitPick`, `startRound`, `_onStateSync`, `_resetPickOnNewRound`
    - `_onStateSync`: on new `roundNumber` detected, reset `pickSubmitted` to false
    - `joinState` MUST NOT transition backwards from `IN_ROOM` within same session (non-regression guard)
    - _Requirements: 3.4, 3.6, 11.4, 16.3_

  - [x] 4.3 Create RoomPage with single-route join state machine (`packages/client/src/pages/RoomPage.tsx`)
    - **CRITICAL — Single-route state machine pattern to prevent infinite loop bug:**
    - This is ONE component at `/:roomId` that manages internal states: `NAME_ENTRY → CONNECTING → IN_ROOM`
    - **NO route changes occur after entering `/:roomId`** — all transitions are component-internal state changes only
    - `NAME_ENTRY`: render name input form, do NOT attempt WebSocket connection
    - On name submit: transition to `CONNECTING`, show loading spinner, establish PartySocket connection
    - `CONNECTING → IN_ROOM`: when STATE_SYNC received with player in roster, transition to `IN_ROOM` **permanently** for that browser session
    - `CONNECTING → NAME_ENTRY`: only on connection error (display error message)
    - `IN_ROOM`: render LobbyShell — NEVER transition back to NAME_ENTRY or CONNECTING
    - Direct URL navigation to `/:roomId` (shared link) renders the join flow without requiring landing page
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1_

  - [x] 4.4 Create PartySocket hook (`packages/client/src/hooks/usePartySocket.ts`)
    - Use `PartySocket` from `partysocket` package (NOT `partykit`) with automatic reconnection
    - Configure exponential backoff: initial 500ms, doubling each attempt, capped at 30,000ms
    - On `STATE_SYNC` received: call `store._onStateSync`, check if player is in roster → transition to `IN_ROOM`
    - On `PICK_ACK`: no-op (pickSubmitted already set optimistically)
    - On `ERROR`: dispatch to error handler
    - Track `connectionStatus`: `"connecting" | "connected" | "disconnected" | "error"`
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 5. Implement lobby UI components
  - [x] 5.1 Create LobbyShell, PlayerList, and ConnectionStatus components
    - `LobbyShell`: always-visible wrapper around lobby content and game view
    - `PlayerList`: show each player's name, host badge (crown icon for host), connection status indicator (green=connected, grey=disconnected), current session score (initialized to 0)
    - `ConnectionStatus`: show `"connecting"`, `"connected"`, `"disconnected"`, or `"error"` states
    - _Requirements: 6.2, 6.7, 5.4, 21.6_

  - [x] 5.2 Create ShareLink, GameTileGrid, and HostControls components
    - `ShareLink`: prominent share card with room URL + copy button for host; compact copy-icon button for non-host players
    - `GameTileGrid`: board-game-cover style card grid. "Coin Toss" tile is active/selectable; other tiles show "Coming Soon" with dimmed overlay
    - `HostControls`: "Start Game" button visible ONLY to host, ONLY when `phase ∈ {"LOBBY", "RESULT"}` (phase guard)
    - All components use Tailwind for mobile-first responsive layout, no horizontal scroll on ≥375px viewports
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 16.1, 22.3_

- [x] 6. Milestone 1 Checkpoint
  - Ensure all packages compile without type errors (`pnpm build`)
  - Test join flow: confirm NAME_ENTRY → CONNECTING → IN_ROOM transitions work without navigation loops
  - Test multiple players can join the same room and see each other in the player list
  - Test host badge (crown) shows correctly for the first player who created the room
  - Test host promotion: disconnect the host, confirm another player is promoted
  - Test share link: host sees prominent card, non-host sees compact icon
  - Ask the user if questions arise.

---

### MILESTONE 2: Coin Toss Game Play

---

- [ ] 7. Implement CoinTossPlugin constants and plugin
  - [ ] 7.1 Create tuning constants file at `packages/server/src/games/coin-toss/constants.ts`
    - Export single `as const` object named `COIN_TOSS` with UPPER_SNAKE_CASE keys
    - Values: `CORRECT_GUESS_CHIPS: 10`, `PICK_WINDOW_MS: 10_000`, `STREAK_MULTIPLIER: 2` (future), `STREAK_THRESHOLD: 3` (future), `MAX_MULTIPLIER: 5` (future)
    - Each value has JSDoc comment; future values annotated with `(future)`
    - **This file MUST be created BEFORE the plugin implementation**
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 7.2 Implement CoinTossPlugin at `packages/server/src/games/coin-toss/CoinTossPlugin.ts`
    - Import all tuning values from `./constants` — NO inline magic numbers
    - `validatePick`: accepts only objects with `side === "HEADS" || side === "TAILS"`
    - `resolveRound`: determine outcome via `Math.random() < 0.5` — independent of submitted picks (fair coin)
    - `scoreRound`: return `RoundScoreResult` with `deltas[playerId] = CORRECT_GUESS_CHIPS` for connected players whose pick matches outcome, `0` for all others (including no-pick)
    - `computeGameLeaderboard`: filter to connected players, sort by score descending, assign ranks with ties getting equal rank
    - `pickWindowMs`: import from `COIN_TOSS.PICK_WINDOW_MS`
    - Register plugin in GameRegistry
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 14.1, 14.2, 14.3, 14.4, 15.3_

  - [ ]* 7.3 Write property tests for CoinTossPlugin scoring
    - **Property CT-2: Scoring Per Player** — For any (picks, result, players) triple, `scoreRound` returns deltas of exactly `CORRECT_GUESS_CHIPS` (10) for correct picks and 0 for all others.
    - **Property CT-5: Score Floor** — No connected player receives a negative delta.
    - **Property CT-6: Score Ceiling** — No connected player receives a delta greater than `CORRECT_GUESS_CHIPS`.
    - **Validates: Requirements 12.5**

  - [ ]* 7.4 Write property tests for CoinTossPlugin validation and fairness
    - **Property CT-1: Fair Coin** — `resolveRound` outcome is always a valid `CoinSide` regardless of picks input.
    - **Property CT-3: Validation Exclusivity** — `validatePick` returns true if and only if value is `{ side: "HEADS" }` or `{ side: "TAILS" }`.
    - **Validates: Requirements 11.6, 12.3**

- [ ] 8. Implement START_ROUND handler and round lifecycle on server
  - [ ] 8.1 Implement `beginRound()` and `START_ROUND` message handler
    - On `START_ROUND` from host when `phase ∈ {"LOBBY", "RESULT"}`: call `beginRound()`
    - `beginRound()`: cancel any lingering timer, set phase to `PICKING`, increment roundNumber, reset picks to empty, set `pickDeadlineMs = now() + plugin.pickWindowMs`, broadcast STATE_SYNC, schedule deadline timer via `scheduleResolve(plugin.pickWindowMs)`
    - Reject non-host with `ERROR { code: "NOT_HOST" }`
    - Reject wrong phase with `ERROR { code: "WRONG_PHASE" }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 8.2 Implement `SUBMIT_PICK` handler with PICK_ACK
    - Guard: reject if `phase ≠ "PICKING"` with `ERROR { code: "WRONG_PHASE" }`
    - Guard: reject if `currentTime > pickDeadlineMs` with `ERROR { code: "DEADLINE_PASSED" }`
    - Guard: silently ignore if player already has a pick recorded (pick immutability)
    - Validate pick via `plugin.validatePick()` — reject invalid with `ERROR { code: "INVALID_PICK" }`
    - Record pick, send `PICK_ACK` to sender
    - After recording: check if all connected players have picked — if yes, `cancelDeadlineTimer()` then `scheduleResolve(0)` for immediate resolution
    - _Requirements: 10.3, 10.4, 11.3, 11.5, 11.6, 11.7_

  - [ ] 8.3 Implement `resolveRound()` with timer cancellation and idempotency guard
    - **CRITICAL — prevents the double-fire bug from first implementation:**
    - **Idempotency guard**: If `phase ≠ "PICKING"` at time of call, perform NO state mutation — return immediately (no-op). Both timer-expiry and "all-picks-in" may call this; only the first takes effect.
    - **Timer cancellation**: Call `cancelDeadlineTimer()` BEFORE any resolution logic executes, regardless of whether called from timer expiry or early resolve.
    - Transition phase to `RESOLVING`, broadcast STATE_SYNC
    - Call `plugin.resolveRound(picks)` to get result
    - Call `plugin.scoreRound(picks, result, players)` to get `RoundScoreResult`
    - Apply deltas to `gameScores`
    - Call `plugin.computeGameLeaderboard()` to update game leaderboard
    - Transition phase to `RESULT`, store result and `resolvedAt` timestamp, broadcast STATE_SYNC
    - _Requirements: 10.2, 10.4, 10.5, 12.1, 12.2, 12.4, 12.5, 12.6, 13.1, 13.2_

  - [ ]* 8.4 Write property tests for resolveRound idempotency and timer cancellation
    - **Property 14: resolveRound Idempotency** — Calling resolveRound when `phase ≠ "PICKING"` produces no state change (no score updates, no phase transition, no broadcast).
    - **Property 22: Timer Cancellation on Early Resolve** — When all players submit picks before deadline, the timer is cancelled before resolveRound executes.
    - **Validates: Requirements 10.4, 12.6**

  - [ ] 8.5 Implement `END_GAME` handler and disconnection during PICKING phase
    - `END_GAME`: accept only from host when `phase ∈ {"RESULT", "LOBBY"}` — transition to LOBBY, reset game scores and game leaderboard, broadcast STATE_SYNC
    - Disconnection during PICKING: if all remaining connected players have submitted picks after a disconnect, call `cancelDeadlineTimer()` then proceed to immediate resolution
    - Host disconnect during PICKING: suspend pick deadline timer until new host present
    - Retain disconnected player's pick for scoring if already recorded
    - _Requirements: 17.3, 17.4, 24.1, 24.2, 24.3, 4.5_

  - [ ]* 8.6 Write property tests for pick immutability and authorization guards
    - **Property 2: Pick Immutability** — For any player who has received PICK_ACK, subsequent SUBMIT_PICK messages leave the stored pick unchanged.
    - **Property 8: Authorization Guards** — For any non-host player, START_ROUND or END_GAME returns ERROR with no state change.
    - **Property 9: Pick Window Enforcement** — SUBMIT_PICK after deadline returns ERROR and is not recorded.
    - **Validates: Requirements 9.3, 10.3, 11.5, 17.4**

- [ ] 9. Implement client game UI — pick widget and countdown
  - [ ] 9.1 Create CoinTossContainer component (`packages/client/src/games/coin-toss/CoinTossContainer.tsx`)
    - Reads `roomState.round` from Zustand store
    - **Phase guards — prevents "Start Round" appearing during active rounds bug:**
    - Renders `PickWidget` ONLY when `phase === "PICKING"` AND `pickSubmitted === false`
    - Renders `PickLockIndicator` when `phase === "PICKING"` AND `pickSubmitted === true`
    - Renders `CoinFlipAnimation` during `RESOLVING` and `RESULT` phases
    - Renders `ResultDisplay` once animation completes (via `onAnimationComplete` callback)
    - _Requirements: 16.2, 16.3_

  - [ ] 9.2 Create PickWidget with countdown timer (`packages/client/src/games/coin-toss/PickWidget.tsx`)
    - Display Heads and Tails buttons — minimum tap target height 64px on mobile
    - **Phase guard**: component ONLY renders when `phase === "PICKING"` AND `pickSubmitted === false`
    - Show countdown timer derived from `pickDeadlineMs - Date.now()`
    - On button click: send `SUBMIT_PICK { pick: { side: "HEADS" | "TAILS" } }`, immediately set `pickSubmitted = true` in store (optimistic)
    - After pick submitted, buttons disappear and PickLockIndicator shows
    - Full-width buttons on mobile, Tailwind responsive
    - _Requirements: 10.1, 11.1, 11.2, 11.4, 22.2_

- [ ] 10. Implement client result display and game leaderboard
  - [ ] 10.1 Create placeholder animation assets (sprites + motion variants)
    - Create `packages/client/src/games/coin-toss/assets/sprites/coin-heads.svg` — simple circular SVG with distinct "H" face, subtle gradient, drop shadow
    - Create `packages/client/src/games/coin-toss/assets/sprites/coin-tails.svg` — simple circular SVG with distinct "T" face
    - Create `packages/client/src/games/coin-toss/assets/sprites/coin-edge.svg` — thin edge view
    - Create `packages/client/src/games/coin-toss/assets/animations/flipVariants.ts` — Framer Motion variants for `idle`, `flipping`, `landed` states (declarative config, separate from sprites and components)
    - Assets are designed to be easily swappable without logic changes
    - _Requirements: 18.5, 18.6_

  - [ ] 10.2 Create CoinFlipAnimation component (`packages/client/src/games/coin-toss/CoinFlipAnimation.tsx`)
    - Import sprites from `assets/sprites/` and motion variants from `assets/animations/flipVariants.ts`
    - Use `result.flippedAt` timestamp to synchronize animation start across clients
    - If `flippedAt` is in the past (reconnection): skip animation, show final result face immediately
    - 3D CSS `rotateY` transform with Framer Motion spring physics
    - Land on Heads or Tails face based on `result.outcome`
    - Fire `onAnimationComplete` callback when animation finishes
    - Size to `40vmin` for portrait and landscape compatibility
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 22.5_

  - [ ] 10.3 Create ResultDisplay component (`packages/client/src/games/coin-toss/ResultDisplay.tsx`)
    - Show outcome prominently (Heads or Tails label)
    - List players who picked correctly (winners)
    - Show +10 / 0 score delta per player
    - Fades in after CoinFlipAnimation completes
    - Vertically stacked layout on mobile viewports
    - _Requirements: 13.3, 13.4, 22.4_

  - [ ] 10.4 Create GameLeaderboard component (`packages/client/src/components/game/GameLeaderboard.tsx`)
    - Render game leaderboard: player name, game score, rank for each entry
    - Update on each STATE_SYNC
    - Only connected players appear
    - _Requirements: 14.5_

- [ ] 11. Implement host round controls with phase guards
  - [ ] 11.1 Create RoundControls component (`packages/client/src/components/game/RoundControls.tsx`)
    - **Phase guard — prevents "Start Round" appearing during active rounds bug:**
    - "Start Round" button: rendered ONLY when `phase ∈ {"LOBBY", "RESULT"}` AND `role === "host"`
    - "Next Round" button: rendered ONLY when `phase === "RESULT"` AND `role === "host"` (sends START_ROUND)
    - "End Game" button: rendered ONLY when `phase === "RESULT"` AND `role === "host"` (sends END_GAME)
    - None of these buttons render during PICKING or RESOLVING phases
    - Sends appropriate ClientMessage through PartySocket
    - _Requirements: 9.1, 16.1, 16.4, 17.1, 17.2_

  - [ ] 11.2 Wire GameView shell and integrate all game components
    - `GameView` renders inside `LobbyShell` when a game is active (phase ≠ LOBBY)
    - Contains: `CoinTossContainer` (dynamic per gameType), `GameLeaderboard`, `RoundControls`
    - On `END_GAME` response (phase returns to LOBBY): hide game view, show lobby game tiles again
    - _Requirements: 6.6, 17.3_

  - [ ]* 11.3 Write property tests for game leaderboard and game score monotonicity
    - **Property 4: Game Score Monotonicity** — No player's game-scope score ever decreases between rounds within a single game.
    - **Property 5: Game Leaderboard Rank-1 Consistency** — The player with rank 1 always holds the maximum (or tied-maximum) game score.
    - **Property 11: Game Leaderboard Connected-Players Only** — Computed leaderboard contains entries only for connected players.
    - **Property 12: Leaderboard Tie Rank Equality** — Two players with identical scores get equal rank values.
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

- [ ] 12. Milestone 2 Checkpoint
  - Ensure all tests pass (`pnpm test`)
  - Test full round lifecycle: host starts round → players pick → deadline or all-picks-in → resolve → result displayed
  - Test early resolution: all players pick before deadline, timer is cancelled, round resolves immediately
  - Test resolveRound idempotency: no double-fire from both timer and all-picks-in
  - Test phase guards: "Start Round" button does NOT appear during PICKING or RESOLVING
  - Test pick widget: Heads/Tails buttons only appear during PICKING when pickSubmitted is false
  - Test host "Next Round" and "End Game" buttons only appear in RESULT phase for host
  - Test coin flip animation plays and result display shows after
  - Ask the user if questions arise.

---

### MILESTONE 3: Polish and Session Scoring

---

- [ ] 13. Implement session scoring strategies
  - [ ] 13.1 Create SessionScoringStrategy interface and implementations (`packages/server/src/scoring/`)
    - `SessionScoringStrategy` interface: `applyGameResult(players, gameLeaderboard, rawScores) → SessionUpdate`
    - `GrandPrixStrategy`: award placement points based solely on final `gameLeaderboard` rankings and `placementPoints` table (default `[10, 5, 3, 1, 1, 1, 1, 0, 0, 0]`) — never from raw scores directly
    - `ChipsStrategy`: accumulate raw game deltas directly as session points — no rank-based transformation
    - Both strategies produce monotonically increasing session scores (additive only)
    - Tied players get equal rank values in session leaderboard
    - _Requirements: 19.3, 19.4, 19.5, 19.6, 20.1, 20.3, 20.4_

  - [ ]* 13.2 Write property tests for session scoring strategies
    - **Property 19: Session Points Monotonicity** — No player's sessionPoints ever decreases after any game ends.
    - **Property 20: Placement Points Isolation (GrandPrix)** — Session update derived exclusively from gameLeaderboard rankings and placementPoints table.
    - **Property 21: Chips Mode Direct Accumulation** — Session score update equals sum of raw deltas with no rank transformation.
    - **Validates: Requirements 19.4, 19.5, 20.3**

  - [ ] 13.3 Wire session scoring into END_GAME flow on server
    - On `END_GAME`: look up `SessionScoringStrategy` based on `roomConfig.scoringMode`
    - Call `strategy.applyGameResult(players, gameLeaderboard, gameScores)` to get `SessionUpdate`
    - Update `sessionScores` and `sessionLeaderboard` in room state
    - Reset `gameScores` and `gameLeaderboard` for next game
    - Transition to LOBBY, broadcast STATE_SYNC
    - _Requirements: 20.1, 17.3_

- [ ] 14. Implement session leaderboard and scoring mode selection
  - [ ] 14.1 Add scoring mode selection to room creation flow
    - On LandingPage "Create Room": present scoring mode selector with "GrandPrix" and "Chips" options
    - Store selected mode in `RoomConfig.scoringMode` — set at creation, immutable during session
    - Pass scoring mode to server in JOIN message payload when creating room (host role)
    - _Requirements: 19.1, 19.2_

  - [ ] 14.2 Create SessionLeaderboard component and display on player list
    - Show each player's name, cumulative session points, games played, and rank
    - Update when STATE_SYNC contains new session leaderboard data
    - Tied players show equal rank
    - Display session scores on PlayerList entries
    - _Requirements: 20.2, 20.4, 6.7_

- [ ] 15. Implement reconnection logic
  - [ ] 15.1 Implement client reconnection handling
    - PartySocket already provides exponential backoff (configured in task 4.4)
    - On reconnection established: server sends full STATE_SYNC automatically (already implemented in M1)
    - On reconnect during PICKING phase: restore pick interface with correct deadline countdown from received `pickDeadlineMs`
    - On reconnect during RESULT phase: display current round results and leaderboard from received STATE_SYNC
    - On reconnect with past `flippedAt`: skip animation, show final result immediately
    - Display connection status indicator throughout
    - _Requirements: 21.3, 21.4, 21.5, 21.6_

- [ ] 16. Deployment configuration
  - [ ] 16.1 Configure deployment pipeline
    - Ensure `packages/client` builds to static assets via `vite build` (suitable for Cloudflare Pages)
    - Ensure `packages/server` is deployable via `npx partykit deploy` using `partykit.json`
    - `partykit.json` specifies server entry point and Cloudflare Pages domain for CORS
    - `PARTYKIT_HOST` environment variable resolved at build time in client
    - CORS restricted to configured Pages domain origin
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 17. Milestone 3 Checkpoint — Final
  - Ensure all tests pass (`pnpm test`)
  - Test session scoring: play multiple games, verify GrandPrix awards placement points by rank, Chips accumulates raw deltas
  - Test scoring mode selection at room creation persists for the session
  - Test session leaderboard displays correctly with cumulative scores
  - Test reconnection: disconnect a player mid-PICKING, verify they can reconnect and resume
  - Test full deployment build completes without errors
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 6, 12, 17) are hard stops — validate before proceeding to next milestone
- **CRITICAL BUG GUARDS**:
  - Task 4.3: Single-route state machine pattern (NAME_ENTRY → CONNECTING → IN_ROOM) with NO route changes prevents the infinite loop bug
  - Task 8.3: `cancelDeadlineTimer()` before resolution + idempotency guard prevents the double-fire bug
  - Tasks 9.1, 9.2, 11.1: Phase guards on ALL interactive elements prevent wrong-phase button visibility
  - Tasks 1.1, 4.4: Use `@cloudflare/partykit` and `partysocket` only — the defunct `partykit` package must NOT be used
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Task 7.1 (constants.ts) MUST be completed before task 7.2 (CoinTossPlugin)
- Task 10.1 (animation assets) is separate from task 10.2 (animation component)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "4.2"] },
    { "id": 3, "tasks": ["3.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["3.3", "5.1", "5.2"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "9.1"] },
    { "id": 7, "tasks": ["7.3", "7.4", "8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3", "9.2", "10.1"] },
    { "id": 9, "tasks": ["8.4", "8.5", "10.2", "10.3", "10.4"] },
    { "id": 10, "tasks": ["8.6", "11.1", "11.2"] },
    { "id": 11, "tasks": ["11.3"] },
    { "id": 12, "tasks": ["13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 14, "tasks": ["14.2", "15.1", "16.1"] }
  ]
}
```
