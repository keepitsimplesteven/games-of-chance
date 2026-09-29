# Code Quality Audit — Findings

Post-event deep dive on `games-of-chance`. This is an audit deliverable, not an implementation. It maps the full picture across leaderboards, theming, settings/autoplay, create-room, server orchestration, and test health, then recommends a sequence. One low-risk change was made during the audit: a dead-code removal (see Finding D1) plus a coverage dev-dependency. Everything else is analysis.

Each finding is tagged with severity (LOW / MED / HIGH), effort (SMALL / MED / LARGE), and dependency links.

## How to read this

- Findings prefixed by area: T = test health, D = dead code, L = leaderboards, TH = theming, S = settings/autoplay, CR = create-room, O = orchestration.
- "Spec-ready" means the finding is scoped enough to become its own implementation plan.
- "Coverage-gated" means the work touches code that currently has no tests and should not be refactored until tests exist.

---

## Changes already made during this audit

Two low-risk, reversible changes, consistent with the agreed plan:

1. Added `@vitest/coverage-v8@3.2.7` as a root dev-dependency (needed to measure coverage). No source or config committed beyond `package.json` + `pnpm-lock.yaml`.
2. Dead-code removal of 26 provably-unused files (Finding D1).

Heads-up on the working tree: when this audit started, the repository already had uncommitted modifications to `packages/server/src/room.ts`, `roomHandlers.ts`, `bots/botTiming.ts`, `games/battle-bots/constants.ts`, `games/playcaller/constants.ts`, and a one-line change in `GameView.tsx`. Those were not made by this audit. When reviewing the dead-code deletion, separate it from that in-flight work.

---

## Test health

### T1. Server test harness cannot load `room.ts` (systemic) — HIGH / SMALL

Fifteen of the 19 failing server test files fail at collection, not on assertions. Every one throws the same error:

```
Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. Received protocol 'cloudflare:'
```

Cause: `room.ts` imports `partyserver` (`Server`, `routePartykitRequest`), which pulls in the `cloudflare:` module scheme. `src/__tests__/helpers.ts` imports `GameRoom` from `../room`, so every room/integration/property test that uses the helper cannot load under the plain-node vitest config. `packages/server/vitest.config.ts` is just `{ test: { globals: true } }` with no worker-pool or alias setup.

Impact: the entire live-room server surface is effectively untested at runtime, and the failures masquerade as 15 separate broken tests when they are one config problem. This blocks the orchestration refactors (O1).

Fix direction: configure the server tests to run under a Workers-compatible pool (e.g. `@cloudflare/vitest-pool-workers`) or provide a `partyserver`/`cloudflare:` mock/alias for node. This is small and unblocks a lot.

Spec-ready. This is the top prerequisite for server-side refactors.

### T2. Real assertion failures (4 files, 7 assertions) — MED / MED — TRIAGED: all stale tests

Distinct from T1, these actually run and fail. Re-triaged after this snapshot went stale (the two related bugfix specs landed in between); the failures are now 7, not 8, and every one is a stale test, not a product bug:

- `BattleEngine.test.ts` (2): FFA/1v1 "exceed the 1000-tick `TICK_LIMIT`". STALE — `TICK_LIMIT` is now 2000 (in the pre-existing `battle-bots/constants.ts` edit); the tests hardcode 1000. Fix: assert against `BATTLE_BOTS.TICK_LIMIT`.
- `SpectatorRevealDesync.exploration.test.ts` (1): "displayedPlayCount overshoot". STALE — Test Case C inlines the old buggy `prev + 1` and asserts `N+1 <= N`; tests no product code. The `Math.min` fix already shipped (spectator-reveal-desync-fix, complete). Delete Test Case C; Cases A/B pass and stay.
- `playcaller-consolation-generation.test.ts` (2): 8/10-player consolation structure. STALE — assert the old mini-bracket shape; the shipped consolation-concurrent-scheduling fix splits 4-player groups into two 1v1 games. Re-pin to 10p → 4 rounds, placementStarts [3,5,7,9], each 1 matchup, all populated. (`generateConsolationRounds` is still live in the lottery/sim path in `room.ts`, so keep the tests.)
- `BugConditionExploration.test.ts` (3): "concurrent" consolation scheduling. STALE — assert consolation rides on `schedule[1]`; the shipped `buildSchedule` consolidates all consolation into one dedicated entry between Semifinal and Final. Re-point to the consolidated model; B3's empty-slot precondition was designed out (rewrite as a filter-invariant test or delete).

No real regression surfaced. Resolution is scoped into `test-harness-repair` Phase 0.5 (R6), because a behavior-locking baseline is exactly what the refactor phases depend on. Gated behind T1 (the server suite must load first).

### T3. Client `scrollTo` failures under jsdom — LOW / SMALL

`SpectatorDriveView.property.test.tsx` fails because `PlayByPlayAnnouncer.tsx` calls `scrollRef.current.scrollTo(...)` in an effect and jsdom does not implement `scrollTo`. This is a test-environment gap, not a product bug. Fix by stubbing `Element.prototype.scrollTo` in the client `test-setup.ts`, or guarding the call.

### T4. Property tests are seed-flaky — LOW / MED

Client failure counts shifted between identical runs (7 vs 8) because `fast-check` property tests pick new seeds each run. Non-deterministic CI is a maintenance risk. Consider pinning seeds for regression tests (keep randomized exploration separate).

### T5. Typecheck was broken; now down to one real error — MED / SMALL

Before the audit, `pnpm -r typecheck` reported 112 errors. 111 were in the deleted tuning scripts (D1); after removal, exactly one remains: `consolationPlacements.test.ts:161` uses a `maxPlayers` field that no longer exists on `GameSettings`. This is stale test code (T2 territory). Fixing it makes `pnpm -r typecheck` green.

### Coverage baseline (from Task 2)

| Package | Lines | Funcs | Branches | Notes |
|---|---|---|---|---|
| client | 39.8% | 44.3% | 64.8% | Leaderboards, create-room path, host panel all 0% |
| server | 37.4% | 59.2% | 88.4% | `room.ts` 3.2% is a T1 artifact; scoring strategies 0% |
| simulation | 81.2% | 92.9% | 95.9% | Healthy |

Notable real gaps (not artifacts): `ChipsStrategy.ts` 0%, `GrandPrixStrategy.ts` 0% (pure, easily testable scoring logic), `roomHandlers.ts` 0%, and every leaderboard component 0%.

---

## Dead code

### D1. 26 unused files removed — DONE (LOW / SMALL)

Ran `knip`, cross-checked each candidate with a grep for `import ... from` in source and tests, and deleted only files that were both flagged and confirmed unreferenced:

- 13 battle-bots tuning scripts (the whole `games/battle-bots/scripts/` directory). These caused 111 of the 112 typecheck errors.
- `server/src/games/index.ts` (unused barrel; `room.ts` imports `GameRegistry`/`GamePlugin` directly and registers plugins via side-effect imports).
- Client orphans: `FinalResultsScreen.tsx` (superseded by `CongratulationsScreen`/`GameCompleteScreen`), `SessionLeaderboard.tsx` (orphaned lobby standings; `PlayerList` shows session scores inline now), `OverlayContainer.tsx`, the four big-wheel spin components (`SpinButton`, `SpinnerInfo`, `SpinOrderQueue`, `SpinResultDisplay`), `BattleArena.tsx` + `FFAArena.tsx` (superseded by `Replay*` variants), and the PrepPhase `RobotCard`/`RobotPreview`/`RobotSelector` cluster (`VsScreen` has its own local `RobotCard`).

Verified after deletion: typecheck 112 to 1 error; tests unchanged from baseline (no regression).

### D2. Held-back deletion candidates (8 files) — TRIAGED: 3 deleted, 3 kept, 2 your call

Flagged by knip but held back for lower confidence. Verified each; they split three ways rather than all being dead:

**Deleted (safe orphans, zero references, client typecheck green after):**
- `client playcaller/play-art/defense.ts` and `play-art/offense.ts` — orphaned by the `playcaller-dynamic-playbook` spec, which moved art onto `PlayDefinition.playArt` (task 10.3: "no separate art resolver or registry lookup"). NOTE: `play-art/types.ts` and `play-art/PlayArtSvg.tsx` in the same dir are LIVE — do not delete the directory, only these two data files.
- `client playcaller/hooks/useDriveState.ts` — hook with zero call sites; superseded.

**Kept (NOT dead — live configuration pattern knip mislabels):**
- `playcaller/drive/presets/{index,v1-balanced,v2-25yard}.ts` — `config.ts` imports `presets/v3-decisive` as the live tuning; `presets/index.ts` re-exports v1/v2/v3. v1/v2 are intentional reference/reversion configs behind the documented preset-swap mechanism in `config.ts`. Pruning them is a separate "do we still want old tuning configs" decision, not dead-code removal.

**Your call (manually-run tooling, never imported by design):**
- `server/scripts/lottery-distribution.ts` and `playcaller/drive/sim-final-bomb.ts` — both carry `npx tsx <path>` usage headers. Keep if you may re-run the analysis; delete if done.

### D3. ~97 unused exports + ~98 unused exported types — LOW / MED

Mostly barrel re-exports in `index.ts` files and `Props` interfaces exported but consumed only locally. High false-positive risk, so this is a careful pass, not a bulk delete. Low priority.

---

## Leaderboards (Task 4)

### L1. Two holdouts not on `BaseLeaderboard` — MED / MED — spec-ready, coverage-gated

`BaseLeaderboard` is a solid themed slot component (`renderRow`/`renderScore`/`renderHeader`, `variant`, `animate`). Three game leaderboards already wrap it correctly (`CoinTossLeaderboard`, `BigWheelLeaderboard`, `PlaycallerLeaderboard`). The holdouts:

- `GameLeaderboard.tsx` is live (rendered by `GameView` as the generic fallback) but does not use `BaseLeaderboard`, hardcodes off-theme colors (`bg-white`, `text-gray-*`, `bg-blue-50`), and duplicates `getStreakIndicator` verbatim. It maps directly onto `BaseLeaderboard` (`entries = gameLeaderboard`, `renderScore` for "pts"). Migrating removes the duplicate helper and the theming break. Check first whether any active `gameType` actually reaches this fallback (all four games have custom leaderboards); if none does, delete instead of migrate.
- `SessionLeaderboard.tsx` was already removed in D1 (it was orphaned).

### L2. Session-standings popover is duplicated — MED / MED — spec-ready, coverage-gated

`SessionStandingsPopover` (older, hand-rolled) and `PlaycallerLeaderboard` (newer, built on `BaseLeaderboard`) are near-identical floating popovers. `PlaycallerLeaderboard`'s own doc comment says it "maintains the same popover behavior as SessionStandingsPopover but delegates rendering to BaseLeaderboard." `LobbyShell` renders `SessionStandingsPopover` in the generic + non-playcaller layouts and `PlaycallerLeaderboard` only in the playcaller layout, with the same `trigger` and icon.

Recommendation: keep one popover, built on `BaseLeaderboard`, used by all layouts. `PlaycallerLeaderboard` is the better base but is misnamed and misplaced (it lives under `games/playcaller` yet is generic). Merge into a single `SessionStandingsPopover` in `components/game`, delete the other. The popover chrome (open state, outside-click, Escape, phase-close) is duplicated verbatim between the two, so extract a `usePopover` hook or a `Popover` shell.

### L3. Duplicated bot filter/sort logic — LOW / SMALL

`isBot`, `isBotControlled`, and the "sort by session points desc, humans before bots" logic are copy-pasted across `PlayerList`, `SessionStandingsPopover`, and `PlaycallerLeaderboard`. Extract a shared `sortSessionEntries` / `isBot` util.

Prerequisite for L1 and L2: every leaderboard component is at 0% coverage. Add render tests for `BaseLeaderboard` (rank badges, current-player highlight, slots, compact variant) and popover behavior before refactoring.

---

## Theming (Task 5)

### TH1. Host panel ignores the theme system — MED-HIGH / MED — spec-ready

The single largest theming gap, and it matches the reported "host menu uses its own scheme." The entire `host-panel/` directory uses a bespoke `zinc`/`gray` dark palette plus amber accents instead of `ThemeDefinition` slots: `AdjustScoreView.tsx` (41 gray/zinc + 17 named colors), `HostControlPanel.tsx` (16 + 5), `RenamePlayerView.tsx` (15 + 4), `KickPlayerView.tsx` (12 + 3), `SetSeedsView.tsx` (10 + 4), `ReassignHostView.tsx` (9 + 3), `ScoreAdjustmentNotification.tsx` (2 + 3). Switching to pixel-vapor leaves the whole host surface stranded.

Fix is mostly mechanical: adopt the existing `card` / `listItem` / `bodyText` / `mutedText` / `btn*` slots.

### TH2. Lobby/result chrome hardcodes colors — MED / MED

Chrome that breaks on theme switch: `GameTileGrid.tsx` (17 hex poker-chip tile colors + `#f5c542` gold), `TournamentEndView.tsx` (7 hex), `CongratulationsScreen.tsx`, `GameLeaderboard.tsx` (see L1), `PlayerList.tsx` and `SessionStandingsPopover.tsx` (connection dots), `SettingsPanel.tsx` toggle, `ConnectionStatus.tsx`.

### TH3. Missing theme slots force hardcoding — MED / SMALL — do first

Some hardcoding exists because there is no slot to use. Add these to `ThemeDefinition` and both theme files:

1. Connection status colors (connected/disconnected dot) — currently `bg-green-500`/`bg-gray-400`.
2. Toggle/switch on-off colors — currently `bg-green-500`/`bg-gray-300`.
3. Overlay/scrim background — currently `bg-gray-900/40` in `GameTileGrid` overlays.
4. Tile/badge palette — the poker-chip tile colors are retro-casino-specific with no themed equivalent.

Doing TH3 first makes TH1 and TH2 clean slot-swaps.

### TH4. Game art hex is partly legitimate — LOW / MED

Playcaller and battle-bots components carry high hex counts (`CoinTossCeremony` 27, `ReplayFFAArena` 27, `PartCarousel` 26, `BracketVisualization` 22, `FinalRankings` 22, robot parts, HP/energy bars). Much is genuine game art (robot colors, coin faces) and can stay. But board/field rendering (`WheelAnimation`, `BracketVisualization`) should read `theme.field.*`, which already exists for exactly this. Triage per file; do not bulk-convert art.

### TH5. Confirm status of standalone style pages — LOW / SMALL

`StyleComp.tsx`, `ViewportTestPage.tsx`, `FieldCompGrid.tsx` carry their own inline palettes (`StyleComp` even defines `nes`/`clean` theme variants). These look like dev/style-reference pages, not product chrome. Confirm whether they are reachable routes; if dev-only, exclude them from theming work and consider gating behind a dev flag. They are not in the D1/D2 dead-file list, so something routes to them.

Coverage note: theming changes are visual. Add smoke-render tests that mount key components under both themes before large swaps.

---

## Settings and autoplay (Task 6)

### S1. Client settings UI ignores the plugin schemas — HIGH / MED — spec-ready

The server-side settings architecture is built and working. `GamePlugin` declares `settingsSchema?`, and all four plugins populate it (`COIN_TOSS_SETTINGS_SCHEMA`, `BIG_WHEEL_SETTINGS_SCHEMA`, `BATTLE_BOTS_SETTINGS_SCHEMA`, `PLAYCALLER_SETTINGS_SCHEMA`). The server builds tuning defaults from the schema, validates updates against it (`validateSettings.ts`), and resets tuning on game change. It is tested.

The client is the only broken part. `SettingsPanel.tsx` re-declares a hardcoded `COIN_TOSS_SCHEMA` and `getSettingsSchema()` returns `undefined` for every non-coin-toss game, so big-wheel, battle-bots, and playcaller get no tuning UI even though the server supports them. Worse, the client's hardcoded coin-toss schema uses different keys and labels than the server one, so the two can drift silently.

Fix (smaller than the original plan assumed): send `plugin.settingsSchema` to the client (add it to `RoomState`/`STATE_SYNC` or a dedicated field) and render from it via the existing `SchemaField` component. Delete the hardcoded client schema. This is the "make schemas plugin-owned" goal; the server already is, so this is just wiring the client.

### S2. Autoplay: the prominent toggle is dead UI — HIGH / MED — spec-ready

"Autoplay" currently means three unrelated things, and the one the UI exposes most prominently does nothing:

1. `autoMode` + `autoRoundIntervalMs` (RoomConfig). `SettingsPanel` shows an "Auto-mode" toggle and interval input that send `SET_AUTO_MODE`. `SET_AUTO_MODE` is a defined `ClientMessage`, but `room.ts`'s `switch(msg.type)` has no case for it and there is no auto-advance timer anywhere. The toggle and interval field change nothing. This is the concrete evidence that autoplay lapsed.
2. `SKIP_GAMEPLAY` (tuning key): set from the LandingPage lottery "Auto-Play" toggle; read only by playcaller `roomHandlers` to bypass the coin-toss ceremony. Works. Lottery/playcaller-specific.
3. `RESULTS_ONLY` (tuning key): set from the LandingPage lottery toggle; read in `room.ts` to jump straight to `LOTTERY_REVEAL`. Works. Lottery-specific.

Naming collision: LandingPage calls `SKIP_GAMEPLAY` "Auto-Play" while `SettingsPanel` calls `autoMode` "Auto-mode" — two unrelated features both named auto.

Recommendation, matching the "build autoplay back up, particularly autoplay" ask: implement the missing `SET_AUTO_MODE` handler plus an auto-advance timer that fires `START_ROUND` on `autoRoundIntervalMs` when `autoMode` is on, then rationalize the three skip/auto concepts and their names. The autoplay handler is coverage-gated behind T1 (it lives in `room.ts`).

---

## Create-room and lobby (Task 7)

### CR1. Fragile untyped join handoff — MED-HIGH / LARGE — spec-ready

Room-creation config flows through three loosely-typed hops: LandingPage `navigate(state)` to RoomPage `location.state as {...}` (the cast is written out six separate times) to `store.connect(...)` (nine positional args) to the JOIN payload. Three problems:

- `location.state` is untyped React Router state with no validation.
- `connect()` takes nine positional arguments, easy to mis-order.
- Host-ness is inferred as `joinRole = scoringMode ? "host" : "player"`. Being the room creator is detected purely by whether `scoringMode` happens to be present in route state, so a page refresh loses `location.state` and the creator silently becomes a player.

### CR2. Grand Prix under-exposed; lottery toggles tacked on — MED / MED

Grand Prix is fully wired end-to-end (`GrandPrixStrategy`, `placementPoints`), not dead, but it is buried as one of two scoring toggles with a one-line description while the default is chips + lottery. The three lottery sub-toggles (`draftPickEnabled`, `skipGameplay`, `resultsOnly`) are appended under the lottery option and conditionally forwarded — the "tacked on at the end" settings. `ScoringMode` and `ProgressionMode` are orthogonal (six combinations) but presented as two separate toggle rows.

### CR3. Mode special-casing spread across components — MED / MED

Progression-mode branching is duplicated in `GameTileGrid` (deeply nested tile-lock ternaries), `PlayerList` (lottery sorts by seed and shows "#N seed" vs "pts"), `SettingsPanel`, and `LandingPage`. There is no single description of what each mode means for the lobby.

Recommendation (this deserves its own plan, as noted): a dedicated create-room spec that replaces the untyped handoff with one typed `RoomCreationConfig`, determines host-ness explicitly rather than via `scoringMode` presence, presents scoring x progression as a coherent matrix that gives Grand Prix real prominence, folds the lottery sub-toggles into that model, and centralizes per-mode lobby behavior. It owns LandingPage, the RoomPage join handoff, and GameTileGrid mode logic; it does not own L1/L2 or S1. The whole create-room path is at 0% client coverage (LandingPage 244L, GameTileGrid 164L, RoomPage 106L, usePartySocket 100L).

---

## Server orchestration (Task 8, report only)

### O1. `room.ts` is a 3077-line god-object — MED / LARGE — spec-ready, coverage-gated

One `GameRoom` class holds a single `switch(msg.type)` dispatch over 29 message cases plus 67 private methods, covering dispatch, phase transitions, game-specific glue, session scoring, bot management, lottery, and tournament. `roomHandlers.ts` (playcaller) adds 957 more lines at 0% coverage.

The clearest extraction: the finalize-result sequence (`getStrategy` to `strategy.applyGameResult` to per-player games-played increment to `computeSessionLeaderboard()`) is copy-pasted at four to five near-identical sites (`room.ts` ~846, ~1942, ~2631, ~2672, ~2722), each wrapped in the same chips-vs-grand-prix conditional. Extract one `finalizeGameResult()` method, then split the class into per-concern modules.

Strictly gated behind T1: `room.ts` is untestable until the server test harness can load it. Do not refactor first.

### O2. `FastPlayAdapter` is a parallel execution path — LOW / MED

`FastPlayAdapter` (100% covered) reconstructs its own config/tuning/leaderboard flow separately from the live `room.ts` path. Any change to finalize-result logic must be mirrored, or simulation stats diverge from live play. Flag as a drift risk to keep in mind during O1, not standalone work.

### O3. `SUBMIT_PICK` payload is `unknown` — LOW / SMALL

The one soft spot in an otherwise well-typed `ClientMessage` discriminated union: `SUBMIT_PICK` carries `pick: unknown`, re-validated per plugin via `validatePick`. Runtime-safe already; tightening to a per-game pick union is optional polish.

### O4. `GameContainer` shell candidate — LOW / MED — spec-ready, coverage-gated

`GameView` switches on `gameType` to render four containers that each repeat the same scaffolding (phase gating, deferred-reveal leaderboard, round controls). Candidate for a shared `<GameContainer>` shell. Its own plan, gated behind adding container render tests.

---

## Recommended sequence

Ordered to front-load low-risk, high-value work and gate heavy refactors behind coverage.

**Phase 0 — unblock (do first, small, high leverage)**
1. T1: fix the server test harness (`cloudflare:` loader). Unblocks all server testing and O1.
2. T5 + T2: fix the one stale typecheck error and triage the four real failing test files. Gets `pnpm -r typecheck` green and clarifies which failures are in-progress specs.
3. T3: stub `scrollTo` in client test setup.
4. D2: decide on the eight held-back dead-file candidates.

**Phase 1 — high-value, mostly independent**
5. S2: implement the missing `SET_AUTO_MODE` handler + auto-advance timer (autoplay). Depends on T1 for tests. Highest user-visible payoff.
6. S1: wire the client `SettingsPanel` to plugin schemas; delete the hardcoded copy. Restores tuning UI for three games.
7. TH3 then TH1: add the missing theme slots, then migrate the host panel to slots.

**Phase 2 — consolidation (add tests first)**
8. L-prerequisite: add leaderboard render tests (coverage gate).
9. L1 + L2 + L3: migrate `GameLeaderboard`, merge the session-standings popovers, extract the bot sort util. Resolves TH2's leaderboard items too.
10. TH2 + TH4: remaining chrome theming and the legitimate-vs-hardcoded game-art triage.

**Phase 3 — large refactors (own specs, coverage-gated)**
11. CR1 + CR2 + CR3: the dedicated create-room spec.
12. O1 (+ O2, O3): the `room.ts` orchestration split, only after T1.
13. O4: the `GameContainer` shell.

### Spec-ready findings

T1, L1+L2 (leaderboard consolidation), S1 (client schema wiring), S2 (autoplay), TH1 (host-panel theming), CR1+CR2+CR3 (create-room), O1 (room.ts split), O4 (GameContainer shell).

### Deferred to a later pass (out of scope for this audit)

Accessibility, cross-cutting concerns (deferred-reveal/spectator-sync consolidation, error handling), and performance/bundle work were explicitly deferred.
