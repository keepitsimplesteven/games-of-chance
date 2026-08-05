import type { PlayConfig, PlayMatrix } from "../types"

/**
 * v1-balanced — The first tuned configuration.
 *
 * Balance results (from property tests):
 * - Random vs random: ~50/50 win rate (46-54% range)
 * - Avg yards per play: 2.5–3.5 regardless of defense
 * - Greedy offense vs random defense: ~56%
 * - Random offense vs greedy defense: ~54%
 * - Greedy offense vs perfect counter: offense still wins ~38%
 * - Max exploit (best offense + worst defense): ~73% offense
 *
 * Starting yard line: 20
 *
 * Design philosophy:
 * - Safe plays: high success (75-78%), low ceiling (4-6 yds)
 * - Aggressive plays: low success (45-55%), high ceiling (9-15 yds)
 * - Matching axis defense: shrinks variance + moderate success penalty
 * - Mismatched axis defense: slight boost + expanded range
 * - Aggressive vs aggressive (same axis): coin-flip — high crit both ways
 */

export const PLAY_CONFIG: PlayConfig = {
  offensivePlays: {
    "run-safe": {
      id: "run-safe",
      name: "Inside Run",
      axis: "run",
      style: "safe",
      successRate: 0.78,
      yardageRange: { min: 2, max: 4 },
      criticalSuccessChance: 0.08,
      criticalFailureChance: 0.02,
    },
    "run-aggressive": {
      id: "run-aggressive",
      name: "Outside Run",
      axis: "run",
      style: "aggressive",
      successRate: 0.55,
      yardageRange: { min: 3, max: 9 },
      criticalSuccessChance: 0.12,
      criticalFailureChance: 0.05,
    },
    "pass-safe": {
      id: "pass-safe",
      name: "Short Pass",
      axis: "pass",
      style: "safe",
      successRate: 0.75,
      yardageRange: { min: 3, max: 6 },
      criticalSuccessChance: 0.06,
      criticalFailureChance: 0.02,
    },
    "pass-aggressive": {
      id: "pass-aggressive",
      name: "Deep Pass",
      axis: "pass",
      style: "aggressive",
      successRate: 0.45,
      yardageRange: { min: 5, max: 15 },
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
  // RUN-SAFE offense
  "run-safe:run-safe": {
    successRateMod: -0.08,
    yardageMinMod: 1,
    yardageMaxMod: -1,
    critSuccessMod: -0.03,
    critFailureMod: 0.01,
  },
  "run-safe:run-aggressive": {
    successRateMod: -0.12,
    yardageMinMod: 1,
    yardageMaxMod: -1,
    critSuccessMod: 0.03,
    critFailureMod: 0.02,
  },
  "run-safe:pass-safe": {
    successRateMod: 0.03,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.02,
    critFailureMod: -0.01,
  },
  "run-safe:pass-aggressive": {
    successRateMod: 0.04,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.01,
  },

  // RUN-AGGRESSIVE offense
  "run-aggressive:run-safe": {
    successRateMod: -0.08,
    yardageMinMod: 1,
    yardageMaxMod: -2,
    critSuccessMod: -0.04,
    critFailureMod: 0.01,
  },
  "run-aggressive:run-aggressive": {
    successRateMod: -0.10,
    yardageMinMod: 0,
    yardageMaxMod: -2,
    critSuccessMod: 0.05,
    critFailureMod: 0.03,
  },
  "run-aggressive:pass-safe": {
    successRateMod: 0.03,
    yardageMinMod: -1,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.02,
  },
  "run-aggressive:pass-aggressive": {
    successRateMod: 0.04,
    yardageMinMod: -1,
    yardageMaxMod: 2,
    critSuccessMod: 0.04,
    critFailureMod: -0.02,
  },

  // PASS-SAFE offense
  "pass-safe:run-safe": {
    successRateMod: 0.03,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.02,
    critFailureMod: -0.01,
  },
  "pass-safe:run-aggressive": {
    successRateMod: 0.04,
    yardageMinMod: 0,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.01,
  },
  "pass-safe:pass-safe": {
    successRateMod: -0.08,
    yardageMinMod: 1,
    yardageMaxMod: -1,
    critSuccessMod: -0.02,
    critFailureMod: 0.01,
  },
  "pass-safe:pass-aggressive": {
    successRateMod: -0.12,
    yardageMinMod: 1,
    yardageMaxMod: -1,
    critSuccessMod: 0.03,
    critFailureMod: 0.02,
  },

  // PASS-AGGRESSIVE offense
  "pass-aggressive:run-safe": {
    successRateMod: 0.04,
    yardageMinMod: -1,
    yardageMaxMod: 1,
    critSuccessMod: 0.03,
    critFailureMod: -0.03,
  },
  "pass-aggressive:run-aggressive": {
    successRateMod: 0.05,
    yardageMinMod: -1,
    yardageMaxMod: 2,
    critSuccessMod: 0.04,
    critFailureMod: -0.03,
  },
  "pass-aggressive:pass-safe": {
    successRateMod: -0.08,
    yardageMinMod: 1,
    yardageMaxMod: -3,
    critSuccessMod: -0.05,
    critFailureMod: 0.01,
  },
  "pass-aggressive:pass-aggressive": {
    successRateMod: -0.10,
    yardageMinMod: 0,
    yardageMaxMod: -3,
    critSuccessMod: 0.06,
    critFailureMod: 0.03,
  },
}
