/**
 * Battle Bots — Fairness Simulator (Combat Rebalance)
 *
 * Dual-pass balance validation:
 *   Pass 1: Every build vs a deterministic reference bot (1 dmg/tick, guaranteed hit, no energy).
 *   Pass 2: All-vs-all random mirror matches (secondary validation).
 *
 * The reference bot is NOT a CombatRobot. It is modeled directly in the simulation loop
 * with hardcoded deterministic behavior:
 *   - hp: 100 (BASE_HP)
 *   - damagePerTick: 1 (always deals exactly 1)
 *   - alwaysHits: true (no accuracy roll)
 *   - bypassesEnergy: true (not subject to energy accumulation)
 *
 * On every tick it is alive, the reference bot deals 1 damage to the challenger.
 * It kills any 100 HP bot in exactly 100 ticks (10 seconds at 100ms ticks).
 *
 * Balance band: 49%–51%.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts
 */

import { deriveCombatStats, BASE_HP } from "../ModifierTable"
import type { CombatRobot } from "../types"

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_PER_BUILD = 100_000
const BALANCE_LOW = 0.49
const BALANCE_HIGH = 0.51

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TuningResult {
  stars: { damage: number; accuracy: number; speed: number }
  winRate: number
  matchesPlayed: number
  inBand: boolean
}

export interface SimulatorReport {
  pass1Results: TuningResult[] // vs reference bot
  pass2Results: TuningResult[] // mirror matches (added in Task 1.2)
  allInBand: boolean
}

// ─── Build Enumeration ────────────────────────────────────────────────────────

/**
 * Enumerate all valid star distributions where damage + accuracy + speed = 9
 * and each value is in [1, 7]. Yields exactly 28 configurations.
 */
export function allBuilds(): Array<{ damage: number; accuracy: number; speed: number }> {
  const builds: Array<{ damage: number; accuracy: number; speed: number }> = []

  for (let damage = 1; damage <= 7; damage++) {
    for (let accuracy = 1; accuracy <= 7; accuracy++) {
      const speed = 9 - damage - accuracy
      if (speed >= 1 && speed <= 7) {
        builds.push({ damage, accuracy, speed })
      }
    }
  }

  return builds
}

// ─── Bot Construction ─────────────────────────────────────────────────────────

function buildCombatRobot(
  stars: { damage: number; accuracy: number; speed: number },
  ownerId: string
): CombatRobot {
  const stats = deriveCombatStats(stars)

  return {
    ownerId,
    name: `Bot-${stars.damage}-${stars.accuracy}-${stars.speed}`,
    maxHit: stats.maxHit,
    accuracy: stats.accuracy,
    energyPerTick: stats.energyPerTick,
    currentEnergy: 0,
    currentHp: stats.hp,
    maxHp: stats.hp,
    stars,
    visual: {},
  }
}

// ─── Reference Bot Simulation ─────────────────────────────────────────────────

/**
 * Simulate a single trial: challenger vs deterministic reference bot.
 *
 * Reference bot behavior (hardcoded, NOT a CombatRobot):
 *   - Deals exactly 1 damage per tick (guaranteed hit, no accuracy roll)
 *   - Bypasses energy accumulation (attacks every tick unconditionally)
 *   - Has `referenceHp` HP (default BASE_HP = 100)
 *
 * Challenger uses normal combat mechanics:
 *   - Accumulates energy via energyPerTick
 *   - Attacks when energy >= 100 (subtracts 100)
 *   - Rolls accuracy, then rolls damage on hit
 */
export function simulateVsReference(
  challenger: CombatRobot,
  referenceHp: number
): { winnerId: "challenger" | "reference" } {
  let challengerHp = challenger.currentHp
  let refHp = referenceHp
  let energy = 0

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    // Reference bot always deals 1 damage to challenger (guaranteed hit, no energy system)
    challengerHp = Math.max(0, challengerHp - 1)
    if (challengerHp <= 0) return { winnerId: "reference" }

    // Challenger accumulates energy normally
    energy += challenger.energyPerTick
    if (energy >= 100) {
      energy -= 100
      // Roll accuracy
      const hit = Math.floor(Math.random() * 100) + 1 <= challenger.accuracy
      if (hit) {
        const damage = Math.floor(Math.random() * challenger.maxHit) + 1
        refHp = Math.max(0, refHp - damage)
      }
      if (refHp <= 0) return { winnerId: "challenger" }
    }
  }

  // Timeout: whoever has more HP wins
  return { winnerId: challengerHp >= refHp ? "challenger" : "reference" }
}

// ─── Balance Band Classification ──────────────────────────────────────────────

/**
 * Returns true if win rate is within the 49%–51% balance band.
 */
export function isInBand(winRate: number): boolean {
  return winRate >= BALANCE_LOW && winRate <= BALANCE_HIGH
}

// ─── Pass 1: Reference Bot Validation ─────────────────────────────────────────

/**
 * Run Pass 1: simulate each of the 28 builds against the deterministic reference bot.
 * Returns per-build win rates and flags any outside 49%–51%.
 */
function runPass1(): TuningResult[] {
  const builds = allBuilds()
  const results: TuningResult[] = []

  for (const build of builds) {
    let wins = 0

    for (let i = 0; i < TRIALS_PER_BUILD; i++) {
      const challenger = buildCombatRobot(build, "challenger")
      const result = simulateVsReference(challenger, BASE_HP)
      if (result.winnerId === "challenger") wins++
    }

    const winRate = wins / TRIALS_PER_BUILD
    results.push({
      stars: build,
      winRate,
      matchesPlayed: TRIALS_PER_BUILD,
      inBand: isInBand(winRate),
    })
  }

  return results
}

// ─── Mirror Match Simulation ──────────────────────────────────────────────────

/** Number of mirror matches each build plays in Pass 2 */
const MIRROR_MATCHES_PER_BUILD = 200

/**
 * Simulate a single mirror match between two bots using normal combat mechanics.
 *
 * Both bots use the standard energy accumulation → attack cycle:
 *   - Accumulate energyPerTick each tick
 *   - When energy >= 100, attack (subtract 100 energy)
 *   - Roll accuracy to determine hit
 *   - Roll damage on hit
 *
 * Returns the winning bot identifier ("bot1" or "bot2").
 */
export function simulateMirrorMatch(
  bot1: CombatRobot,
  bot2: CombatRobot
): { winnerId: "bot1" | "bot2" } {
  let hp1 = bot1.currentHp
  let hp2 = bot2.currentHp
  let energy1 = 0
  let energy2 = 0

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    // Bot 1 accumulates energy and attacks
    energy1 += bot1.energyPerTick
    if (energy1 >= 100) {
      energy1 -= 100
      const hit = Math.floor(Math.random() * 100) + 1 <= bot1.accuracy
      if (hit) {
        const damage = Math.floor(Math.random() * bot1.maxHit) + 1
        hp2 = Math.max(0, hp2 - damage)
      }
      if (hp2 <= 0) return { winnerId: "bot1" }
    }

    // Bot 2 accumulates energy and attacks
    energy2 += bot2.energyPerTick
    if (energy2 >= 100) {
      energy2 -= 100
      const hit = Math.floor(Math.random() * 100) + 1 <= bot2.accuracy
      if (hit) {
        const damage = Math.floor(Math.random() * bot2.maxHit) + 1
        hp1 = Math.max(0, hp1 - damage)
      }
      if (hp1 <= 0) return { winnerId: "bot2" }
    }
  }

  // Timeout: whoever has more HP wins; tiebreak favours bot1
  return { winnerId: hp1 >= hp2 ? "bot1" : "bot2" }
}

// ─── Pass 2: All-vs-All Mirror Matches ───────────────────────────────────────

/**
 * Run Pass 2: for each of the 28 builds, play random mirror matches against
 * randomly selected opponents from the other 27 builds.
 *
 * Both sides use normal combat mechanics (energy accumulation, accuracy rolls,
 * damage rolls). Reports per-build aggregate win rates as secondary validation.
 */
function runPass2(): TuningResult[] {
  const builds = allBuilds()
  const results: TuningResult[] = []

  for (let i = 0; i < builds.length; i++) {
    const build = builds[i]
    let wins = 0

    for (let m = 0; m < MIRROR_MATCHES_PER_BUILD; m++) {
      // Pick a random opponent from the other 27 builds
      let opponentIdx = Math.floor(Math.random() * (builds.length - 1))
      if (opponentIdx >= i) opponentIdx++ // skip self

      const bot1 = buildCombatRobot(build, "bot1")
      const bot2 = buildCombatRobot(builds[opponentIdx], "bot2")

      const result = simulateMirrorMatch(bot1, bot2)
      if (result.winnerId === "bot1") wins++
    }

    const winRate = wins / MIRROR_MATCHES_PER_BUILD
    results.push({
      stars: build,
      winRate,
      matchesPlayed: MIRROR_MATCHES_PER_BUILD,
      inBand: isInBand(winRate),
    })
  }

  return results
}

// ─── Report Output ────────────────────────────────────────────────────────────

function printPass2Results(results: TuningResult[]): void {
  const outOfBand = results.filter((r) => !r.inBand)
  const inBand = results.filter((r) => r.inBand)

  console.log(`\n📊 Pass 2 Results — Mirror Matches (Secondary Validation)`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  Matches per build: ${MIRROR_MATCHES_PER_BUILD}`)
  console.log(`  In band (49-51%): ${inBand.length} / ${results.length} builds`)
  console.log(`  Out of band:      ${outOfBand.length} / ${results.length} builds`)

  if (outOfBand.length > 0) {
    console.log(`\n⚠️  Builds Outside Balance Band (Mirror Matches):`)
    console.log(`${"─".repeat(60)}`)
    console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
    console.log(`  ${"─".repeat(44)}`)

    for (const r of outOfBand.sort((a, b) => a.winRate - b.winRate)) {
      const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
      const winPct = `${(r.winRate * 100).toFixed(1)}%`
      const status = r.winRate < BALANCE_LOW ? "🔻 TOO LOW" : "🔺 TOO HIGH"
      console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
    }
  }

  console.log(`\n📋 All Builds (Mirror Matches):`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
  console.log(`  ${"─".repeat(44)}`)

  for (const r of results.sort(
    (a, b) =>
      a.stars.damage - b.stars.damage ||
      a.stars.accuracy - b.stars.accuracy ||
      a.stars.speed - b.stars.speed
  )) {
    const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
    const winPct = `${(r.winRate * 100).toFixed(1)}%`
    const status = r.inBand ? "✅" : r.winRate < BALANCE_LOW ? "🔻" : "🔺"
    console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
  }

  console.log("")
}

function printPass1Results(results: TuningResult[]): void {
  const outOfBand = results.filter((r) => !r.inBand)
  const inBand = results.filter((r) => r.inBand)

  console.log(`\n📊 Pass 1 Results — vs Reference Bot`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  In band (49-51%): ${inBand.length} / ${results.length} builds`)
  console.log(`  Out of band:      ${outOfBand.length} / ${results.length} builds`)

  if (outOfBand.length > 0) {
    console.log(`\n⚠️  Builds Outside Balance Band:`)
    console.log(`${"─".repeat(60)}`)
    console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
    console.log(`  ${"─".repeat(44)}`)

    for (const r of outOfBand.sort((a, b) => a.winRate - b.winRate)) {
      const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
      const winPct = `${(r.winRate * 100).toFixed(1)}%`
      const status = r.winRate < BALANCE_LOW ? "🔻 TOO LOW" : "🔺 TOO HIGH"
      console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
    }
  }

  console.log(`\n📋 All Builds:`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
  console.log(`  ${"─".repeat(44)}`)

  for (const r of results.sort(
    (a, b) =>
      a.stars.damage - b.stars.damage ||
      a.stars.accuracy - b.stars.accuracy ||
      a.stars.speed - b.stars.speed
  )) {
    const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
    const winPct = `${(r.winRate * 100).toFixed(1)}%`
    const status = r.inBand ? "✅" : r.winRate < BALANCE_LOW ? "🔻" : "🔺"
    console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
  }

  console.log("")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): SimulatorReport {
  console.log(`\n🤖 Battle Bots — Fairness Simulator (Combat Rebalance)`)
  console.log(`${"─".repeat(60)}`)
  console.log(`Reference bot: deterministic (1 dmg/tick, guaranteed hit, no energy)`)
  console.log(`Reference bot HP: ${BASE_HP}`)
  console.log(`Trials per build: ${TRIALS_PER_BUILD.toLocaleString()}`)
  console.log(`Total builds: 28`)
  console.log(`Balance band: ${BALANCE_LOW * 100}% – ${BALANCE_HIGH * 100}%\n`)

  // Pass 1: vs reference bot
  console.log(`⏳ Running Pass 1: Reference Bot Validation...`)
  const pass1Results = runPass1()
  printPass1Results(pass1Results)

  // Pass 2: all-vs-all mirror matches (secondary validation)
  console.log(`⏳ Running Pass 2: All-vs-All Mirror Matches...`)
  const pass2Results = runPass2()
  printPass2Results(pass2Results)

  const allInBand = pass1Results.every((r) => r.inBand)

  if (allInBand) {
    console.log(`\n✅ All 28 builds are within the 49%–51% balance band!`)
  } else {
    const count = pass1Results.filter((r) => !r.inBand).length
    console.log(`\n❌ ${count} build(s) are outside the balance band. Tuning needed.`)
  }

  return { pass1Results, pass2Results, allInBand }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

main()
