# Implementation Plan: Playcaller Lottery Mode

## Overview

Implement the Playcaller Lottery Mode feature: a fantasy football draft lottery system where placements are predetermined by a weighted probability table, enforced via drive outcome suppression, and concluded with a lottery reveal and draft pick selection phase. Also add consolation/placement games to the bracket system for all Playcaller modes.

## Tasks

- [x] 1. Add consolation/placement games to the bracket system
  - [x] 1.1 Extend shared types with consolation bracket structures
    - Add `ConsolationRound` interface to `packages/shared/src/types.ts` with fields: `roundIndex`, `matchups: Matchup[]`, `resolved: boolean`, `sourceRoundIndex: number`, `placementStart: number`
    - Extend `Bracket` interface with `consolationRounds: ConsolationRound[]` and `currentConsolationIndex: number`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Implement consolation round generation in BracketEngine
    - Add `generateConsolationRounds(bracket: Bracket): ConsolationRound[]` to `BracketEngine.ts`
    - Group eliminated players by the round they were eliminated in
    - For each group of 2 players: create 1 matchup
    - For each group of 4 players: create a mini single-elimination bracket (2 semis + 1 final = 3 matchups across 2 consolation rounds)
    - Assign `placementStart` based on group position (semi-final losers start at 3, quarter-final losers at 5, play-in losers at 9, etc.)
    - _Requirements: 1.1, 1.2, 1.7, 1.8_

  - [x] 1.3 Implement consolation round resolution in BracketEngine
    - Add `resolveConsolationRound(bracket: Bracket, resolver: MatchResolver): Bracket` — resolves the current consolation round's matchups, marks resolved, advances `currentConsolationIndex`
    - Add `isFullyComplete(bracket: Bracket): boolean` — true when main bracket is complete AND all consolation rounds are resolved
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 1.4 Update computePlacements to use consolation results
    - Modify `computePlacements(bracket: Bracket): Map<string, number>` to check for consolation round data
    - When consolation data exists and is resolved: use matchup winners/losers to assign unique placements within each group
    - When no consolation data exists: fall back to existing shared-placement behavior (backwards compatible)
    - _Requirements: 1.3, 1.4_

  - [x] 1.5 Wire consolation rounds into the room game loop
    - In `room.ts` / `roomHandlers.ts`: after the main bracket's final round resolves, call `generateConsolationRounds(bracket)` and store the result
    - Continue the bracket play loop (drive gameplay or SKIP_GAMEPLAY resolution) through consolation rounds before transitioning to END_GAME/END_TOURNAMENT
    - For SKIP_GAMEPLAY: auto-resolve consolation rounds using the same resolver as main bracket
    - For interactive gameplay: use the same drive loop (beginPlaycallerDown → drives → advancePlaycallerBracket) for consolation matchups
    - _Requirements: 1.4, 1.5_

- [x] 2. Define the Lottery Odds Table and draw function
  - [x] 2.1 Create lottery odds module
    - Create `packages/server/src/games/playcaller/lottery/odds.ts`
    - Export `LotteryOddsTable` type alias (`number[][]`)
    - Export `DEFAULT_LOTTERY_ODDS: LotteryOddsTable` — the 10×10 table populated with the user's probability values
    - Validate table structure: 10 rows, 10 columns, each row sums to ~1.0, each column sums to ~1.0
    - _Requirements: 3.6_

  - [x] 2.2 Implement the drawPlacements function
    - Export `drawPlacements(playerCount: number, rng: () => number): number[]` in `odds.ts`
    - Algorithm: sequential weighted sampling without replacement — for each placement column (0 through N-1), draw which remaining seed gets it using column probabilities normalized over remaining seeds
    - Returns array where `result[seedIndex] = placement (1-based)`
    - Handle playerCount < 10 by using the first N rows/columns of the table
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.3 Create barrel export for lottery module
    - Create `packages/server/src/games/playcaller/lottery/index.ts`
    - Re-export all public APIs from odds.ts (and future files in this module)
    - _Requirements: N/A (code organization)_

- [ ] 3. Derive predetermined matchup winners from placement ordering
  - [ ] 3.1 Implement deriveMatchupWinners function
    - Create `packages/server/src/games/playcaller/lottery/deriveWinners.ts`
    - Export `deriveMatchupWinners(bracket: Bracket, targetPlacements: Map<string, number>): Record<string, string>`
    - For main bracket: walk through rounds sequentially, simulating advancement — for each matchup, the player with the lower target placement number wins
    - For consolation rounds: for each matchup, the player with the lower target placement number wins
    - Returns `matchupId → winnerId` for ALL matchups (main + consolation)
    - _Requirements: 3.4_

  - [ ] 3.2 Handle bracket advancement simulation in deriveWinners
    - When walking through main bracket rounds: after determining winners for a round, place them into next-round slots using the same logic as `resolveCurrentRound` (sequential placement for normal rounds, standard bracket order for play-in rounds with byes)
    - This ensures later-round matchups have their playerA/playerB filled before we determine their winner
    - _Requirements: 3.4, 1.6_

- [ ] 4. Implement suppressLoserVictory drive engine handler
  - [ ] 4.1 Create suppressLoserVictory function
    - Create `packages/server/src/games/playcaller/lottery/suppressLoserVictory.ts`
    - Export `suppressLoserVictory(state: DriveState, outcome: PlayOutcome, yardsGained: number, predeterminedWinner: string, rng: RngFunction, config: PlayConfig, matrix: PlayMatrix, offensivePlay: OffensivePlayId, defensivePlay: DefensivePlayId): { outcome: PlayOutcome; yardsGained: number }`
    - Implement offense-loser TD suppression: when offense is loser and yardLine - yardsGained ≤ 0, re-roll a completely fresh outcome until yardLine - newYards ≥ 1 (max 10 attempts, fallback: cap to yardLine - 1)
    - _Requirements: 4.1, 4.6, 4.7, 4.10, 4.11_

  - [ ] 4.2 Implement defense-loser turnover suppression
    - When defense is loser and outcome is "interception" or "fumble": re-roll a completely fresh outcome from the same play config/matrix with new RNG draws
    - The re-rolled outcome may be ANY valid result (gain, incomplete pass, tackle for loss, critical success) — the only restriction is it must not end the drive in the loser's favor (no INT, no fumble, and if it's 4th down the gain must exceed yardsToGo)
    - Max 10 re-roll attempts; fallback: force incomplete_pass with 0 yards (safe non-winning outcome)
    - _Requirements: 4.2, 4.3, 4.6, 4.7, 4.10, 4.11_

  - [ ] 4.3 Implement defense-loser turnover-on-downs suppression
    - When defense is loser and it's 4th down and yardsGained < yardsToGo: re-roll fresh outcome until yardsGained ≥ yardsToGo
    - Edge case: compute modifiedMax for the play; if modifiedMax < yardsToGo, force yardsGained = yardsToGo with outcome "success"
    - _Requirements: 4.4, 4.5, 4.7, 4.10, 4.11_

- [ ] 5. Integrate suppressLoserVictory into the drive resolution path
  - [ ] 5.1 Create resolveLotteryDown wrapper
    - Create `packages/server/src/games/playcaller/lottery/lotteryDriveResolver.ts`
    - Export `resolveLotteryDown(state, offensivePlay, defensivePlay, rng, config, matrix, predeterminedWinner)` — calls `resolveDown`, then checks if suppression is needed, if so reconstructs DriveState with corrected outcome/yardage (recomputing down progression, yard line, completion)
    - _Requirements: 4.7, 4.8, 4.9_

  - [ ] 5.2 Create createLotteryDriveResolver
    - Export `createLotteryDriveResolver(predeterminedWinners: Record<string, string>, rng: RngFunction, config?: PlayConfig, matrix?: PlayMatrix): MatchResolver`
    - Like `createDriveResolver` but uses `resolveLotteryDown` — looks up predetermined winner by matching the two players in the matchup to an entry in `predeterminedWinners`
    - _Requirements: 5.1, 5.2_

  - [ ] 5.3 Add lottery winners module state to PlaycallerPlugin
    - Add module-level state: `let lotteryWinners: Record<string, string> | null = null`
    - Export `setLotteryWinners`, `getLotteryWinners`, `resetLotteryWinners`
    - Modify `resolveMatchupDown()` to check `lotteryWinners` — if entry exists for current matchup, use `resolveLotteryDown` instead of `resolveDown`
    - Reset lottery winners in `resetPlaycallerState()`
    - _Requirements: 4.8, 4.9, 5.1_

- [ ] 6. Add Lottery Mode to session/room configuration
  - [ ] 6.1 Extend shared types for lottery mode
    - Extend `ProgressionMode` type to `"endless" | "tournament" | "lottery"`
    - Add `"LOTTERY_REVEAL"` and `"DRAFT_PICK"` to `RoundPhase` union
    - Add `LotteryState` interface: `{ oddsTable: number[][], placements: Record<string, number>, matchupWinners: Record<string, string> }`
    - Add `DraftPickState` interface: `{ pickOrder: string[], currentPickIndex: number, selections: Record<string, number>, availablePositions: number[] }`
    - Add `lotteryState?: LotteryState | null` and `draftPickState?: DraftPickState | null` to `RoomState`
    - Add `draftPickEnabled?: boolean` to `RoomConfig` (sub-toggle for lottery mode)
    - Add `{ type: "DRAFT_PICK_SELECTION"; payload: { position: number } }` and `{ type: "ADVANCE_LOTTERY_PHASE" }` to `ClientMessage`
    - _Requirements: 2.1, 2.5, 6.8, 7.1, 7.13, 8.1, 8.6, 8.7_

  - [ ] 6.2 Wire lottery mode through server room
    - In `room.ts` `handleJoin`: accept `"lottery"` as valid progressionMode, accept `draftPickEnabled` option
    - Reject `SET_GAME_TYPE` messages when progressionMode is `"lottery"` (force playcaller)
    - Add internal state fields for lottery data (placements, matchup winners)
    - Handle `ADVANCE_LOTTERY_PHASE` message: host-only, transitions LOTTERY_REVEAL → DRAFT_PICK (if enabled) or END_TOURNAMENT (if disabled)
    - Handle `DRAFT_PICK_SELECTION` message with validation, timeout, and bot auto-pick logic
    - _Requirements: 2.2, 2.3, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.13, 8.2, 8.3, 8.6, 8.7_

  - [ ] 6.3 Add Lottery toggle to client landing page
    - In `packages/client/src/pages/LandingPage.tsx`: add "Lottery" as a third option alongside Endless/Tournament toggle buttons
    - When Lottery is selected: show a sub-toggle "Enable Draft Pick Selection" (checkbox or toggle)
    - When Lottery is selected: visually indicate game type is locked to Playcaller
    - Pass `progressionMode: "lottery"` and `draftPickEnabled: boolean` in navigation state to RoomPage
    - _Requirements: 2.4, 6.8_

- [ ] 7. Execute the lottery draw at game start and wire into bracket resolution
  - [ ] 7.1 Perform lottery draw during bracket initialization
    - In `room.ts` bracket init block (`if gameType === "playcaller" && roundNumber === 1`): when `progressionMode === "lottery"`:
      1. After `generateBracket(rankedPlayerIds)`, call `generateConsolationRounds(bracket)`
      2. Call `drawPlacements(playerCount, rng)` using a seeded RNG
      3. Map seed indices to player IDs: `rankedPlayerIds[i]` → placement `drawResult[i]` (note: rankedPlayerIds is already in session-list order — position 1 = last-place finisher = seed 1 = best odds)
      4. Call `deriveMatchupWinners(bracket, placementsMap)` for all matchups (main + consolation)
      5. Store lottery state internally and call `setLotteryWinners(matchupWinners)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [ ] 7.2 Wire lottery resolver for SKIP_GAMEPLAY mode
    - When SKIP_GAMEPLAY=true in lottery mode: build a `lotteryResolver: MatchResolver` that returns `lotteryMatchupWinners[matchupId]` for each matchup
    - Use this resolver for both main bracket rounds and consolation rounds
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.3 Handle post-bracket lottery phase transitions
    - After all rounds (main + consolation) complete in lottery mode: transition to `LOTTERY_REVEAL` phase
    - Include `lotteryState` in STATE_SYNC broadcast during LOTTERY_REVEAL and DRAFT_PICK phases
    - On `ADVANCE_LOTTERY_PHASE` from host: initialize `DraftPickState` and transition to `DRAFT_PICK`
    - On all draft picks complete: transition to `END_TOURNAMENT`
    - _Requirements: 6.1, 6.7, 7.1, 7.8, 8.2, 8.5_

- [ ] 8. Lottery Reveal screen (client)
  - [ ] 8.1 Create LotteryRevealScreen component
    - Create `packages/client/src/games/playcaller/LotteryRevealScreen.tsx`
    - Render the odds table as a styled grid: rows = seed positions (player names, shown in reverse season-finish order — last place first as "Seed 1"), columns = placements (1st–10th), cells = percentage values
    - Highlight each player's actual result cell with visually distinct styling (gold/green background, bold)
    - Two reveal modes based on `draftPickEnabled`:
      - **Draft Pick DISABLED**: animated reveal, results shown one-by-one from 10th place to 1st with staggered timing. Host sees "Finish" button after animation completes.
      - **Draft Pick ENABLED**: instant reveal, all results shown at once. Host sees "Continue to Draft" button immediately.
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 3.8_

  - [ ] 8.2 Add host advance button and phase routing
    - Show "Finish" or "Continue to Draft" button only for the host role (label depends on draftPickEnabled)
    - On click: send `ADVANCE_LOTTERY_PHASE` message
    - In `GameView.tsx`: route `LOTTERY_REVEAL` phase to `LotteryRevealScreen`
    - _Requirements: 6.6, 8.4, 8.6_

- [ ] 9. Draft Pick Selection phase (client + server)
  - [ ] 9.1 Create DraftPickScreen component
    - Create `packages/client/src/games/playcaller/DraftPickScreen.tsx`
    - Show "Player X is on the clock" header with countdown timer (30s)
    - Display draft positions as a vertical list, each with a "SELECT" button (Big Wheel spectator style — all players see the same view)
    - Current picker sees enabled "SELECT" buttons; all other players see disabled buttons (spectating)
    - Already-selected positions show "Pick N — Player Name" with the SELECT button removed
    - When a player taps SELECT: perform a slow reveal animation showing the selection locking in (all players see simultaneously)
    - Add confirmation step before submitting pick (optional — consider if it slows down the flow too much)
    - _Requirements: 7.3, 7.9, 7.10, 7.11, 7.12, 8.5_

  - [ ] 9.2 Wire DraftPickScreen into GameView routing
    - In `GameView.tsx`: route `DRAFT_PICK` phase to `DraftPickScreen`
    - Ensure the component reads `draftPickState` from room state
    - Handle the transition to END_TOURNAMENT when all picks are made (server broadcasts final state)
    - Only render DraftPickScreen when `draftPickEnabled` is true in room config (should not be reachable otherwise since server skips this phase)
    - _Requirements: 8.5, 7.8, 7.13_

- [ ] 10. End-to-end integration and statistical validation
  - [ ] 10.1 Create lottery integration test suite
    - Create `packages/server/src/games/playcaller/lottery/lottery.integration.test.ts`
    - Full flow test: generate bracket → draw placements → derive winners → resolve all rounds → verify placements match draw
    - SKIP_GAMEPLAY test: 100 runs confirming 100% placement compliance
    - Gameplay test: 100 runs with auto-played drives confirming 100% winner compliance via suppression
    - _Requirements: 4.9, 5.3_

  - [ ] 10.2 Statistical validation of lottery draw
    - Run `drawPlacements` 100k times, aggregate placement distributions per seed position
    - Assert each cell matches the odds table within ±2%
    - Determinism test: same seed → same output
    - _Requirements: 3.2, 3.6_

  - [ ] 10.3 Consolation bracket validation
    - Property test: for any player count 2-10, after full resolution with consolation, all placements are unique 1..N
    - Test non-lottery mode: consolation adds unique placements without breaking existing behavior
    - Test backwards compatibility: existing playcaller tests pass without modification
    - _Requirements: 1.3, 1.4, 1.5_
