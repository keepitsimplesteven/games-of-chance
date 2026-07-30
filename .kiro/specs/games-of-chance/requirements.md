# Requirements Document

## Introduction

Games of Chance is a live multiplayer, browser-based game suite built for mobile-first responsive play. Players join a shared room via a URL, submit picks before a deadline, and receive simultaneous real-time animated results. The architecture uses a monorepo (pnpm workspaces) with a React/Vite frontend hosted on Cloudflare Pages and a `@cloudflare/partykit` PartyServer backend.

The system supports **dual scoring modes** — GrandPrix (rank-based placement points) and Chips (raw score accumulation) — selected by the host at room creation. Game plugins remain scoring-model-agnostic, reporting raw deltas that the session layer interprets.

Implementation follows three milestones: Lobby (M1), Coin Toss game play (M2), and Polish/Scoring (M3).

---

## Glossary

- **System**: The Games of Chance application (frontend + backend).
- **PartyServer**: The `@cloudflare/partykit` Durable Object server that holds live room state and manages WebSocket connections.
- **Client**: The React frontend application running in a player's browser.
- **Room**: A game session identified by a unique Room_ID, managed by a single PartyServer instance.
- **Room_ID**: A high-entropy unique identifier (UUID v4 or equivalent) that identifies a room.
- **Host**: The player who created the room and holds the "host" role; controls game flow.
- **Player**: A connected participant in a room who submits picks and accumulates score.
- **Emcee**: Synonym for Host.
- **GamePlugin**: A server-side module implementing `validatePick`, `resolveRound`, `scoreRound`, and `computeGameLeaderboard` for a specific game type.
- **CoinTossPlugin**: The `GamePlugin` implementation for coin toss.
- **Pick**: A player's selection for the current round (for coin toss: `"HEADS"` or `"TAILS"`).
- **Pick_Window**: The time interval during which players may submit picks, bounded by a deadline.
- **Round**: One complete cycle of PICKING → RESOLVING → RESULT.
- **Phase**: The current state of a room's round state machine; one of `LOBBY`, `PICKING`, `RESOLVING`, `RESULT`.
- **Game**: A single instance of a game type played from start to finish. A room session may contain multiple games.
- **Game_Leaderboard**: Ranked list of players within a single game, sorted by game-specific score. Owned by the GamePlugin. Resets when a new game starts.
- **Session_Leaderboard**: Ranked list of players across all games in a room session. In GrandPrix mode: placement points from rank table. In Chips mode: raw score accumulation.
- **ScoringMode**: One of `"grand-prix"` or `"chips"`, selected by host at room creation.
- **GrandPrix_Mode**: Session scoring that awards placement points based on final game rank (e.g., 1st→10, 2nd→5).
- **Chips_Mode**: Session scoring that directly accumulates raw game deltas as session points.
- **SessionScoringStrategy**: The abstraction implementing scoring logic; `GrandPrixStrategy` and `ChipsStrategy` implement the same interface.
- **Placement_Points**: Points awarded based on final rank in GrandPrix mode. Default table: `[10, 5, 3, 1, 1, 1, 1, 0, 0, 0]`.
- **RoundScoreResult**: The return type of `scoreRound`; contains `{ deltas: Record<string, number>, modifiers?: Record<string, ScoreModifier[]> }`.
- **ScoreModifier**: Optional metadata attached to a score delta (e.g., streak indicator). Post-MVP.
- **STATE_SYNC**: Server message carrying the full `RoomState` payload to all connected clients.
- **PICK_ACK**: Server message confirming a player's pick was accepted.
- **PartySocket**: The `partysocket` WebSocket client providing automatic reconnection.
- **GameRegistry**: Server-side registry mapping game type strings to `GamePlugin` instances.
- **Zustand_Store**: Client-side state store (`useGameStore`) holding local session state and join flow state.
- **JoinState**: Client-side state machine: `NAME_ENTRY` → `CONNECTING` → `IN_ROOM`. No route changes after entering `/:roomId`.
- **CoinSide**: An enumerated value; either `"HEADS"` or `"TAILS"`.
- **Tuning_Constants**: Per-plugin `constants.ts` file containing all numeric tuning values (no magic numbers in logic).
- **Animation_Pipeline**: Layered architecture: sprites (SVGs), motion variants (Framer Motion config), animation components. Placeholder assets for MVP, easily swappable.

---

## Requirements

---

### MILESTONE 1: Runnable Lobby (No Game Play)

---

### Requirement 1: Monorepo Project Scaffolding

**User Story:** As a developer, I want a pnpm workspace monorepo with `shared`, `client`, and `server` packages, so that I can develop, type-check, and deploy each layer independently while sharing types.

#### Acceptance Criteria

1. THE System SHALL be structured as a pnpm workspace monorepo containing at least three packages: `shared`, `client`, and `server`.
2. THE `shared` package SHALL export all shared TypeScript types (`RoomState`, `RoomConfig`, `Player`, `RoundState`, `RoundPhase`, `GameLeaderboardEntry`, `SessionLeaderboardEntry`, `ClientMessage`, `ServerMessage`, `RoundScoreResult`, `ScoreModifier`, `SessionScoringStrategy`, `ScoringMode`).
3. THE `client` package SHALL depend on `shared` for all shared types and SHALL NOT redefine types already declared in `shared`.
4. THE `server` package SHALL depend on `shared` for all shared types and SHALL NOT redefine types already declared in `shared`.
5. THE System SHALL include a `partykit.json` deployment configuration file at the repository root.
6. WHEN a developer runs the workspace build command, THE System SHALL compile all packages without type errors.
7. THE `server` package SHALL use `@cloudflare/partykit` as its PartyServer runtime. The defunct `partykit` package SHALL NOT appear in any `package.json`.

---

### Requirement 2: Landing Page and Room Creation

**User Story:** As a user, I want a landing page with options to create or join a room, so that I have a clear entry point into the application.

#### Acceptance Criteria

1. WHEN a user navigates to `/`, THE Client SHALL display a landing page with a "Create Room" button and a "Join Room" input field.
2. WHEN a user clicks "Create Room", THE Client SHALL generate a unique Room_ID and navigate to `/:roomId`.
3. THE Room_ID SHALL have sufficient entropy to be unguessable (UUID v4 format or equivalent minimum 128-bit entropy).
4. WHEN a user enters a room code in the "Join Room" input and submits, THE Client SHALL navigate to `/:roomId` using the entered code.
5. WHEN a user navigates directly to `/:roomId` via a shared URL, THE Client SHALL display the join flow for that room without requiring the landing page.

---

### Requirement 3: Single-Route Join Flow (State Machine)

**User Story:** As a player, I want to join a room without getting stuck in navigation loops, so that I can reliably enter the game.

#### Acceptance Criteria

1. WHEN a user navigates to `/:roomId`, THE Client SHALL render a single-route component that manages an internal state machine with states: `NAME_ENTRY`, `CONNECTING`, and `IN_ROOM`.
2. WHILE the join state is `NAME_ENTRY`, THE Client SHALL display a name input form and SHALL NOT attempt a WebSocket connection.
3. WHEN the user submits a name, THE Client SHALL transition to `CONNECTING` state and display a loading indicator while establishing the WebSocket connection.
4. WHEN the PartyServer responds with a STATE_SYNC containing the player in the roster, THE Client SHALL transition to `IN_ROOM` state permanently for that browser session.
5. WHEN a connection error occurs during `CONNECTING`, THE Client SHALL transition back to `NAME_ENTRY` and display an error message.
6. WHILE the join state is `IN_ROOM`, THE Client SHALL NOT transition back to `NAME_ENTRY` or `CONNECTING` within the same browser session (non-regression).
7. THE Client SHALL NOT perform any route navigation after entering `/:roomId`. All state transitions SHALL be component-internal.

---

### Requirement 4: Host and Player Role Assignment

**User Story:** As the first person to set up a room, I want to be assigned the host role, so that I control when rounds start.

#### Acceptance Criteria

1. WHEN a client joins a room with `role: "host"`, THE PartyServer SHALL assign the host role to that connection if no host is currently present in the room.
2. WHEN a client joins a room with `role: "host"` and a host already exists, THE PartyServer SHALL demote the joining client to `role: "player"`.
3. THE PartyServer SHALL ensure exactly one connected player holds the `"host"` role at any time in a non-empty room.
4. WHEN the host disconnects, THE PartyServer SHALL promote the first remaining connected player to the host role.
5. WHEN the host disconnects during `PICKING` phase, THE PartyServer SHALL suspend the pick deadline timer until a new host is present.
6. THE Client SHALL display host-only controls exclusively to the player whose role is `"host"`.

---

### Requirement 5: Player Name Entry and Presence

**User Story:** As a player, I want to enter my name when joining, so that others can identify me on the leaderboard and player list.

#### Acceptance Criteria

1. WHEN a player is in `NAME_ENTRY` state, THE Client SHALL require the player to enter a non-empty display name before allowing connection.
2. WHEN a player successfully joins, THE PartyServer SHALL add the player to the room's player roster with the provided name and broadcast a STATE_SYNC to all connected clients.
3. WHEN a player disconnects, THE PartyServer SHALL mark that player as `connected: false` and broadcast a STATE_SYNC to all remaining connected clients.
4. WHILE a player is connected, THE Client SHALL display that player's name in the player list visible to all participants.
5. THE PartyServer SHALL accept player names as ephemeral display strings with no account or authentication requirement.

---

### Requirement 6: Elevated Lobby UI

**User Story:** As a player, I want to see a well-organized lobby with player info, game options, and a share link, so that I can understand the room state and invite others.

#### Acceptance Criteria

1. WHEN a room is first created, THE PartyServer SHALL initialize the room in the `LOBBY` phase.
2. WHILE the room is in `LOBBY` phase, THE Client SHALL display a player list showing each player's name, host badge (crown icon for host), connection status indicator (green=connected, grey=disconnected), and current session score.
3. WHILE the player's role is `"host"`, THE Client SHALL display a prominent share card with the room URL and a copy button.
4. WHILE the player's role is `"player"`, THE Client SHALL display a compact share link (small copy-icon button) that does not dominate the UI.
5. THE Client SHALL display a game tile grid with board-game-cover style cards. The "Coin Toss" tile SHALL be active and selectable; other tiles SHALL appear as "Coming Soon" placeholders with a dimmed overlay.
6. WHILE the room is in `LOBBY` phase and the player is host, THE Client SHALL display a "Start Game" button visible only to the host.
7. THE Client SHALL display session scores on each player list entry (initialized to 0 for new players).

---

### Requirement 7: Shared Types and Data Models

**User Story:** As a developer, I want all shared types defined in a single package, so that the client and server stay in sync and the type system catches integration errors.

#### Acceptance Criteria

1. THE `shared` package SHALL export a `Player` type containing: `id` (string), `name` (string), `role` ("host" | "player"), `connected` (boolean), and `connectionId` (string | null).
2. THE `shared` package SHALL export a `RoundPhase` type with exactly four values: `"LOBBY"`, `"PICKING"`, `"RESOLVING"`, `"RESULT"`. No `BETWEEN_ROUNDS` phase SHALL exist.
3. THE `shared` package SHALL export a `RoomConfig` type containing: `roomId`, `gameType`, `maxPlayers`, `scoringMode` (`"grand-prix"` | `"chips"`), `autoMode`, `autoRoundIntervalMs`, and `placementPoints` (number array, default `[10, 5, 3, 1, 1, 1, 1, 0, 0, 0]`).
4. THE `shared` package SHALL export a `RoundScoreResult` type containing: `deltas` (Record<string, number>) and optional `modifiers` (Record<string, ScoreModifier[]>).
5. THE `shared` package SHALL export `ClientMessage` and `ServerMessage` discriminated union types covering all message types defined in the design document.
6. THE `Player.connectionId` field SHALL be designed for host-assisted reconnection (post-MVP) and SHALL be initialized to the player's connection ID on join.

---

### Requirement 8: PartyServer Room Initialization

**User Story:** As a developer, I want the PartyServer to properly initialize rooms on connection, so that the game engine starts in a known good state.

#### Acceptance Criteria

1. WHEN the PartyServer receives its first connection for a room, THE PartyServer SHALL initialize room state with phase `LOBBY`, roundNumber 0, empty picks, and empty leaderboards.
2. WHEN a new client connects, THE PartyServer SHALL immediately send a full STATE_SYNC containing the complete current RoomState to that client.
3. THE PartyServer SHALL implement the `PartyServer` interface from `@cloudflare/partykit/server` using the class-based pattern with `onStart`, `onConnect`, `onMessage`, and `onClose` lifecycle methods.
4. THE PartyServer SHALL reject `JOIN` messages when the room is at `maxPlayers` capacity with `ERROR { code: "ROOM_FULL" }`.

---

### MILESTONE 2: First Game Plugin (Coin Toss)

---

### Requirement 9: Host Starts a Round

**User Story:** As a host, I want to manually start each round, so that I control pacing and everyone is ready before picks begin.

#### Acceptance Criteria

1. WHEN the Host sends a `START_ROUND` message and the room phase is `LOBBY` or `RESULT`, THE PartyServer SHALL transition the room phase to `PICKING`, increment the round number, reset picks to empty, and set `pickDeadlineMs` to the current time plus the plugin's `pickWindowMs`.
2. WHEN the room transitions to `PICKING`, THE PartyServer SHALL broadcast a STATE_SYNC to all connected clients simultaneously.
3. WHEN a non-host player sends a `START_ROUND` message, THE PartyServer SHALL respond with `ERROR { code: "NOT_HOST" }` to the sender only and SHALL NOT change room state.
4. WHEN the Host sends a `START_ROUND` message while the room phase is `PICKING` or `RESOLVING`, THE PartyServer SHALL respond with `ERROR { code: "WRONG_PHASE" }` to the sender only and SHALL NOT change room state.

---

### Requirement 10: Pick Window with Deadline Timer

**User Story:** As a player, I want to see a countdown timer during the pick window, so that I know how much time I have to submit my pick.

#### Acceptance Criteria

1. WHILE the room phase is `PICKING`, THE Client SHALL display a countdown derived from `pickDeadlineMs` minus the current client time.
2. WHEN `pickDeadlineMs` is reached on the server, THE PartyServer SHALL close the pick window and proceed to round resolution regardless of how many picks have been submitted.
3. WHEN a `SUBMIT_PICK` message is received after `pickDeadlineMs`, THE PartyServer SHALL respond with `ERROR { code: "DEADLINE_PASSED" }` to the sender only and SHALL NOT record the pick.
4. WHEN all connected players have submitted picks before the deadline, THE PartyServer SHALL call `cancelDeadlineTimer()` explicitly and then proceed to immediate resolution.
5. THE `cancelDeadlineTimer()` function SHALL be safe to call at any time (idempotent) — if no timer exists, it SHALL be a no-op.

---

### Requirement 11: Player Submits a Coin Toss Pick

**User Story:** As a player, I want to pick Heads or Tails during the pick window, so that I can participate in the round.

#### Acceptance Criteria

1. WHILE the room phase is `PICKING` and `pickSubmitted` is false, THE Client SHALL present a Heads button and a Tails button as the pick interface (phase guard).
2. WHEN a player selects Heads or Tails, THE Client SHALL send `SUBMIT_PICK { pick: { side: "HEADS" | "TAILS" } }` to the PartyServer and immediately set `pickSubmitted = true` (optimistic).
3. WHEN a valid pick is received by the PartyServer during the `PICKING` phase within the deadline, THE PartyServer SHALL record the pick for that player and respond with a `PICK_ACK` message to the sender.
4. WHEN the Client detects a new `roundNumber` in a STATE_SYNC, THE Client SHALL reset `pickSubmitted` to false (new round tracking).
5. WHEN the PartyServer receives a second `SUBMIT_PICK` from a player who already has a recorded pick in the current round, THE PartyServer SHALL silently ignore the message (pick immutability).
6. WHEN the PartyServer receives a `SUBMIT_PICK` with a pick value that fails `CoinTossPlugin.validatePick`, THE PartyServer SHALL respond with `ERROR { code: "INVALID_PICK" }` to the sender only.
7. WHEN a `SUBMIT_PICK` is received while `phase ≠ "PICKING"`, THE PartyServer SHALL respond with `ERROR { code: "WRONG_PHASE" }` and SHALL NOT record the pick.

---

### Requirement 12: Server Resolves Round via CoinTossPlugin

**User Story:** As a player, I want the coin flip outcome to be determined fairly server-side, so that no client can influence or predict the result.

#### Acceptance Criteria

1. WHEN the pick window closes (deadline fires or all picks received), THE PartyServer SHALL transition the room phase to `RESOLVING` and broadcast a STATE_SYNC.
2. WHEN the room phase is `RESOLVING`, THE PartyServer SHALL call `CoinTossPlugin.resolveRound(picks)` to determine the outcome.
3. THE `CoinTossPlugin.resolveRound` SHALL determine the outcome (`"HEADS"` or `"TAILS"`) using server-side randomness independent of the submitted picks.
4. WHEN `resolveRound` returns a result, THE PartyServer SHALL call `CoinTossPlugin.scoreRound(picks, result, players)` to compute a `RoundScoreResult`.
5. THE `CoinTossPlugin.scoreRound` SHALL return a `RoundScoreResult` where `deltas[playerId]` equals `CORRECT_GUESS_CHIPS` (10) for each connected player whose pick matches the outcome, and 0 for all others including players who did not submit a pick.
6. IF the room phase is not `PICKING` when `resolveRound` is triggered, THEN THE PartyServer SHALL perform no state mutation (idempotency guard). Both timer-expiry and "all-picks-in" may call resolveRound — only the first takes effect.

---

### Requirement 13: Result Broadcast and Display

**User Story:** As a player, I want everyone to see the result at the same moment, so that the reveal feels shared and fair.

#### Acceptance Criteria

1. WHEN the PartyServer completes round resolution, THE PartyServer SHALL transition the room phase to `RESULT` and broadcast a single STATE_SYNC to all connected clients simultaneously.
2. THE STATE_SYNC for a `RESULT` phase SHALL include: phase, round result (outcome), all score deltas applied to game scores, and the updated game leaderboard.
3. WHEN the Client receives a STATE_SYNC with phase `RESULT`, THE Client SHALL display the coin toss outcome prominently.
4. WHEN the Client receives a STATE_SYNC with phase `RESULT`, THE Client SHALL display which players picked correctly and each player's score delta for that round.

---

### Requirement 14: Game Leaderboard

**User Story:** As a player, I want to see a ranked leaderboard after each round, so that I know how I'm doing relative to others within this game.

#### Acceptance Criteria

1. WHEN a round resolves, THE PartyServer SHALL add each player's score delta to their game-scope score (game scores SHALL NOT decrease within a game).
2. WHEN a round resolves, THE PartyServer SHALL call `CoinTossPlugin.computeGameLeaderboard` to produce a ranked `GameLeaderboardEntry[]` sorted by game score descending, with 1-indexed ranks.
3. WHEN two or more players are tied in game score, THE CoinTossPlugin SHALL assign them equal rank values in the game leaderboard.
4. THE Game_Leaderboard SHALL include only currently connected players.
5. WHEN the Client receives an updated STATE_SYNC, THE Client SHALL render the game leaderboard displaying each entry's player name, game score, and rank.

---

### Requirement 15: Game Plugin Tuning Constants

**User Story:** As a developer, I want all tunable game values in a single constants file per plugin, so that game balancing is a one-file edit with no magic numbers in logic.

#### Acceptance Criteria

1. THE CoinTossPlugin SHALL extract all numeric tuning values (points per correct guess, pick window duration, future multiplier values) into `packages/server/src/games/coin-toss/constants.ts`.
2. THE constants file SHALL export a single `as const` object named `COIN_TOSS` in UPPER_SNAKE_CASE.
3. THE CoinTossPlugin implementation SHALL import all tuning values from its constants file and SHALL NOT contain inline magic numbers.
4. WHEN a tuning constant is intended for future use, THE constants file SHALL annotate it with a `(future)` JSDoc comment.

---

### Requirement 16: Client-Side Phase Guards

**User Story:** As a player, I want buttons to only appear when relevant, so that I cannot accidentally trigger actions in the wrong game phase.

#### Acceptance Criteria

1. THE Client SHALL render the "Start Round" button if and only if `phase ∈ {"LOBBY", "RESULT"}` AND `role === "host"`.
2. THE Client SHALL render pick buttons (Heads/Tails) if and only if `phase === "PICKING"` AND `pickSubmitted === false`.
3. WHEN a new round begins (new `roundNumber` detected in STATE_SYNC), THE Client SHALL reset `pickSubmitted` to false.
4. THE Client SHALL render the "Next Round" and "End Game" buttons if and only if `phase === "RESULT"` AND `role === "host"`.

---

### Requirement 17: Host Starts Next Round or Ends Game

**User Story:** As a host, I want to start another round or end the game after seeing results, so that I control the session flow.

#### Acceptance Criteria

1. WHEN the room phase is `RESULT`, THE Client SHALL display "Next Round" and "End Game" buttons to the Host.
2. WHEN the Host sends `START_ROUND` while the room phase is `RESULT`, THE PartyServer SHALL begin a new round as specified in Requirement 9.1.
3. WHEN the Host sends `END_GAME`, THE PartyServer SHALL transition the room phase to `LOBBY`, reset game scores and game leaderboard, and broadcast STATE_SYNC.
4. THE PartyServer SHALL accept `END_GAME` only from the host and only when `phase ∈ {"RESULT", "LOBBY"}`.

---

### Requirement 18: Coin Toss Animation and Result Display

**User Story:** As a player, I want to see an animated coin flip that reveals the result, so that the game feels exciting and shared.

#### Acceptance Criteria

1. WHEN the Client receives a STATE_SYNC with phase `RESULT`, THE Client SHALL play a coin flip animation using the layered animation pipeline (sprite + motion variants + animation component).
2. THE coin flip animation SHALL use `result.flippedAt` timestamp to synchronize start across all clients.
3. WHEN a client receives a `RESULT` state with a `flippedAt` in the past (reconnection scenario), THE Client SHALL skip the animation and display the final result face immediately.
4. WHEN the coin flip animation completes, THE Client SHALL fire an `onAnimationComplete` callback to transition to the ResultDisplay view.
5. THE animation sprites SHALL be placeholder SVGs (distinct "H" and "T" faces) that are easily swappable without logic changes.
6. THE motion variants SHALL be stored as declarative Framer Motion config files in `assets/animations/`, separate from sprite assets and animation components.

---

### MILESTONE 3: Polish and Session Scoring

---

### Requirement 19: Session Scoring — Dual Mode

**User Story:** As a host, I want to choose between GrandPrix and Chips scoring when creating a room, so that the group can play with the scoring style that suits them.

#### Acceptance Criteria

1. WHEN the host creates a room, THE Client SHALL present a scoring mode selector with options "GrandPrix" and "Chips".
2. THE `RoomConfig.scoringMode` SHALL be set at room creation and SHALL NOT change during the session.
3. THE `SessionScoringStrategy` interface SHALL define an `applyGameResult(players, gameLeaderboard, rawScores)` method returning a `SessionUpdate` with updated session scores and session leaderboard.
4. THE `GrandPrixStrategy` SHALL award placement points based solely on final `gameLeaderboard` rankings and the `placementPoints` table — never from raw game scores directly.
5. THE `ChipsStrategy` SHALL accumulate raw game deltas directly as session points — no rank-based transformation applied.
6. THE GamePlugin SHALL remain scoring-model-agnostic: it reports raw `RoundScoreResult` deltas, and the session layer interprets them based on the selected mode.

---

### Requirement 20: Session Leaderboard

**User Story:** As a player, I want to see cumulative session standings across multiple games, so that I know who is winning the overall session.

#### Acceptance Criteria

1. WHEN the host ends a game (via `END_GAME`), THE PartyServer SHALL apply the selected `SessionScoringStrategy` to compute updated session scores.
2. THE session leaderboard SHALL display each player's name, cumulative session points, games played, and rank.
3. FOR ALL sequences of completed games, no player's `sessionPoints` SHALL decrease (session scores are additive in both modes).
4. WHEN two or more players are tied in session points, THE PartyServer SHALL assign them equal rank values.

---

### Requirement 21: WebSocket Reconnection and State Resync

**User Story:** As a player, I want to reconnect and resume the game if my connection drops, so that a brief network interruption doesn't remove me from the session.

#### Acceptance Criteria

1. THE Client SHALL use `PartySocket` from the `partysocket` package for all WebSocket communication to the PartyServer.
2. WHEN the WebSocket connection drops, THE Client SHALL attempt to reconnect using exponential backoff: initial delay 500 ms, doubling each attempt, capped at 30 000 ms.
3. WHEN a reconnection is established, THE PartyServer SHALL send a full STATE_SYNC to the reconnected client immediately.
4. WHEN a player reconnects during the `PICKING` phase, THE Client SHALL restore the pick interface with the correct deadline countdown derived from the received `pickDeadlineMs`.
5. WHEN a player reconnects during the `RESULT` phase, THE Client SHALL display the current round results and leaderboard from the received STATE_SYNC.
6. THE Client SHALL display a connection status indicator showing `"connecting"`, `"connected"`, `"disconnected"`, or `"error"` states.

---

### Requirement 22: Mobile-First Responsive Layout

**User Story:** As a player on a mobile device, I want a usable interface without horizontal scrolling or tiny touch targets, so that I can play comfortably on my phone.

#### Acceptance Criteria

1. THE Client SHALL implement a mobile-first responsive layout using Tailwind CSS utility classes.
2. THE PickWidget Heads and Tails buttons SHALL have a minimum tap target height of 64 px on mobile viewports.
3. THE Client layout SHALL NOT require horizontal scrolling on viewports 375 px wide or wider.
4. WHEN the room is in `RESULT` phase on a mobile viewport, THE Client SHALL render the outcome label, player results, and leaderboard in a vertically stacked layout.
5. THE coin animation component SHALL size to 40vmin so it fits both portrait and landscape orientations.

---

### Requirement 23: Deployment Pipeline

**User Story:** As a developer, I want a working deployment pipeline to Cloudflare Pages and PartyKit, so that the app is accessible on the public internet.

#### Acceptance Criteria

1. THE `client` package SHALL be buildable to a static asset bundle suitable for deployment to Cloudflare Pages using `vite build`.
2. THE `server` package SHALL be deployable to `@cloudflare/partykit` using `npx partykit deploy` with the `partykit.json` configuration.
3. THE `partykit.json` configuration file SHALL specify the server entry point and the Cloudflare Pages domain origin for CORS.
4. WHEN deployed, THE Client SHALL connect to the correct PartyKit host via the `PARTYKIT_HOST` environment variable resolved at build time.
5. THE System SHALL restrict REST endpoint CORS to the configured Cloudflare Pages domain origin.

---

### Requirement 24: Disconnection Handling During Active Round

**User Story:** As a player still in the game, I want the round to resolve if a player disconnects, so that one player's network issue doesn't block everyone.

#### Acceptance Criteria

1. WHEN a player disconnects during `PICKING` phase and all remaining connected players have already submitted picks, THE PartyServer SHALL cancel the deadline timer and proceed to immediate resolution.
2. WHEN a player disconnects, THE PartyServer SHALL mark them `connected: false`, set `connectionId` to null, and broadcast STATE_SYNC.
3. WHEN a disconnected player's pick was already recorded, THE PartyServer SHALL retain that pick for scoring purposes.

---

---

## Post-MVP Requirements (Out of Scope for MVP)

> The following requirements are intentionally deferred. They MUST NOT be included in MVP task planning or implementation.

### Post-MVP Requirement A: Host-Assisted Reconnection

**Deferred because:** The `Player.connectionId` field is designed into types from day one, but the host UI for linking players and the LINK_PLAYER message handling ship post-MVP.

#### Acceptance Criteria (Post-MVP)

1. WHEN the host sends `LINK_PLAYER { oldPlayerId, newConnectionId }`, THE PartyServer SHALL update the old player's `connectionId` to the new value, set `connected: true`, and broadcast STATE_SYNC.
2. THE Client SHALL provide a host-only UI for linking a new connection to a disconnected player's identity to preserve scores.

---

### Post-MVP Requirement B: Auto-Mode Timer

**Deferred because:** Host manually starts rounds for MVP. Auto-mode adds scheduling complexity without validating the core loop.

#### Acceptance Criteria (Post-MVP)

1. WHEN the Host sends `SET_AUTO_MODE { enabled: true, intervalMs }`, THE PartyServer SHALL automatically begin a new round after `intervalMs` milliseconds following each `RESULT` phase.
2. WHEN auto-mode is enabled and the host disconnects, THE PartyServer SHALL suspend the auto-timer.

---

### Post-MVP Requirement C: Session Persistence (Durable Object KV)

**Deferred because:** In-memory state is sufficient for MVP. KV persistence adds durability for cold-start recovery without affecting prototype validation.

#### Acceptance Criteria (Post-MVP)

1. THE PartyServer SHALL persist `RoomState` to Durable Object KV storage (`this.party.storage`) so that state survives a cold start.
2. THE PartyServer SHALL maintain a game history log including final leaderboards and points awarded per game.

---

### Post-MVP Requirement D: Score Modifiers (Streak/Combo)

**Deferred because:** Basic scoring is sufficient for MVP. Score modifiers add visual excitement but not core correctness.

#### Acceptance Criteria (Post-MVP)

1. THE `RoundScoreResult.modifiers` field SHALL carry per-player `ScoreModifier` objects when streak/combo conditions are met.
2. THE Client SHALL display modifier labels (e.g., "3x Streak!") alongside score deltas in the ResultDisplay.

---

### Post-MVP Requirement E: Kick Player

**Deferred because:** Room management polish is out of scope for prototype validation.

#### Acceptance Criteria (Post-MVP)

1. WHEN the Host sends `KICK_PLAYER { playerId }`, THE PartyServer SHALL remove the specified player from the room and broadcast STATE_SYNC.

---

### Post-MVP Requirement F: Advanced Animation Polish

**Deferred because:** Placeholder animations are functional for MVP. Spring-physics transitions and mobile bottom-sheet leaderboard are polish.

#### Acceptance Criteria (Post-MVP)

1. WHERE Framer Motion is available, THE Client SHALL use spring-physics animations for transitions between game phases.
2. THE Game_Leaderboard on mobile SHALL render as a bottom-sheet panel that slides up from the bottom of the viewport.
