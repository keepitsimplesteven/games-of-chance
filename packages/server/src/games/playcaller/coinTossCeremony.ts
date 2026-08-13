// packages/server/src/games/playcaller/coinTossCeremony.ts
// Core coin toss ceremony logic for the Playcaller tournament game

import type {
  CoinSide,
  CoinTossCeremonyMatchupState,
  Matchup,
  SideSelection,
} from "@games-of-chance/shared"
import { flipCoin, type RngFunction } from "@games-of-chance/shared"

// ── Result Types ────────────────────────────────────────────────────────────

export type CoinCallResult =
  | { ok: true; state: CoinTossCeremonyMatchupState }
  | { ok: false; error: "INVALID_CALLER" | "INVALID_COIN_SIDE" | "DUPLICATE_CALL" }

export type SideChoiceResult =
  | { ok: true; state: CoinTossCeremonyMatchupState }
  | { ok: false; error: "INVALID_CHOOSER" | "INVALID_SELECTION" }

// ── Helpers ─────────────────────────────────────────────────────────────────

function isValidCoinSide(value: string): value is CoinSide {
  return value === "HEADS" || value === "TAILS"
}

function isValidSideSelection(value: string): value is SideSelection {
  return value === "OFFENSE" || value === "DEFENSE"
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Initializes per-matchup ceremony state for all matchups in a bracket round.
 * playerA (higher seed) is always designated as the Caller.
 */
export function createCeremonyStates(
  matchups: Matchup[]
): Record<string, CoinTossCeremonyMatchupState> {
  const states: Record<string, CoinTossCeremonyMatchupState> = {}

  for (const matchup of matchups) {
    states[matchup.matchupId] = {
      matchupId: matchup.matchupId,
      step: "AWAITING_CALL",
      callerId: matchup.playerA,
      waiterId: matchup.playerB,
      calledSide: null,
      flipOutcome: null,
      flippedAt: null,
      chooserId: null,
      sideSelection: null,
      coinCallDeadlineMs: null,
      sideChoiceDeadlineMs: null,
    }
  }

  return states
}

/**
 * Handles a coin call from a player.
 * Validates the caller, side value, and duplicate call.
 * On success, resolves the flip and determines the Chooser.
 */
export function handleCoinCall(
  state: CoinTossCeremonyMatchupState,
  playerId: string,
  side: string,
  rng?: RngFunction
): CoinCallResult {
  // Validate caller
  if (playerId !== state.callerId) {
    return { ok: false, error: "INVALID_CALLER" }
  }

  // Validate state — reject duplicate calls
  if (state.step !== "AWAITING_CALL") {
    return { ok: false, error: "DUPLICATE_CALL" }
  }

  // Validate coin side value
  if (!isValidCoinSide(side)) {
    return { ok: false, error: "INVALID_COIN_SIDE" }
  }

  // Resolve the flip
  const outcome = flipCoin(rng)
  const flippedAt = Date.now()

  // Determine Chooser: if outcome matches call, Caller wins; otherwise Waiter wins
  const chooserId = outcome === side ? state.callerId : state.waiterId

  const updatedState: CoinTossCeremonyMatchupState = {
    ...state,
    step: "AWAITING_CHOICE",
    calledSide: side,
    flipOutcome: outcome,
    flippedAt,
    chooserId,
  }

  return { ok: true, state: updatedState }
}

/**
 * Handles a side choice from the designated Chooser.
 * Validates the player is the Chooser and that the selection is valid.
 * Records the offense/defense assignment.
 */
export function handleSideChoice(
  state: CoinTossCeremonyMatchupState,
  playerId: string,
  selection: string
): SideChoiceResult {
  // Validate chooser
  if (playerId !== state.chooserId) {
    return { ok: false, error: "INVALID_CHOOSER" }
  }

  // Validate selection value
  if (!isValidSideSelection(selection)) {
    return { ok: false, error: "INVALID_SELECTION" }
  }

  const updatedState: CoinTossCeremonyMatchupState = {
    ...state,
    step: "COMPLETE",
    sideSelection: selection,
  }

  return { ok: true, state: updatedState }
}

/**
 * Auto-resolves the coin call step on timeout.
 * Assigns a random call using the provided RNG, then resolves the flip.
 */
export function autoResolveCoinCall(
  state: CoinTossCeremonyMatchupState,
  rng?: RngFunction
): CoinTossCeremonyMatchupState {
  // Auto-assign a random coin call
  const autoCall = flipCoin(rng)

  // Resolve the flip
  const outcome = flipCoin(rng)
  const flippedAt = Date.now()

  // Determine Chooser
  const chooserId = outcome === autoCall ? state.callerId : state.waiterId

  return {
    ...state,
    step: "AWAITING_CHOICE",
    calledSide: autoCall,
    flipOutcome: outcome,
    flippedAt,
    chooserId,
  }
}

/**
 * Auto-resolves the side choice step on timeout.
 * Assigns "OFFENSE" to the Chooser.
 */
export function autoResolveSideChoice(
  state: CoinTossCeremonyMatchupState
): CoinTossCeremonyMatchupState {
  return {
    ...state,
    step: "COMPLETE",
    sideSelection: "OFFENSE",
  }
}

/**
 * Returns true when all matchups have completed their ceremonies.
 */
export function allCeremoniesComplete(
  states: Record<string, CoinTossCeremonyMatchupState>
): boolean {
  return Object.values(states).every((s) => s.step === "COMPLETE")
}

/**
 * Extracts offense/defense player mapping from completed ceremony states.
 * For each matchup:
 * - If Chooser picked "OFFENSE": Chooser = offense, other player = defense
 * - If Chooser picked "DEFENSE": Chooser = defense, other player = offense
 */
export function getAssignments(
  states: Record<string, CoinTossCeremonyMatchupState>
): Record<string, { offense: string; defense: string }> {
  const assignments: Record<string, { offense: string; defense: string }> = {}

  for (const [matchupId, state] of Object.entries(states)) {
    if (state.step !== "COMPLETE" || !state.chooserId || !state.sideSelection) {
      continue
    }

    // The "other" player is whoever is NOT the chooser
    const otherPlayerId =
      state.chooserId === state.callerId ? state.waiterId : state.callerId

    if (state.sideSelection === "OFFENSE") {
      assignments[matchupId] = {
        offense: state.chooserId,
        defense: otherPlayerId,
      }
    } else {
      // Chooser picked DEFENSE
      assignments[matchupId] = {
        offense: otherPlayerId,
        defense: state.chooserId,
      }
    }
  }

  return assignments
}
