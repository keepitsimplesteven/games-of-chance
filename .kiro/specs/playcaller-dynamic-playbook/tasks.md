# Implementation Plan: Playcaller Dynamic Playbook

## Overview

Enhance the presentational layer of the Playcaller football game by expanding the circumstance classifier from 3 to 7 buckets, replacing fixed 1:1 play-name mappings with weighted play pools, introducing a 3-tier commentary cascade, rewriting the outcome categorizer with corrected precedence, and adapting the play art resolver with fallback logic. All changes are purely cosmetic — the drive engine remains unchanged.

## Tasks

- [ ] 1. Expand types and interfaces
  - [ ] 1.1 Expand Circumstance type and add PlayDefinition interfaces
    - Update `packages/client/src/games/playcaller/play-names/types.ts`:
      - Expand `Circumstance` union to include `"standard" | "short_yardage" | "medium_yardage" | "long_yardage" | "desperation" | "goal_line" | "must_convert"`
      - Add `PlaySlot` type alias: `"run-safe" | "run-aggressive" | "pass-safe" | "pass-aggressive"`
      - Add `PlayDefinition` interface with fields: `displayName` (string 1–50), `formation` (string 1–30), `circumstances` (Circumstance[]), optional `weight` (number > 0, default 1), optional `messages` (Partial<PlayByPlayMessages>)
      - Add `PlayPool` type: `Record<PlaySlot, PlayDefinition[]>`
      - Add `PlayPoolRegistry` interface: `{ offense: PlayPool; defense: PlayPool }`
      - Remove old `PlayNameEntry`, `PlayNamePool`, `PlayNameMap` types (replaced by new pool system)
    - _Requirements: 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 1.2 Expand OutcomeCategory and commentary types
    - Update `packages/client/src/games/playcaller/play-by-play/types.ts`:
      - Add `"turnover_on_downs"` and `"first_down"` to the `OutcomeCategory` union
      - Add `CommentaryPhase` type: `"preSnap" | "activePlay" | "outcome"`
      - Add `CommentaryTiers` interface with `playSpecific`, `circumstance`, and `default` tier fields
      - Add `OutcomeMessages` type: `Record<OutcomeCategory, string[]>`
      - Update `PlayByPlayMessages` interface to align with `CommentaryPhase` keys
    - _Requirements: 5.1, 5.6, 6.1, 6.2, 6.3, 6.5, 6.7, 6.8, 6.9_

  - [ ] 1.3 Update PlayArtVariants type to support partial circumstance coverage
    - Update `packages/client/src/games/playcaller/play-art/types.ts`:
      - Change `PlayArtVariants` from `Record<Circumstance, PlayArtData>` to `Partial<Record<Circumstance, PlayArtData>>`
    - _Requirements: 8.1, 8.2_

- [ ] 2. Rewrite Circumstance Classifier
  - [ ] 2.1 Implement expanded classifyCircumstance function
    - Rewrite `packages/client/src/games/playcaller/play-names/classify.ts`:
      - Change signature to accept three parameters: `(down: number, yardsToGo: number, yardLine: number)`
      - Implement priority rules in order: goal_line (yardLine ≤ 5) → desperation (down 4, yardsToGo ≥ 4) → must_convert (down 4, yardsToGo 1–3) → short_yardage (yardsToGo 1–2) → medium_yardage (yardsToGo 3–5) → long_yardage (yardsToGo 6–9) → standard
      - Ensure function is pure with no side effects or state mutation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 9.4_

  - [ ]* 2.2 Write property test for Circumstance Classifier correctness
    - **Property 1: Circumstance Classifier Correctness**
    - Create test file at `packages/client/src/games/playcaller/play-names/__tests__/classify.property.test.ts`
    - Generate arbitrary `(down ∈ 1–4, yardsToGo ∈ 1–99, yardLine ∈ 1–99)` inputs
    - Assert the classifier returns the unique correct Circumstance per priority rules
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**

  - [ ] 2.3 Update useCircumstance hook to pass yardLine
    - Update `packages/client/src/games/playcaller/hooks/useCircumstance.ts`:
      - Pass `driveState.yardLine` as third argument to `classifyCircumstance`
      - Add `driveState?.yardLine` to the `useMemo` dependency array
    - _Requirements: 1.9, 9.2_

- [ ] 3. Implement Play Pool and Selector
  - [ ] 3.1 Create PlayDefinition validation function
    - Create `packages/client/src/games/playcaller/play-names/validate.ts`:
      - Export `validatePlayDefinition(def: unknown): PlayDefinition` that validates displayName length (1–50), formation length (1–30), circumstances is non-empty with only valid Circumstance values, weight (if present) is > 0
      - Throw descriptive error on invalid definitions (naming invalid field/value)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [ ]* 3.2 Write property test for PlayDefinition validation
    - **Property 2: PlayDefinition Validation**
    - Create test at `packages/client/src/games/playcaller/play-names/__tests__/validate.property.test.ts`
    - Generate arbitrary objects and verify acceptance only when all constraints are met
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**

  - [ ] 3.3 Implement selectPlay function
    - Create `packages/client/src/games/playcaller/play-names/select.ts`:
      - Export `selectPlay(pool: PlayDefinition[], circumstance: Circumstance, rng: () => number): PlayDefinition`
      - Filter pool to entries whose `circumstances` includes current circumstance
      - If empty, re-filter using "standard" and log warning in dev mode (`NODE_ENV === "development"`)
      - Compute total weight, roll rng, iterate with cumulative weight to select
      - Return the selected PlayDefinition
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.3_

  - [ ]* 3.4 Write property test for Play Selector always returns valid match
    - **Property 3: Play Selector Always Returns a Valid Match**
    - Create test at `packages/client/src/games/playcaller/play-names/__tests__/select.property.test.ts`
    - Generate non-empty pools with at least one "standard" entry and any valid Circumstance
    - Assert selectPlay always returns a PlayDefinition whose circumstances includes either the requested circumstance or "standard"
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**

  - [ ]* 3.5 Write property test for weighted selection distribution
    - **Property 4: Weighted Selection Distribution**
    - In the same test file, verify over 1000+ runs that selection frequency converges to `wi / Σwj` within statistical tolerance
    - **Validates: Requirements 3.2, 3.7**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create Play Pool Data (offense and defense)
  - [ ] 5.1 Create offense play pool registry
    - Rewrite `packages/client/src/games/playcaller/play-names/offense-names.ts`:
      - Define `PlayDefinition[]` arrays for each of the 4 offensive PlaySlots
      - Ensure coverage of all 7 circumstances per slot (at least 1 entry each)
      - Place "QB Sneak" only in run-safe for {short_yardage, goal_line, must_convert}
      - Place "Hail Mary" only in pass-aggressive for {desperation}
      - Place "Screen Pass" only in pass-safe/pass-aggressive, exclude from {desperation, must_convert}
      - Include play-specific commentary messages where appropriate
      - Export as `offensePlayPool: PlayPool`
    - _Requirements: 4.2, 4.3, 4.4, 10.1, 10.2_

  - [ ] 5.2 Create defense play pool registry
    - Rewrite `packages/client/src/games/playcaller/play-names/defense-names.ts`:
      - Define `PlayDefinition[]` arrays for each of the 4 defensive PlaySlots
      - Ensure coverage of all 7 circumstances per slot (at least 1 entry each)
      - Place "Prevent Defense" only in pass-safe for {long_yardage, desperation}
      - Include play-specific commentary messages where appropriate
      - Export as `defensePlayPool: PlayPool`
    - _Requirements: 4.1, 10.1, 10.2_

  - [ ] 5.3 Create PlayPoolRegistry and validate at load time
    - Update `packages/client/src/games/playcaller/play-names/index.ts`:
      - Import offense and defense pools
      - Construct `PlayPoolRegistry` combining both
      - Run validation on all PlayDefinitions at module load (dev mode: throw on invalid)
      - Export the registry
    - _Requirements: 2.6, 2.7, 10.1, 10.2_

  - [ ]* 5.4 Write property test for play pool placement constraints
    - **Property 5: Play Pool Placement Constraints**
    - Create test at `packages/client/src/games/playcaller/play-names/__tests__/pool-constraints.property.test.ts`
    - Scan actual pool data and verify: Prevent Defense only in (pass-safe, defense, {long_yardage, desperation}), QB Sneak only in (run-safe, offense, {short_yardage, goal_line, must_convert}), Screen Pass excluded from {desperation, must_convert}, Hail Mary only in (pass-aggressive, offense, {desperation})
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ]* 5.5 Write property test for minimum coverage guarantee
    - **Property 11: Minimum Coverage Guarantee**
    - In the same test file, enumerate all 56 combinations (4 slots × 2 roles × 7 circumstances) and assert each has at least 1 valid PlayDefinition
    - **Validates: Requirements 10.1, 10.2**

- [ ] 6. Rewrite Outcome Categorizer
  - [ ] 6.1 Implement expanded categorizeOutcome function
    - Rewrite `categorizeOutcome` in `packages/client/src/games/playcaller/play-by-play/types.ts`:
      - Change signature to `(outcome, yardsGained, yardsToGo, yardLine, down)`
      - Implement precedence: turnover (interception/fumble) → incomplete → negative (yards < 0) → touchdown (yardsGained ≥ yardLine for success/critical_success) → turnover_on_downs (down 4, yards < yardsToGo) → big_gain (≥ 10) → first_down (≥ yardsToGo, < 10) → small_gain
      - Remove old `tackle_for_loss` handling (now covered by negative check)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 6.2 Write property test for Outcome Categorization precedence
    - **Property 8: Outcome Categorization Precedence**
    - Create test at `packages/client/src/games/playcaller/play-by-play/__tests__/categorize.property.test.ts`
    - Generate arbitrary valid inputs (PlayOutcome, yardsGained, yardsToGo, yardLine, down)
    - Assert exactly one category returned, following precedence order
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

- [ ] 7. Implement Commentary Resolver
  - [ ] 7.1 Implement resolveCommentary function
    - Create `packages/client/src/games/playcaller/play-by-play/resolver.ts`:
      - Export `resolveCommentary(phase, tiers, outcomeCategory, rng): string`
      - Tier selection: rng < 0.6 → play-specific, < 0.9 → circumstance, else → default
      - Cascade on empty: play-specific → circumstance → default
      - For outcome phase, key into OutcomeCategory within each tier
      - Pick uniformly from resolved tier's message array
      - Function must not mutate inputs or access DriveState
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 9.3_

  - [ ] 7.2 Create circumstance-level commentary data
    - Create `packages/client/src/games/playcaller/play-by-play/circumstance-messages.ts`:
      - Export `CircumstanceCommentary` registry: `Record<Circumstance, Record<CommentaryPhase, string[]>>`
      - Provide at least 3 distinct messages per (Circumstance, Phase) combination (minimum 63 messages total)
      - Messages should reflect the game situation (e.g., "4th and long" for desperation, "goal line stand" for goal_line)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 7.3 Create default generic commentary data
    - Update `packages/client/src/games/playcaller/play-by-play/messages.ts`:
      - Ensure default tier has at least one message for every CommentaryPhase
      - For outcome phase, ensure at least one message per OutcomeCategory
      - These form the guaranteed fallback that terminates the cascade
    - _Requirements: 5.7_

  - [ ]* 7.4 Write property test for Commentary Cascade always resolves
    - **Property 6: Commentary Cascade Always Resolves**
    - Create test at `packages/client/src/games/playcaller/play-by-play/__tests__/resolver.property.test.ts`
    - Generate tier configs with selectively empty arrays (but default always populated)
    - Assert resolveCommentary always returns a non-empty string
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.7**

  - [ ]* 7.5 Write property test for Commentary Tier selection distribution
    - **Property 7: Commentary Tier Selection Distribution**
    - In the same test file, with all tiers populated, run 1000+ iterations and assert play-specific ≈ 60%, circumstance ≈ 30%, default ≈ 10% within tolerance
    - **Validates: Requirements 5.1**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Adapt Play Art Resolver
  - [ ] 9.1 Implement resolvePlayArt function with fallback logic
    - Create `packages/client/src/games/playcaller/play-art/resolve.ts`:
      - Export `resolvePlayArt(circumstance, slot, role): PlayArtData`
      - Look up art registry by (role, slot, circumstance)
      - If not found, fall back to (role, slot, "standard")
      - If still not found, return empty formation diagram (line of scrimmage + position markers, no routes)
      - Art lookup uses only circumstance + slot as keys, independent of PlayDefinition displayName
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.2 Update offense and defense art data for new circumstances
    - Update `packages/client/src/games/playcaller/play-art/offense.ts` and `defense.ts`:
      - Change exports to use `Partial<Record<Circumstance, PlayArtData>>` per slot
      - Add art variants for new circumstances where appropriate (goal_line, must_convert, etc.)
      - Ensure "standard" art exists for every slot/role as the guaranteed fallback
    - _Requirements: 8.1, 8.2_

  - [ ]* 9.3 Write property test for Play Art fallback resolution
    - **Property 10: Play Art Fallback Resolution**
    - Create test at `packages/client/src/games/playcaller/play-art/__tests__/resolve.property.test.ts`
    - Generate all 56 combinations plus partial registries, assert a valid PlayArtData is always returned
    - Assert two different PlayDefinitions sharing the same slot and circumstance resolve to identical art
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 10. Wire components together (hooks and UI integration)
  - [ ] 10.1 Update usePlayCards hook to use weighted pool selection
    - Rewrite `packages/client/src/games/playcaller/hooks/usePlayCards.ts`:
      - Import `selectPlay` and the `PlayPoolRegistry`
      - For each of the 4 PlaySlots, call `selectPlay` with the current circumstance and an RNG function
      - Return array of 4 `PlayCardData` objects (one per slot) with the selected PlayDefinition's displayName, formation, and resolved art
      - Each slot selection is independent (separate random draw)
    - _Requirements: 3.5, 3.6, 9.2_

  - [ ] 10.2 Integrate commentary resolver into play-by-play flow
    - Update `packages/client/src/games/playcaller/play-by-play/selectCommentary.ts`:
      - Replace existing commentary selection with calls to `resolveCommentary`
      - Build `CommentaryTiers` from the selected PlayDefinition's messages (play-specific), circumstance-messages (circumstance tier), and default messages (default tier)
      - Resolve each of the 3 phases independently
      - Pass the computed OutcomeCategory when resolving the outcome phase
    - _Requirements: 5.1, 5.5, 5.6, 5.8, 9.3_

  - [ ] 10.3 Update PlayCard component to use new PlayDefinition data
    - Update any references in `packages/client/src/games/playcaller/PlayCard.tsx` and `PlayCardGrid.tsx` that read from the old `PlayNameEntry` / `PlayNameMap` structures to use the new `PlayDefinition` shape (displayName, formation)
    - _Requirements: 2.1, 2.2_

  - [ ]* 10.4 Write property test for Presentational Purity
    - **Property 9: Presentational Purity (No State Mutation)**
    - Create test at `packages/client/src/games/playcaller/__tests__/purity.property.test.ts`
    - Deep-freeze DriveState inputs, call classifyCircumstance, selectPlay, and resolveCommentary
    - Assert no throws (no mutation attempted) and same inputs + same RNG seed produce same outputs
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Final verification and drive engine isolation check
  - [ ] 12.1 Verify drive engine is unchanged
    - Confirm `packages/server/src/games/playcaller/drive/engine.ts` has zero modifications
    - Write a unit test that runs two drives with identical Play_Slot selections and RNG seed but different PlayDefinition displayNames, and asserts byte-equal resolution histories
    - _Requirements: 9.1, 9.5_

  - [ ] 12.2 Update callers of categorizeOutcome to pass new parameters
    - Search for all call sites of `categorizeOutcome` across the codebase
    - Update each to pass the new `yardLine` and `down` parameters
    - Update `packages/server/src/games/playcaller/drive/playByPlay.ts` if it calls categorizeOutcome
    - _Requirements: 6.4, 6.5, 6.9_

  - [ ]* 12.3 Write integration test for end-to-end presentational flow
    - Test: DriveState → classifyCircumstance → selectPlay → resolvePlayArt → resolveCommentary chain produces valid outputs for every combination
    - Test: Drive engine produces identical PlayOutcome regardless of which PlayDefinition was selected
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations target `.ts`/`.tsx` files
- The existing `classify.ts`, `types.ts`, `offense-names.ts`, `defense-names.ts`, and `categorizeOutcome` are being rewritten in-place
- The `useCircumstance` hook now takes `yardLine` into account via `driveState.yardLine`
- The drive engine remains completely unchanged — all changes are presentational

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "6.2"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "12.1", "12.2"] },
    { "id": 11, "tasks": ["12.3"] }
  ]
}
```
