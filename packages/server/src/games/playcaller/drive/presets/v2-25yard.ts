import type { PlayConfig, PlayMatrix } from "../types"

/**
 * v2-25yard — 25-yard starting line with boosted yardage to compensate.
 *
 * Changes from v1-balanced:
 * - Starting yard line: 25 (up from 20)
 * - Inside Run: min 1, max 6 (was 2-4) — wider range, lower floor
 * - Outside Run: min 2, max 11 (was 3-9) — wider range
 * - Short Pass: min 2, max 8 (was 3-6) — bumped ceiling
 * - Deep Pass: min 4, max 17 (was 5-15) — bumped ceiling
 * - Matrix: reduced yardageMinMod on matched-axis (0 instead of 1 for runs)
 *           so runs don't collapse to a single value
 * - Slightly higher success rates on aggressive plays to sustain conversion rate
 *
 * Target: ~50/50 win rate, ~3.5-4.0 avg yards/play, wider yardage spreads
 */

export const PLAY_CONFIG: PlayConfig = {
  offensivePlays: {
    "run-safe": {
      id: "run-safe",
      name: "Inside Run",
      axis: "run",
      style: "safe",
      successRate: 0.78,
      yardageRange: { min: 1, max: 6 },
      criticalSuccessChance: 0.08,
      criticalFailureChance: 0.02,
    },
    "run-aggressive": {
      id: "run-aggressive",
      name: "Outside Run",
      axis: "run",
      style: "aggressive",
      successRate: 0.58,
      yardageRange: { min: 2, max: 11 },
      criticalSuccessChance: 0.12,
      criticalFailureChance: 0.05,
    },
    "pass-safe": {
      id: "pass-safe",
      name: "Short Pass",
      axis: "pass",
      style: "safe",
      successRate: 0.75,
      yardageRange: { min: 2, max: 8 },
      criticalSuccessChance: 0.06,
      criticalFailureChance: 0.02,
    },
    "pass-aggressive": {
      id: "pass-aggressive",
      name: "Deep Pass",
      axis: "pass",
      style: "aggressive",
      successRate: 0.48,
      yardageRange: { min: 4, max: 17 },
      criticalSuccessChance: 0.15,
      criticalFailureChance: 0.08,
    },
  },
  defensivePlays: {
    "run-safe": { id: "run-safe", name: "Run Contain", axis: "run", style: "safe" },
    "run-aggressive": { id: "run-aggressive", name: "Blitz", axis: "run", style: "aggressive" },
    "pass-safe": { id: "pass-safe", name: "Zone Coverage", axis: "pass", style: "safe" },
    "pass-aggressive": { id: "pass-aggressive", name: "Man Press", axis: "pass", style: "aggressive" },
  },
}

export const PLAY_MATRIX: PlayMatrix = {
  // ═══════════════════════════════════════════════════════════
  // RUN-SAFE offense (Inside Run) — base: 78%, 1-6 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (matched safe): moderate penalty, slight range shrink
  "run-safe:run-safe": {
    successRateMod: -0.08,
    yardageMinMod: 0,     // was 1 — keep min at 1 so range stays wide
    yardageMaxMod: -1,
    critSuccessMod: -0.03,
    critFailureMod: 0.01,
  },
  // vs Blitz (matched aggressive): bigger penalty, coin-flip potential
  "run-safe:run-aggressive": {
    successRateMod: -0.12,
    yardageMinMod: 0,     // was 1 — keep min at 1
    yardageMaxMod: -2,
    critSuccessMod: 0.03,
    critFailureMod: 0.02,
  },
  // vs Zone Coverage (mismatched): slight boost
  "run-safe:pass-safe": {
    successRateMod: 0.03,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.02,
    critFailureMod: -0.01,
  },
  // vs Man Press (mismatched): slight boost
  "run-safe:pass-aggressive": {
    successRateMod: 0.04,
    yardageMinMod: 0,
    yardageMaxMod: 2,
    critSuccessMod: 0.03,
    critFailureMod: -0.01,
  },

  // ═══════════════════════════════════════════════════════════
  // RUN-AGGRESSIVE offense (Outside Run) — base: 57%, 2-11 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (matched safe): contain the big play
  "run-aggressive:run-safe": {
    successRateMod: -0.08,
    yardageMinMod: 0,
    yardageMaxMod: -3,
    critSuccessMod: -0.04,
    critFailureMod: 0.01,
  },
  // vs Blitz (matched aggressive): high variance coin-flip
  "run-aggressive:run-aggressive": {
    successRateMod: -0.10,
    yardageMinMod: 0,
    yardageMaxMod: -3,
    critSuccessMod: 0.05,
    critFailureMod: 0.03,
  },
  // vs Zone Coverage (mismatched): offense boosted
  "run-aggressive:pass-safe": {
    successRateMod: 0.03,
    yardageMinMod: -1,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.02,
  },
  // vs Man Press (mismatched): offense boosted more
  "run-aggressive:pass-aggressive": {
    successRateMod: 0.04,
    yardageMinMod: -1,
    yardageMaxMod: 2,
    critSuccessMod: 0.04,
    critFailureMod: -0.02,
  },

  // ═══════════════════════════════════════════════════════════
  // PASS-SAFE offense (Short Pass) — base: 75%, 2-8 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (mismatched): slight boost
  "pass-safe:run-safe": {
    successRateMod: 0.03,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.02,
    critFailureMod: -0.01,
  },
  // vs Blitz (mismatched): bigger boost (blitz leaves gaps)
  "pass-safe:run-aggressive": {
    successRateMod: 0.05,
    yardageMinMod: 0,
    yardageMaxMod: 2,
    critSuccessMod: 0.03,
    critFailureMod: -0.01,
  },
  // vs Zone Coverage (matched safe): penalty, shrink range
  "pass-safe:pass-safe": {
    successRateMod: -0.08,
    yardageMinMod: 0,
    yardageMaxMod: -2,
    critSuccessMod: -0.02,
    critFailureMod: 0.01,
  },
  // vs Man Press (matched aggressive): bigger penalty
  "pass-safe:pass-aggressive": {
    successRateMod: -0.12,
    yardageMinMod: 0,
    yardageMaxMod: -2,
    critSuccessMod: 0.03,
    critFailureMod: 0.02,
  },

  // ═══════════════════════════════════════════════════════════
  // PASS-AGGRESSIVE offense (Deep Pass) — base: 47%, 4-17 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (mismatched): boost, expand
  "pass-aggressive:run-safe": {
    successRateMod: 0.04,
    yardageMinMod: -1,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.03,
  },
  // vs Blitz (mismatched): big boost (blitz leaves deep open)
  "pass-aggressive:run-aggressive": {
    successRateMod: 0.06,
    yardageMinMod: -1,
    yardageMaxMod: 3,
    critSuccessMod: 0.04,
    critFailureMod: -0.03,
  },
  // vs Zone Coverage (matched safe): contain the deep ball
  "pass-aggressive:pass-safe": {
    successRateMod: -0.08,
    yardageMinMod: 1,
    yardageMaxMod: -4,
    critSuccessMod: -0.05,
    critFailureMod: 0.01,
  },
  // vs Man Press (matched aggressive): coin-flip
  "pass-aggressive:pass-aggressive": {
    successRateMod: -0.10,
    yardageMinMod: 0,
    yardageMaxMod: -4,
    critSuccessMod: 0.06,
    critFailureMod: 0.03,
  },
}
