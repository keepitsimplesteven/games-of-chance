// packages/client/src/games/playcaller/field-utils.ts
// Pure utility functions for field visualization, formatting, and drive summary.

import type { PlayResult, DriveState } from "./field-utils.types"

// ── Yard Line → Y Position ─────────────────────────────────────────────────

/**
 * Maps a yard line value to a Y pixel coordinate on the field SVG.
 * Yard line 0 = top of the playing area (just below end zone).
 * Yard line maxYards = bottom of the playing area.
 */
export function yardLineToY(
  yardLine: number,
  maxYards: number,
  fieldHeight: number,
  endZoneHeight: number
): number {
  return endZoneHeight + (yardLine / maxYards) * fieldHeight
}

// ── Down/Distance Formatting ────────────────────────────────────────────────

const ORDINALS = ["1st", "2nd", "3rd", "4th"]

/**
 * Formats down and yards-to-go into a display string (e.g. "2nd & 7").
 */
export function formatDownDistance(down: number, yardsToGo: number): string {
  const ordinal = ORDINALS[down - 1] ?? `${down}th`
  return `${ordinal} & ${yardsToGo}`
}

// ── Round Name Derivation ───────────────────────────────────────────────────

/**
 * Derives a human-readable round name from the round index and total rounds.
 * The last round is "Final", second-to-last is "Semifinal", third-to-last is
 * "Quarterfinal", and all earlier rounds are "Round N" (1-indexed).
 */
export function getRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundIndex
  if (roundsFromEnd === 1) return "Final"
  if (roundsFromEnd === 2) return "Semifinal"
  if (roundsFromEnd === 3) return "Quarterfinal"
  return `Round ${roundIndex + 1}`
}

// ── Play Result Formatting ──────────────────────────────────────────────────

/** Simple play name fallback using the offensive play ID. */
function getPlayDisplayName(offensivePlay: string): string {
  const names: Record<string, string> = {
    "run-safe": "Inside Run",
    "run-aggressive": "Outside Run",
    "pass-safe": "Short Pass",
    "pass-aggressive": "Deep Pass",
  }
  return names[offensivePlay] ?? offensivePlay
}

/**
 * Formats a PlayResult into a human-readable single-line string.
 * Uses a simple fallback for play names (task 3.1 will extend with
 * circumstance-aware naming).
 */
export function formatPlayResult(result: PlayResult): string {
  const playName = getPlayDisplayName(result.offensivePlay)
  if (result.outcome === "interception") return `${playName} — Intercepted!`
  if (result.outcome === "fumble") return `${playName} — Fumble!`
  if (result.outcome === "incomplete_pass") return `${playName} — Incomplete`
  if (result.outcome === "tackle_for_loss")
    return `${playName} — Loss of ${Math.abs(result.yardsGained)}`
  return `${playName} — ${result.yardsGained} yard${result.yardsGained !== 1 ? "s" : ""}`
}

// ── Drive Summary ───────────────────────────────────────────────────────────

/**
 * Computes summary stats for a completed drive.
 * Returns null if drive has no completion data.
 */
export function computeDriveSummary(state: DriveState) {
  if (!state.completion) return null
  return {
    totalPlays: state.playHistory.length,
    totalYards: state.playHistory.reduce(
      (sum, entry) => sum + entry.result.yardsGained,
      0
    ),
    endingType: state.completion.endingType,
    winner: state.completion.winner,
  }
}
