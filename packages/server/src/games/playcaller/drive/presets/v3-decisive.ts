import type { PlayConfig, PlayMatrix } from "../types"

/**
 * v3-decisive — Stronger punishment/reward for correct/wrong play calls.
 *
 * Philosophy: Making the "right" call should feel meaningfully better.
 * Making the "wrong" call should sting. The in-between (partial reads) stays moderate.
 *
 * Changes from v2:
 * - Matched axis modifiers are much stronger: -0.15 to -0.20 success rate, max capped harder
 * - Mismatched axis modifiers are more generous: +0.08 to +0.10 success boost, expanded ceiling
 * - Exact-match (safe D vs safe O same axis): strongest penalty, tightest range cap
 * - Cross-style match (aggressive D vs safe O same axis): high-variance coin flip  
 * - Base success rates slightly increased to compensate for harsher matched penalties
 *   (otherwise defense wins too much when both play randomly)
 *
 * Starting yard line: 25
 * Target: ~50/50 random, correct reads visibly rewarded, wrong reads visibly punished
 */

export const PLAY_CONFIG: PlayConfig = {
  offensivePlays: {
    "run-safe": {
      id: "run-safe",
      name: "Inside Run",
      axis: "run",
      style: "safe",
      successRate: 0.80,          // bumped from 0.78 to offset harsher matched penalty
      yardageRange: { min: 1, max: 6 },
      criticalSuccessChance: 0.06,
      criticalFailureChance: 0.02,
    },
    "run-aggressive": {
      id: "run-aggressive",
      name: "Outside Run",
      axis: "run",
      style: "aggressive",
      successRate: 0.60,          // bumped from 0.58
      yardageRange: { min: 2, max: 11 },
      criticalSuccessChance: 0.10,
      criticalFailureChance: 0.04,
    },
    "pass-safe": {
      id: "pass-safe",
      name: "Short Pass",
      axis: "pass",
      style: "safe",
      successRate: 0.78,          // bumped from 0.75
      yardageRange: { min: 2, max: 8 },
      criticalSuccessChance: 0.05,
      criticalFailureChance: 0.02,
    },
    "pass-aggressive": {
      id: "pass-aggressive",
      name: "Deep Pass",
      axis: "pass",
      style: "aggressive",
      successRate: 0.50,          // bumped from 0.48
      yardageRange: { min: 4, max: 17 },
      criticalSuccessChance: 0.12,
      criticalFailureChance: 0.06,
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
  // RUN-SAFE offense (Inside Run) — base: 80%, 1-6 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (EXACT MATCH: safe run D vs safe run O)
  // Strongest penalty — you called it perfectly
  "run-safe:run-safe": {
    successRateMod: -0.18,      // was -0.08: much harder to succeed
    yardageMinMod: 0,
    yardageMaxMod: -3,          // was -1: max capped to 3 (range 1-3)
    critSuccessMod: -0.05,      // almost no chance of breakaway
    critFailureMod: 0.02,
  },
  // vs Blitz (CROSS-STYLE MATCH: aggressive run D vs safe run O)
  // High variance — risky blitz, might stuff it or whiff
  "run-safe:run-aggressive": {
    successRateMod: -0.15,      // was -0.12
    yardageMinMod: 0,
    yardageMaxMod: -2,          // was -2 (same): tighter range
    critSuccessMod: 0.04,       // blitz leaves gaps if it misses
    critFailureMod: 0.04,       // but if it hits, fumble risk up
  },
  // vs Zone Coverage (MISMATCHED: pass D vs run O)
  // You guessed wrong — offense gets a boost
  "run-safe:pass-safe": {
    successRateMod: 0.08,       // was 0.03: much bigger reward for wrong read
    yardageMinMod: 0,
    yardageMaxMod: 2,           // was 1: ceiling opens up
    critSuccessMod: 0.04,
    critFailureMod: -0.01,
  },
  // vs Man Press (MISMATCHED: aggressive pass D vs safe run O)
  // Very wrong guess — biggest reward
  "run-safe:pass-aggressive": {
    successRateMod: 0.10,       // was 0.04: big reward
    yardageMinMod: 0,
    yardageMaxMod: 3,           // was 2: ceiling opens wide
    critSuccessMod: 0.05,
    critFailureMod: -0.01,
  },

  // ═══════════════════════════════════════════════════════════
  // RUN-AGGRESSIVE offense (Outside Run) — base: 60%, 2-11 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (CROSS-STYLE MATCH: safe run D vs aggressive run O)
  // Contain scheme — limits the big play but doesn't stuff it
  "run-aggressive:run-safe": {
    successRateMod: -0.12,      // was -0.08
    yardageMinMod: 0,
    yardageMaxMod: -4,          // was -3: hard ceiling at 7
    critSuccessMod: -0.06,      // no breakaways
    critFailureMod: 0.02,
  },
  // vs Blitz (EXACT MATCH: aggressive run D vs aggressive run O)
  // Coin flip — either big stuff or big gain
  "run-aggressive:run-aggressive": {
    successRateMod: -0.18,      // was -0.10: much harder
    yardageMinMod: 0,
    yardageMaxMod: -4,          // was -3: range 2-7
    critSuccessMod: 0.08,       // but if you break it, it's big
    critFailureMod: 0.06,       // high fumble risk too
  },
  // vs Zone Coverage (MISMATCHED: pass D vs run O)
  "run-aggressive:pass-safe": {
    successRateMod: 0.08,       // was 0.03
    yardageMinMod: -1,
    yardageMaxMod: 2,           // was 1: expand range
    critSuccessMod: 0.04,
    critFailureMod: -0.02,
  },
  // vs Man Press (MISMATCHED: aggressive pass D vs aggressive run O)
  "run-aggressive:pass-aggressive": {
    successRateMod: 0.10,       // was 0.04
    yardageMinMod: -1,
    yardageMaxMod: 3,           // was 2: big expansion
    critSuccessMod: 0.06,
    critFailureMod: -0.03,
  },

  // ═══════════════════════════════════════════════════════════
  // PASS-SAFE offense (Short Pass) — base: 78%, 2-8 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (MISMATCHED: run D vs pass O)
  "pass-safe:run-safe": {
    successRateMod: 0.08,       // was 0.03
    yardageMinMod: 0,
    yardageMaxMod: 2,           // was 1
    critSuccessMod: 0.04,
    critFailureMod: -0.01,
  },
  // vs Blitz (MISMATCHED: aggressive run D vs safe pass O)
  // Blitz leaves passing lanes wide open
  "pass-safe:run-aggressive": {
    successRateMod: 0.10,       // was 0.05
    yardageMinMod: 0,
    yardageMaxMod: 3,           // was 2
    critSuccessMod: 0.05,
    critFailureMod: -0.01,
  },
  // vs Zone Coverage (EXACT MATCH: safe pass D vs safe pass O)
  "pass-safe:pass-safe": {
    successRateMod: -0.18,      // was -0.08
    yardageMinMod: 0,
    yardageMaxMod: -3,          // was -2: range 2-5
    critSuccessMod: -0.04,
    critFailureMod: 0.02,
  },
  // vs Man Press (CROSS-STYLE MATCH: aggressive pass D vs safe pass O)
  "pass-safe:pass-aggressive": {
    successRateMod: -0.15,      // was -0.12
    yardageMinMod: 0,
    yardageMaxMod: -3,          // was -2: tight range
    critSuccessMod: 0.04,       // press can get burned
    critFailureMod: 0.04,       // but press can jump routes
  },

  // ═══════════════════════════════════════════════════════════
  // PASS-AGGRESSIVE offense (Deep Pass) — base: 50%, 4-17 yds
  // ═══════════════════════════════════════════════════════════

  // vs Run Contain (MISMATCHED: run D vs pass O)
  "pass-aggressive:run-safe": {
    successRateMod: 0.08,       // was 0.04
    yardageMinMod: -1,
    yardageMaxMod: 2,           // was 1
    critSuccessMod: 0.05,
    critFailureMod: -0.03,
  },
  // vs Blitz (MISMATCHED: aggressive run D vs aggressive pass O)
  // Blitz is the worst thing you can call against deep pass
  "pass-aggressive:run-aggressive": {
    successRateMod: 0.12,       // was 0.06: biggest boost
    yardageMinMod: -1,
    yardageMaxMod: 4,           // was 3: ceiling at 21
    critSuccessMod: 0.06,
    critFailureMod: -0.04,
  },
  // vs Zone Coverage (CROSS-STYLE MATCH: safe pass D vs aggressive pass O)
  // Zone covers deep routes — strong containment
  "pass-aggressive:pass-safe": {
    successRateMod: -0.12,      // was -0.08
    yardageMinMod: 1,
    yardageMaxMod: -5,          // was -4: range 5-12
    critSuccessMod: -0.07,      // no deep shots
    critFailureMod: 0.02,
  },
  // vs Man Press (EXACT MATCH: aggressive pass D vs aggressive pass O)
  // Man press on deep route — coin flip, either burned or picked
  "pass-aggressive:pass-aggressive": {
    successRateMod: -0.18,      // was -0.10: much harder
    yardageMinMod: 0,
    yardageMaxMod: -5,          // was -4: range 4-12
    critSuccessMod: 0.08,       // if receiver beats press, gone
    critFailureMod: 0.06,       // but INT risk is high
  },
}
