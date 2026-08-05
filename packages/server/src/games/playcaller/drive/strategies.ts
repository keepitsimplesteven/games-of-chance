import type { DriveState, OffensivePlayId, DefensivePlayId, RngFunction } from "./types"
import { selectRandomPlay } from "./engine"

/**
 * Bot strategies for the Drive Engine.
 *
 * Each strategy is a function that takes game state and returns a play call.
 * These can be used in the CLI (as bot opponents) or in balance tests.
 */

// --- Play lists ---

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

// --- Types ---

export type OffenseStrategy = (state: DriveState, rng: RngFunction) => OffensivePlayId
export type DefenseStrategy = (state: DriveState, rng: RngFunction) => DefensivePlayId

// --- Offense Strategies ---

/** Random: picks uniformly at random */
export const randomOffense: OffenseStrategy = (_state, rng) =>
  selectRandomPlay(OFFENSIVE_PLAYS, rng) as OffensivePlayId

/**
 * Football Fundamentals offense:
 * - 1st and 10: safe run (establish the run)
 * - 2nd and short (≤3): aggressive pass (take a shot)
 * - 2nd and medium (4-6): safe pass (move the chains)
 * - 2nd and long (7+): aggressive run (try to get chunk yards)
 * - 3rd and short (≤3): safe run (power run up the middle)
 * - 3rd and medium (4-7): safe pass (reliable conversion)
 * - 3rd and long (8+): aggressive pass (go for it)
 * - 4th and short (≤2): safe run (QB sneak / goal line push)
 * - 4th and long (3+): aggressive pass (desperation heave)
 */
export const footballFundamentalsOffense: OffenseStrategy = (state) => {
  const { down, yardsToGo } = state

  switch (down) {
    case 1:
      return "run-safe" // establish the run on 1st down

    case 2:
      if (yardsToGo <= 3) return "pass-aggressive"   // 2nd and short: take a shot
      if (yardsToGo <= 6) return "pass-safe"          // 2nd and medium: safe pass
      return "run-aggressive"                          // 2nd and long: chunk play

    case 3:
      if (yardsToGo <= 3) return "run-safe"           // 3rd and short: power run
      if (yardsToGo <= 7) return "pass-safe"          // 3rd and medium: reliable
      return "pass-aggressive"                         // 3rd and long: go for it

    case 4:
      if (yardsToGo <= 2) return "run-safe"           // 4th and short: sneak
      return "pass-aggressive"                         // 4th and long: desperation

    default:
      return "run-safe"
  }
}

/**
 * Safe Run + 4th Down Deep Pass:
 * Conservative grind — safe run every play unless it's 4th and long
 */
export const safeRunThenDeepPass: OffenseStrategy = (state) => {
  if (state.down === 4 && state.yardsToGo > 4) {
    return "pass-aggressive"
  }
  return "run-safe"
}

/**
 * Greedy EV offense: always picks the static highest-EV play regardless of state.
 * (This doesn't adapt to down/distance, just picks the best average play.)
 */
export const greedyOffense: OffenseStrategy = () => {
  // Pre-computed: pass-safe has the highest average EV across all defenses
  // This may change per preset — ideally would be computed dynamically
  return "pass-safe"
}

/**
 * Air Raid: pass every play, safe on early downs, aggressive on later downs
 */
export const airRaidOffense: OffenseStrategy = (state) => {
  if (state.down <= 2 && state.yardsToGo <= 5) return "pass-aggressive"
  if (state.down >= 3) return "pass-aggressive"
  return "pass-safe"
}

/**
 * Ground and Pound: run every play, style matches situation
 */
export const groundAndPoundOffense: OffenseStrategy = (state) => {
  if (state.yardsToGo <= 4) return "run-safe"
  return "run-aggressive"
}

// --- Defense Strategies ---

/** Random: picks uniformly at random */
export const randomDefense: DefenseStrategy = (_state, rng) =>
  selectRandomPlay(DEFENSIVE_PLAYS, rng) as DefensivePlayId

/**
 * Football Fundamentals defense (mirrors offensive tendencies):
 * - 1st and 10: run-safe (expect the run)
 * - 2nd and short: pass-aggressive (expect the shot)
 * - 2nd and medium: pass-safe (expect safe pass)
 * - 2nd and long: run-aggressive (expect chunk run)
 * - 3rd and short: run-safe (expect power run)
 * - 3rd and medium: pass-safe (expect pass)
 * - 3rd and long: pass-aggressive (expect deep pass)
 * - 4th and short: run-safe (expect sneak)
 * - 4th and long: pass-aggressive (expect desperation)
 */
export const footballFundamentalsDefense: DefenseStrategy = (state) => {
  const { down, yardsToGo } = state

  switch (down) {
    case 1:
      return "run-safe" // expect the run

    case 2:
      if (yardsToGo <= 3) return "pass-aggressive"   // expect a shot
      if (yardsToGo <= 6) return "pass-safe"          // expect safe pass
      return "run-aggressive"                          // expect chunk run

    case 3:
      if (yardsToGo <= 3) return "run-safe"           // expect power run
      if (yardsToGo <= 7) return "pass-safe"          // expect pass
      return "pass-aggressive"                         // expect deep pass

    case 4:
      if (yardsToGo <= 2) return "run-safe"           // expect sneak
      return "pass-aggressive"                         // expect desperation

    default:
      return "run-safe"
  }
}

/**
 * Perfect Counter defense: always picks the exact-match counter for whatever
 * the offense plays. (This is a test-only strategy — requires knowing the
 * offense's pick. In the CLI we pass it the offense's choice after the fact.)
 */
export const perfectCounterDefense = (offPlay: OffensivePlayId): DefensivePlayId => {
  // Exact axis match with same style
  const axis = offPlay.startsWith("run") ? "run" : "pass"
  const style = offPlay.endsWith("safe") ? "safe" : "aggressive"
  return `${axis}-${style}` as DefensivePlayId
}

/**
 * Anti-fundamentals defense: intentionally picks the opposite of what
 * football logic says. Useful to test how much the fundamentals offense
 * benefits from bad defense.
 */
export const antiFundamentalsDefense: DefenseStrategy = (state) => {
  const { down, yardsToGo } = state

  switch (down) {
    case 1:
      return "pass-aggressive" // expect run? play deep pass D

    case 2:
      if (yardsToGo <= 3) return "run-safe"           // expect pass? play run D
      if (yardsToGo <= 6) return "run-aggressive"     // opposite
      return "pass-safe"                               // opposite

    case 3:
      if (yardsToGo <= 3) return "pass-aggressive"    // opposite
      if (yardsToGo <= 7) return "run-aggressive"     // opposite
      return "run-safe"                                // opposite

    case 4:
      if (yardsToGo <= 2) return "pass-aggressive"    // opposite
      return "run-safe"                                // opposite

    default:
      return "pass-safe"
  }
}

// --- Strategy registry (for CLI) ---

export interface StrategyInfo {
  name: string
  description: string
}

export const OFFENSE_STRATEGIES: Record<string, { strategy: OffenseStrategy; info: StrategyInfo }> = {
  random: { strategy: randomOffense, info: { name: "Random", description: "Picks plays uniformly at random" } },
  fundamentals: { strategy: footballFundamentalsOffense, info: { name: "Football Fundamentals", description: "Run on 1st, pass on 3rd-and-long, etc." } },
  "safe-run": { strategy: safeRunThenDeepPass, info: { name: "Safe Run Grind", description: "Safe run every play, deep pass on 4th-and-long" } },
  "air-raid": { strategy: airRaidOffense, info: { name: "Air Raid", description: "Pass every play, aggressive on later downs" } },
  "ground-pound": { strategy: groundAndPoundOffense, info: { name: "Ground & Pound", description: "Run every play, aggressive when needing yards" } },
}

export const DEFENSE_STRATEGIES: Record<string, { strategy: DefenseStrategy; info: StrategyInfo }> = {
  random: { strategy: randomDefense, info: { name: "Random", description: "Picks plays uniformly at random" } },
  fundamentals: { strategy: footballFundamentalsDefense, info: { name: "Football Fundamentals", description: "Mirrors expected offensive tendencies" } },
  "anti-fundamentals": { strategy: antiFundamentalsDefense, info: { name: "Anti-Fundamentals", description: "Intentionally picks opposite of expected" } },
}
